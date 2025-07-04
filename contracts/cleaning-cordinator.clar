;; Cleansing Coordinator Contract
;; Manages data cleansing workflows

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_INVALID_JOB (err u301))
(define-constant ERR_JOB_NOT_FOUND (err u302))
(define-constant ERR_JOB_ALREADY_ASSIGNED (err u303))

(define-data-var next-job-id uint u1)

(define-map cleansing-jobs
  { job-id: uint }
  {
    data-source: (string-ascii 100),
    assigned-manager: uint,
    priority: (string-ascii 10),
    status: (string-ascii 20),
    created-block: uint,
    estimated-completion: uint,
    actual-completion: uint,
    quality-improvement: uint
  }
)

(define-map job-requirements
  { job-id: uint }
  {
    cleansing-type: (string-ascii 50),
    target-quality-score: uint,
    max-duration-blocks: uint,
    reward-amount: uint,
    special-instructions: (string-ascii 300)
  }
)

;; Create cleansing job
(define-public (create-cleansing-job
  (data-source (string-ascii 100))
  (priority (string-ascii 10))
  (cleansing-type (string-ascii 50))
  (target-quality-score uint)
  (max-duration-blocks uint)
  (reward-amount uint)
  (instructions (string-ascii 300))
)
  (let
    (
      (job-id (var-get next-job-id))
    )
    (asserts! (> target-quality-score u0) ERR_INVALID_JOB)
    (asserts! (<= target-quality-score u100) ERR_INVALID_JOB)
    (asserts! (> max-duration-blocks u0) ERR_INVALID_JOB)

    (map-set cleansing-jobs
      { job-id: job-id }
      {
        data-source: data-source,
        assigned-manager: u0,
        priority: priority,
        status: "open",
        created-block: block-height,
        estimated-completion: (+ block-height max-duration-blocks),
        actual-completion: u0,
        quality-improvement: u0
      }
    )

    (map-set job-requirements
      { job-id: job-id }
      {
        cleansing-type: cleansing-type,
        target-quality-score: target-quality-score,
        max-duration-blocks: max-duration-blocks,
        reward-amount: reward-amount,
        special-instructions: instructions
      }
    )

    (var-set next-job-id (+ job-id u1))
    (ok job-id)
  )
)

;; Assign job to manager
(define-public (assign-job (job-id uint) (manager-id uint))
  (let
    (
      (job-data (unwrap! (map-get? cleansing-jobs { job-id: job-id }) ERR_JOB_NOT_FOUND))
    )
    (asserts! (is-eq (get assigned-manager job-data) u0) ERR_JOB_ALREADY_ASSIGNED)
    (asserts! (is-eq (get status job-data) "open") ERR_INVALID_JOB)

    (map-set cleansing-jobs
      { job-id: job-id }
      (merge job-data {
        assigned-manager: manager-id,
        status: "assigned"
      })
    )
    (ok true)
  )
)

;; Complete cleansing job
(define-public (complete-job (job-id uint) (quality-improvement uint))
  (let
    (
      (job-data (unwrap! (map-get? cleansing-jobs { job-id: job-id }) ERR_JOB_NOT_FOUND))
    )
    (asserts! (is-eq (get status job-data) "assigned") ERR_INVALID_JOB)
    (asserts! (<= quality-improvement u100) ERR_INVALID_JOB)

    (map-set cleansing-jobs
      { job-id: job-id }
      (merge job-data {
        status: "completed",
        actual-completion: block-height,
        quality-improvement: quality-improvement
      })
    )
    (ok true)
  )
)

;; Get job details
(define-read-only (get-job (job-id uint))
  (map-get? cleansing-jobs { job-id: job-id })
)

;; Get job requirements
(define-read-only (get-job-requirements (job-id uint))
  (map-get? job-requirements { job-id: job-id })
)

;; Check if job is overdue
(define-read-only (is-job-overdue (job-id uint))
  (match (map-get? cleansing-jobs { job-id: job-id })
    job-data (and
      (is-eq (get status job-data) "assigned")
      (> block-height (get estimated-completion job-data))
    )
    false
  )
)

;; Get total jobs
(define-read-only (get-total-jobs)
  (- (var-get next-job-id) u1)
)
