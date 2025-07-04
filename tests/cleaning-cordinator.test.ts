import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockCleansingState = {
  cleansingJobs: new Map(),
  jobRequirements: new Map(),
  nextJobId: 1,
  currentBlock: 100
}

// Mock contract functions
const cleansingFunctions = {
  createCleansingJob: (dataSource, priority, cleansingType, targetQualityScore, maxDurationBlocks, rewardAmount, instructions) => {
    if (targetQualityScore <= 0 || targetQualityScore > 100) {
      return { error: 'ERR_INVALID_JOB' }
    }
    if (maxDurationBlocks <= 0) {
      return { error: 'ERR_INVALID_JOB' }
    }
    
    const jobId = mockCleansingState.nextJobId
    
    mockCleansingState.cleansingJobs.set(jobId, {
      dataSource,
      assignedManager: 0,
      priority,
      status: 'open',
      createdBlock: mockCleansingState.currentBlock,
      estimatedCompletion: mockCleansingState.currentBlock + maxDurationBlocks,
      actualCompletion: 0,
      qualityImprovement: 0
    })
    
    mockCleansingState.jobRequirements.set(jobId, {
      cleansingType,
      targetQualityScore,
      maxDurationBlocks,
      rewardAmount,
      specialInstructions: instructions
    })
    
    mockCleansingState.nextJobId++
    return { success: jobId }
  },
  
  assignJob: (jobId, managerId) => {
    const job = mockCleansingState.cleansingJobs.get(jobId)
    if (!job) {
      return { error: 'ERR_JOB_NOT_FOUND' }
    }
    if (job.assignedManager !== 0) {
      return { error: 'ERR_JOB_ALREADY_ASSIGNED' }
    }
    if (job.status !== 'open') {
      return { error: 'ERR_INVALID_JOB' }
    }
    
    job.assignedManager = managerId
    job.status = 'assigned'
    mockCleansingState.cleansingJobs.set(jobId, job)
    return { success: true }
  },
  
  completeJob: (jobId, qualityImprovement) => {
    const job = mockCleansingState.cleansingJobs.get(jobId)
    if (!job) {
      return { error: 'ERR_JOB_NOT_FOUND' }
    }
    if (job.status !== 'assigned') {
      return { error: 'ERR_INVALID_JOB' }
    }
    if (qualityImprovement > 100) {
      return { error: 'ERR_INVALID_JOB' }
    }
    
    job.status = 'completed'
    job.actualCompletion = mockCleansingState.currentBlock
    job.qualityImprovement = qualityImprovement
    mockCleansingState.cleansingJobs.set(jobId, job)
    return { success: true }
  },
  
  getJob: (jobId) => {
    return mockCleansingState.cleansingJobs.get(jobId) || null
  },
  
  getJobRequirements: (jobId) => {
    return mockCleansingState.jobRequirements.get(jobId) || null
  },
  
  isJobOverdue: (jobId) => {
    const job = mockCleansingState.cleansingJobs.get(jobId)
    if (!job) return false
    
    return job.status === 'assigned' && mockCleansingState.currentBlock > job.estimatedCompletion
  },
  
  getTotalJobs: () => {
    return mockCleansingState.nextJobId - 1
  }
}

