import { logger } from '@nx/devkit'
import { join, resolve, isAbsolute } from 'path'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedValue?: any
}

export class InputValidator {
  /**
   * Validates and sanitizes a session ID
   */
  static validateSessionId(sessionId: string): ValidationResult {
    const errors: string[] = []
    
    if (!sessionId || typeof sessionId !== 'string') {
      errors.push('Session ID must be a non-empty string')
      return { isValid: false, errors }
    }
    
    if (sessionId.length < 3 || sessionId.length > 64) {
      errors.push('Session ID must be between 3 and 64 characters')
    }
    
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*[a-zA-Z0-9]$/.test(sessionId)) {
      errors.push('Session ID must contain only alphanumeric characters, hyphens, and underscores, and cannot start or end with special characters')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sessionId.trim()
    }
  }

  /**
   * Validates and sanitizes a library name
   */
  static validateLibraryName(library: string): ValidationResult {
    const errors: string[] = []
    
    if (!library || typeof library !== 'string') {
      errors.push('Library name must be a non-empty string')
      return { isValid: false, errors }
    }
    
    if (library.length < 1 || library.length > 100) {
      errors.push('Library name must be between 1 and 100 characters')
    }
    
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_/]*[a-zA-Z0-9]$/.test(library) && library.length > 1) {
      errors.push('Library name must contain only alphanumeric characters, hyphens, underscores, and forward slashes')
    }
    
    // Check for path traversal attempts
    if (library.includes('..') || library.includes('./') || library.includes('../')) {
      errors.push('Library name cannot contain path traversal sequences')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: library.trim()
    }
  }

  /**
   * Validates task description
   */
  static validateTaskDescription(task: string): ValidationResult {
    const errors: string[] = []
    
    if (!task || typeof task !== 'string') {
      errors.push('Task description must be a non-empty string')
      return { isValid: false, errors }
    }
    
    if (task.length < 5 || task.length > 1000) {
      errors.push('Task description must be between 5 and 1000 characters')
    }
    
    // Check for potential command injection
    const dangerousPatterns = [
      /[;&|`$()]/,  // Shell metacharacters
      /\${.*}/,     // Variable expansion
      /`.*`/,       // Command substitution
      /\$\(/        // Command substitution
    ]
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(task)) {
        errors.push('Task description contains potentially dangerous characters')
        break
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: task.trim()
    }
  }

  /**
   * Validates numeric priority value
   */
  static validatePriority(priority?: number): ValidationResult {
    const errors: string[] = []
    
    if (priority !== undefined) {
      if (typeof priority !== 'number' || isNaN(priority)) {
        errors.push('Priority must be a valid number')
        return { isValid: false, errors }
      }
      
      if (priority < 1 || priority > 100) {
        errors.push('Priority must be between 1 and 100')
      }
      
      if (!Number.isInteger(priority)) {
        errors.push('Priority must be an integer')
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: priority ? Math.round(Math.max(1, Math.min(100, priority))) : 50
    }
  }

  /**
   * Validates and sanitizes file paths to prevent directory traversal
   */
  static validateFilePath(filePath: string, workspaceRoot?: string): ValidationResult {
    const errors: string[] = []
    
    if (!filePath || typeof filePath !== 'string') {
      errors.push('File path must be a non-empty string')
      return { isValid: false, errors }
    }
    
    // Check for dangerous path patterns
    if (filePath.includes('..') || filePath.includes('~')) {
      errors.push('File path cannot contain path traversal sequences (..) or home directory references (~)')
    }
    
    // Resolve and validate the path
    let resolvedPath: string
    try {
      if (isAbsolute(filePath)) {
        resolvedPath = resolve(filePath)
      } else if (workspaceRoot) {
        resolvedPath = resolve(join(workspaceRoot, filePath))
      } else {
        resolvedPath = resolve(filePath)
      }
    } catch (error) {
      errors.push(`Invalid file path: ${error}`)
      return { isValid: false, errors }
    }
    
    // Ensure path stays within workspace if workspace root is provided
    if (workspaceRoot) {
      const normalizedWorkspace = resolve(workspaceRoot)
      if (!resolvedPath.startsWith(normalizedWorkspace)) {
        errors.push('File path must be within the workspace directory')
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: resolvedPath
    }
  }

  /**
   * Validates array of passthrough arguments
   */
  static validatePassthroughArgs(args?: string[]): ValidationResult {
    const errors: string[] = []
    const sanitizedArgs: string[] = []
    
    if (args && Array.isArray(args)) {
      for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        
        if (typeof arg !== 'string') {
          errors.push(`Argument ${i} must be a string`)
          continue
        }
        
        if (arg.length > 1000) {
          errors.push(`Argument ${i} is too long (max 1000 characters)`)
          continue
        }
        
        // Check for dangerous patterns
        const dangerousPatterns = [
          /--dangerous/i,
          /--skip.*permission/i,
          /--bypass/i,
          /[;&|`$()]/,
          /\${.*}/,
          /`.*`/,
          /\$\(/
        ]
        
        let hasDangerousPattern = false
        for (const pattern of dangerousPatterns) {
          if (pattern.test(arg)) {
            errors.push(`Argument ${i} contains potentially dangerous pattern: ${arg}`)
            hasDangerousPattern = true
            break
          }
        }
        
        if (!hasDangerousPattern) {
          sanitizedArgs.push(arg.trim())
        }
      }
      
      if (sanitizedArgs.length > 50) {
        errors.push('Too many arguments (max 50)')
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedArgs
    }
  }

  /**
   * Validates timeout string (e.g., "30m", "2h", "45s")
   */
  static validateTimeout(timeout?: string): ValidationResult {
    const errors: string[] = []
    let timeoutMs = 600000 // Default 10 minutes
    
    if (timeout) {
      if (typeof timeout !== 'string') {
        errors.push('Timeout must be a string')
        return { isValid: false, errors }
      }
      
      const match = timeout.match(/^(\d+)([smh])$/)
      if (!match) {
        errors.push('Timeout must be in format like "30s", "5m", or "2h"')
        return { isValid: false, errors }
      }
      
      const value = parseInt(match[1], 10)
      const unit = match[2]
      
      if (value <= 0) {
        errors.push('Timeout value must be positive')
        return { isValid: false, errors }
      }
      
      switch (unit) {
        case 's':
          timeoutMs = value * 1000
          break
        case 'm':
          timeoutMs = value * 60 * 1000
          break
        case 'h':
          timeoutMs = value * 60 * 60 * 1000
          break
      }
      
      // Limit maximum timeout to 2 hours
      if (timeoutMs > 2 * 60 * 60 * 1000) {
        errors.push('Timeout cannot exceed 2 hours')
      }
      
      // Minimum timeout 10 seconds
      if (timeoutMs < 10000) {
        errors.push('Timeout cannot be less than 10 seconds')
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: timeoutMs
    }
  }

  /**
   * Validates task type
   */
  static validateTaskType(taskType?: string): ValidationResult {
    const errors: string[] = []
    const validTypes = ['feature', 'bug-fix', 'refactor', 'test', 'documentation']
    
    if (taskType && !validTypes.includes(taskType)) {
      errors.push(`Task type must be one of: ${validTypes.join(', ')}`)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: taskType || 'feature'
    }
  }

  /**
   * Validates complexity level
   */
  static validateComplexity(complexity?: string): ValidationResult {
    const errors: string[] = []
    const validComplexities = ['low', 'medium', 'high']
    
    if (complexity && !validComplexities.includes(complexity)) {
      errors.push(`Complexity must be one of: ${validComplexities.join(', ')}`)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: complexity || 'medium'
    }
  }

  /**
   * Comprehensive validation for executor options
   */
  static validateExecutorOptions(options: any, workspaceRoot: string): ValidationResult {
    const errors: string[] = []
    const sanitized: any = {}
    
    // Validate library
    if (options.library) {
      const libraryResult = this.validateLibraryName(options.library)
      if (!libraryResult.isValid) {
        errors.push(...libraryResult.errors.map(e => `Library: ${e}`))
      } else {
        sanitized.library = libraryResult.sanitizedValue
      }
    }
    
    // Validate task
    if (options.task) {
      const taskResult = this.validateTaskDescription(options.task)
      if (!taskResult.isValid) {
        errors.push(...taskResult.errors.map(e => `Task: ${e}`))
      } else {
        sanitized.task = taskResult.sanitizedValue
      }
    }
    
    // Validate priority
    const priorityResult = this.validatePriority(options.priority)
    if (!priorityResult.isValid) {
      errors.push(...priorityResult.errors.map(e => `Priority: ${e}`))
    } else {
      sanitized.priority = priorityResult.sanitizedValue
    }
    
    // Validate task type
    const taskTypeResult = this.validateTaskType(options.taskType)
    if (!taskTypeResult.isValid) {
      errors.push(...taskTypeResult.errors.map(e => `Task type: ${e}`))
    } else {
      sanitized.taskType = taskTypeResult.sanitizedValue
    }
    
    // Validate complexity
    const complexityResult = this.validateComplexity(options.complexity)
    if (!complexityResult.isValid) {
      errors.push(...complexityResult.errors.map(e => `Complexity: ${e}`))
    } else {
      sanitized.complexity = complexityResult.sanitizedValue
    }
    
    // Validate passthrough args
    const passthroughResult = this.validatePassthroughArgs(options.passthroughArgs)
    if (!passthroughResult.isValid) {
      errors.push(...passthroughResult.errors.map(e => `Passthrough args: ${e}`))
    } else {
      sanitized.passthroughArgs = passthroughResult.sanitizedValue
    }
    
    // Validate custom Claude path
    if (options.customClaudePath) {
      const pathResult = this.validateFilePath(options.customClaudePath)
      if (!pathResult.isValid) {
        errors.push(...pathResult.errors.map(e => `Custom Claude path: ${e}`))
      } else {
        sanitized.customClaudePath = pathResult.sanitizedValue
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    }
  }
}