describe('Cleansing Coordinator Contract', () => {
  beforeEach(() => {
    mockCleansingState.cleansingJobs.clear()
    mockCleansingState.jobRequirements.clear()
    mockCleansingState.nextJobId = 1
    mockCleansingState.currentBlock = 100
  })
  
  describe('Job Creation', () => {
    it('should create a valid cleansing job', () => {
      const result = cleansingFunctions.createCleansingJob(
          'Customer Database',
          'high',
          'data-deduplication',
          85,
          1000,
          500,
          'Remove duplicate customer records and standardize formats'
      )
      
      expect(result.success).toBe(1)
      
      const job = cleansingFunctions.getJob(1)
      expect(job.status).toBe('open')
      expect(job.assignedManager).toBe(0)
    })
    
    it('should reject job with invalid target quality score', () => {
      const result = cleansingFunctions.createCleansingJob(
          'Database',
          'high',
          'cleansing',
          150, // Invalid score > 100
          1000,
          500,
          'Instructions'
      )
      
      expect(result.error).toBe('ERR_INVALID_JOB')
    })
    
    it('should reject job with zero duration', () => {
      const result = cleansingFunctions.createCleansingJob(
          'Database',
          'high',
          'cleansing',
          85,
          0, // Invalid duration
          500,
          'Instructions'
      )
      
      expect(result.error).toBe('ERR_INVALID_JOB')
    })
    
    it('should set correct estimated completion time', () => {
      cleansingFunctions.createCleansingJob('DB', 'high', 'cleansing', 85, 500, 100, 'Notes')
      
      const job = cleansingFunctions.getJob(1)
      expect(job.estimatedCompletion).toBe(600) // 100 + 500
    })
  })
  
  describe('Job Assignment', () => {
    beforeEach(() => {
      cleansingFunctions.createCleansingJob('DB', 'high', 'cleansing', 85, 1000, 500, 'Notes')
    })
    
    it('should assign job to manager', () => {
      const result = cleansingFunctions.assignJob(1, 123)
      
      expect(result.success).toBe(true)
      
      const job = cleansingFunctions.getJob(1)
      expect(job.assignedManager).toBe(123)
      expect(job.status).toBe('assigned')
    })
    
    it('should reject assignment to non-existent job', () => {
      const result = cleansingFunctions.assignJob(999, 123)
      
      expect(result.error).toBe('ERR_JOB_NOT_FOUND')
    })
    
    it('should reject assignment to already assigned job', () => {
      cleansingFunctions.assignJob(1, 123)
      const result = cleansingFunctions.assignJob(1, 456)
      
      expect(result.error).toBe('ERR_JOB_ALREADY_ASSIGNED')
    })
  })
  
  describe('Job Completion', () => {
    beforeEach(() => {
      cleansingFunctions.createCleansingJob('DB', 'high', 'cleansing', 85, 1000, 500, 'Notes')
      cleansingFunctions.assignJob(1, 123)
    })
    
    it('should complete assigned job', () => {
      const result = cleansingFunctions.completeJob(1, 25)
      
      expect(result.success).toBe(true)
      
      const job = cleansingFunctions.getJob(1)
      expect(job.status).toBe('completed')
      expect(job.qualityImprovement).toBe(25)
      expect(job.actualCompletion).toBe(100)
    })
    
    it('should reject completion of unassigned job', () => {
      cleansingFunctions.createCleansingJob('DB2', 'medium', 'cleansing', 80, 500, 300, 'Notes')
      const result = cleansingFunctions.completeJob(2, 20)
      
      expect(result.error).toBe('ERR_INVALID_JOB')
    })
    
    it('should reject completion with invalid improvement percentage', () => {
      const result = cleansingFunctions.completeJob(1, 150)
      
      expect(result.error).toBe('ERR_INVALID_JOB')
    })
  })
  
  describe('Job Queries', () => {
    beforeEach(() => {
      cleansingFunctions.createCleansingJob('Customer DB', 'high', 'deduplication', 85, 1000, 500, 'Remove duplicates')
    })
    
    it('should retrieve job information', () => {
      const job = cleansingFunctions.getJob(1)
      
      expect(job).toEqual({
        dataSource: 'Customer DB',
        assignedManager: 0,
        priority: 'high',
        status: 'open',
        createdBlock: 100,
        estimatedCompletion: 1100,
        actualCompletion: 0,
        qualityImprovement: 0
      })
    })
    
    it('should retrieve job requirements', () => {
      const requirements = cleansingFunctions.getJobRequirements(1)
      
      expect(requirements).toEqual({
        cleansingType: 'deduplication',
        targetQualityScore: 85,
        maxDurationBlocks: 1000,
        rewardAmount: 500,
        specialInstructions: 'Remove duplicates'
      })
    })
    
    it('should return null for non-existent job', () => {
      expect(cleansingFunctions.getJob(999)).toBeNull()
      expect(cleansingFunctions.getJobRequirements(999)).toBeNull()
    })
  })
  
  describe('Job Status Tracking', () => {
    beforeEach(() => {
      cleansingFunctions.createCleansingJob('DB', 'high', 'cleansing', 85, 100, 500, 'Notes')
      cleansingFunctions.assignJob(1, 123)
    })
    
    it('should detect overdue jobs', () => {
      mockCleansingState.currentBlock = 250 // Past estimated completion (100 + 100 = 200)
      
      expect(cleansingFunctions.isJobOverdue(1)).toBe(true)
    })
    
    it('should not mark on-time jobs as overdue', () => {
      mockCleansingState.currentBlock = 150 // Before estimated completion
      
      expect(cleansingFunctions.isJobOverdue(1)).toBe(false)
    })
    
    it('should not mark completed jobs as overdue', () => {
      cleansingFunctions.completeJob(1, 20)
      mockCleansingState.currentBlock = 250
      
      expect(cleansingFunctions.isJobOverdue(1)).toBe(false)
    })
    
    it('should count total jobs correctly', () => {
      cleansingFunctions.createCleansingJob('DB2', 'medium', 'validation', 80, 500, 300, 'Notes2')
      cleansingFunctions.createCleansingJob('DB3', 'low', 'formatting', 75, 200, 100, 'Notes3')
      
      expect(cleansingFunctions.getTotalJobs()).toBe(3)
    })
  })
})
