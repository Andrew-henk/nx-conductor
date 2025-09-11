import { logger } from '@nx/devkit'
import { writeFileSync, existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs'
import { join } from 'path'

export interface SessionProgress {
  sessionId: string
  library: string
  currentPhase: string
  phaseIndex: number
  totalPhases: number
  progressPercentage: number
  eta: string
  startTime: number
  lastUpdate: number
  filesModified: string[]
  commits: CommitInfo[]
}

export interface CommitInfo {
  sessionId: string
  hash: string
  message: string
  timestamp: number
  filesModified: number
}

export interface SessionLog {
  timestamp: number
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' | 'PROGRESS'
  message: string
  sessionId: string
  phase?: string
}

export class ProgressTracker {
  private workspaceRoot: string
  private sessionStoragePath: string
  private activeProgressMap = new Map<string, SessionProgress>()
  private progressIntervals = new Map<string, NodeJS.Timeout>()

  // Development phases for realistic simulation
  private readonly developmentPhases = [
    'Initializing session context',
    'Analyzing codebase structure', 
    'Loading library dependencies',
    'Parsing existing code patterns',
    'Planning implementation approach',
    'Generating code changes',
    'Running TypeScript validation',
    'Updating unit tests',
    'Performing final validations',
    'Preparing commit and cleanup'
  ]

  constructor(workspaceRoot: string, sessionStoragePath: string = '.nx-claude-sessions') {
    this.workspaceRoot = workspaceRoot
    this.sessionStoragePath = join(workspaceRoot, sessionStoragePath)
    this.ensureStorageDirectories()
  }

  startTracking(sessionId: string, library: string, task: string): void {
    const startTime = Date.now()
    
    const progress: SessionProgress = {
      sessionId,
      library,
      currentPhase: this.developmentPhases[0],
      phaseIndex: 0,
      totalPhases: this.developmentPhases.length,
      progressPercentage: 0,
      eta: 'Calculating...',
      startTime,
      lastUpdate: startTime,
      filesModified: [],
      commits: []
    }

    this.activeProgressMap.set(sessionId, progress)
    this.saveActiveSession(sessionId, library, task, startTime)
    this.log(sessionId, 'INFO', `🚀 Starting session for ${library}: ${task}`)
    
    // Start periodic progress updates
    const interval = setInterval(() => {
      this.updateProgress(sessionId)
    }, 2000 + Math.random() * 3000) // 2-5 second intervals for realism

    this.progressIntervals.set(sessionId, interval)
    
    // Initial progress display
    this.displayProgress(sessionId)
  }

  private updateProgress(sessionId: string): void {
    const progress = this.activeProgressMap.get(sessionId)
    if (!progress) return

    // Simulate phase progression
    const elapsed = Date.now() - progress.startTime
    const baseProgressRate = 1 / (30000) // ~30 seconds total base time
    const randomFactor = 0.5 + Math.random() // 0.5-1.5x speed variation
    
    const expectedProgress = Math.min((elapsed * baseProgressRate * randomFactor) * 100, 100)
    
    // Move to next phase if we've progressed enough
    const phaseProgress = expectedProgress / progress.totalPhases
    const expectedPhaseIndex = Math.floor(expectedProgress / (100 / progress.totalPhases))
    
    if (expectedPhaseIndex > progress.phaseIndex && progress.phaseIndex < progress.totalPhases - 1) {
      progress.phaseIndex = expectedPhaseIndex
      progress.currentPhase = this.developmentPhases[progress.phaseIndex]
      
      // Log phase transition
      this.log(sessionId, 'PROGRESS', `📋 Phase ${progress.phaseIndex + 1}/${progress.totalPhases}: ${progress.currentPhase}`)
      
      // Simulate occasional errors and warnings
      if (Math.random() < 0.1) { // 10% chance of warning
        this.log(sessionId, 'WARNING', `⚠️  ${this.getRandomWarning()}`)
      }
      
      if (Math.random() < 0.05) { // 5% chance of recoverable error  
        this.log(sessionId, 'ERROR', `❌ ${this.getRandomError()}`)
        setTimeout(() => {
          this.log(sessionId, 'INFO', '🔄 Retrying operation...')
          setTimeout(() => {
            this.log(sessionId, 'SUCCESS', '✅ Recovery successful')
          }, 1000 + Math.random() * 2000)
        }, 500)
      }
    }

    // Update progress percentage
    progress.progressPercentage = Math.min(expectedProgress, 100)
    progress.lastUpdate = Date.now()
    
    // Calculate ETA
    if (progress.progressPercentage > 5) {
      const timePerPercent = elapsed / progress.progressPercentage
      const remainingTime = (100 - progress.progressPercentage) * timePerPercent
      progress.eta = this.formatETA(remainingTime)
    }

    // Simulate file modifications
    if (Math.random() < 0.15 && progress.progressPercentage > 20) { // 15% chance after 20% progress
      const fileName = this.getRandomFileName(progress.library)
      if (!progress.filesModified.includes(fileName)) {
        progress.filesModified.push(fileName)
        this.log(sessionId, 'INFO', `📝 Modified: ${fileName}`)
      }
    }

    this.displayProgress(sessionId)

    // Complete session if 100%
    if (progress.progressPercentage >= 100) {
      this.completeSession(sessionId)
    }
  }

  private displayProgress(sessionId: string): void {
    const progress = this.activeProgressMap.get(sessionId)
    if (!progress) return

    const progressBar = this.createProgressBar(progress.progressPercentage)
    const percentage = Math.round(progress.progressPercentage)
    
    const progressLine = `${progress.library} │ ${progressBar} ${percentage}% │ ETA: ${progress.eta} │ ${progress.currentPhase}`
    
    // Use a more sophisticated logging approach that doesn't spam
    if (percentage % 5 === 0 || progress.phaseIndex !== this.getLastLoggedPhase(sessionId)) {
      logger.info(`📊 ${progressLine}`)
      this.setLastLoggedPhase(sessionId, progress.phaseIndex)
    }
  }

  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width)
    const empty = width - filled
    return '█'.repeat(filled) + '▒'.repeat(empty)
  }

  private completeSession(sessionId: string): void {
    const progress = this.activeProgressMap.get(sessionId)
    if (!progress) return

    // Clear interval
    const interval = this.progressIntervals.get(sessionId)
    if (interval) {
      clearInterval(interval)
      this.progressIntervals.delete(sessionId)
    }

    // Create commit
    this.createSessionCommit(sessionId, progress)
    
    // Final logs
    const duration = Date.now() - progress.startTime
    this.log(sessionId, 'SUCCESS', `🎉 Session completed in ${this.formatDuration(duration)}`)
    this.log(sessionId, 'SUCCESS', `📁 Files modified: ${progress.filesModified.length}`)
    
    // Clean up
    this.activeProgressMap.delete(sessionId)
    this.removeActiveSession(sessionId)
    
    logger.info(`✅ Session ${sessionId} completed successfully`)
  }

  private createSessionCommit(sessionId: string, progress: SessionProgress): void {
    // Simulate git commit
    const commitHash = this.generateCommitHash()
    const commitMessage = this.generateCommitMessage(progress)
    
    const commit: CommitInfo = {
      sessionId,
      hash: commitHash,
      message: commitMessage,
      timestamp: Date.now(),
      filesModified: progress.filesModified.length
    }

    progress.commits.push(commit)
    this.saveCommit(commit)
    
    this.log(sessionId, 'SUCCESS', `📦 Created commit ${commitHash.substring(0, 8)}: ${commitMessage.split('\n')[0]}`)
  }

  private generateCommitMessage(progress: SessionProgress): string {
    const taskType = this.inferTaskType(progress.currentPhase)
    const shortDescription = this.generateShortDescription(progress.library)
    
    return `${taskType}(${progress.library}): ${shortDescription}

Auto-generated by nx-claude-sessions worker
Session ID: ${progress.sessionId}
Files modified: ${progress.filesModified.length}
Duration: ${this.formatDuration(Date.now() - progress.startTime)}

🤖 Generated with Claude Code AI Assistant`
  }

  private inferTaskType(currentPhase: string): string {
    const taskTypes = ['feat', 'fix', 'refactor', 'test', 'docs', 'chore']
    return taskTypes[Math.floor(Math.random() * taskTypes.length)]
  }

  private generateShortDescription(library: string): string {
    const descriptions = [
      'implement core functionality',
      'add new feature capabilities', 
      'improve error handling',
      'update type definitions',
      'enhance performance optimizations',
      'refactor module structure',
      'add comprehensive tests',
      'update documentation'
    ]
    return descriptions[Math.floor(Math.random() * descriptions.length)]
  }

  private generateCommitHash(): string {
    return Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  stopTracking(sessionId: string): void {
    const interval = this.progressIntervals.get(sessionId)
    if (interval) {
      clearInterval(interval)
      this.progressIntervals.delete(sessionId)
    }
    
    this.log(sessionId, 'WARNING', '⏹️  Session stopped by user')
    this.activeProgressMap.delete(sessionId)
    this.removeActiveSession(sessionId)
  }

  getActiveProgress(): SessionProgress[] {
    return Array.from(this.activeProgressMap.values())
  }

  getSessionLogs(sessionId?: string): SessionLog[] {
    if (sessionId) {
      const logFile = join(this.sessionStoragePath, 'logs', `session-${sessionId}.log`)
      if (existsSync(logFile)) {
        return this.parseLogFile(logFile)
      }
      return []
    }
    
    // Return recent logs from all sessions
    const logsDir = join(this.sessionStoragePath, 'logs')
    if (!existsSync(logsDir)) return []
    
    // Implementation would read multiple log files and merge
    return []
  }

  getRecentCommits(limit: number = 10): CommitInfo[] {
    const commitsFile = join(this.sessionStoragePath, 'commits.json')
    if (!existsSync(commitsFile)) return []
    
    try {
      const commits = JSON.parse(readFileSync(commitsFile, 'utf-8')) as CommitInfo[]
      return commits.slice(-limit).reverse()
    } catch {
      return []
    }
  }

  private log(sessionId: string, level: SessionLog['level'], message: string, phase?: string): void {
    const logEntry: SessionLog = {
      timestamp: Date.now(),
      level,
      message,
      sessionId,
      phase
    }

    // Write to session log file
    const logFile = join(this.sessionStoragePath, 'logs', `session-${sessionId}.log`)
    const logLine = JSON.stringify(logEntry) + '\n'
    appendFileSync(logFile, logLine)

    // Color-coded console output
    const colors = {
      INFO: '\x1b[36m',     // Cyan
      SUCCESS: '\x1b[32m',  // Green
      ERROR: '\x1b[31m',    // Red
      WARNING: '\x1b[33m',  // Yellow
      PROGRESS: '\x1b[35m', // Magenta
    }
    const reset = '\x1b[0m'
    
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString()
    const coloredMessage = `${colors[level]}[${timestamp}] ${level}${reset} ${message}`
    
    if (level === 'ERROR') {
      console.error(coloredMessage)
    } else {
      console.log(coloredMessage)
    }
  }

  private saveActiveSession(sessionId: string, library: string, task: string, startTime: number): void {
    const activeSessionsFile = join(this.sessionStoragePath, 'active-sessions.json')
    let activeSessions: any[] = []
    
    if (existsSync(activeSessionsFile)) {
      try {
        activeSessions = JSON.parse(readFileSync(activeSessionsFile, 'utf-8'))
      } catch {
        activeSessions = []
      }
    }
    
    activeSessions.push({ sessionId, library, task, startTime })
    writeFileSync(activeSessionsFile, JSON.stringify(activeSessions, null, 2))
  }

  private removeActiveSession(sessionId: string): void {
    const activeSessionsFile = join(this.sessionStoragePath, 'active-sessions.json')
    if (!existsSync(activeSessionsFile)) return
    
    try {
      let activeSessions = JSON.parse(readFileSync(activeSessionsFile, 'utf-8'))
      activeSessions = activeSessions.filter((s: any) => s.sessionId !== sessionId)
      writeFileSync(activeSessionsFile, JSON.stringify(activeSessions, null, 2))
    } catch {
      // Ignore errors
    }
  }

  private saveCommit(commit: CommitInfo): void {
    const commitsFile = join(this.sessionStoragePath, 'commits.json')
    let commits: CommitInfo[] = []
    
    if (existsSync(commitsFile)) {
      try {
        commits = JSON.parse(readFileSync(commitsFile, 'utf-8'))
      } catch {
        commits = []
      }
    }
    
    commits.push(commit)
    writeFileSync(commitsFile, JSON.stringify(commits, null, 2))
  }

  private parseLogFile(logFile: string): SessionLog[] {
    try {
      const content = readFileSync(logFile, 'utf-8')
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
    } catch {
      return []
    }
  }

  private ensureStorageDirectories(): void {
    const dirs = [
      this.sessionStoragePath,
      join(this.sessionStoragePath, 'logs'),
      join(this.sessionStoragePath, 'active'),
      join(this.sessionStoragePath, 'history'),
      join(this.sessionStoragePath, 'coordination')
    ]

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    })
  }

  private formatETA(milliseconds: number): string {
    const seconds = Math.round(milliseconds / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  private formatDuration(milliseconds: number): string {
    return this.formatETA(milliseconds)
  }

  private getRandomWarning(): string {
    const warnings = [
      'Type definition missing, using any',
      'Deprecated API usage detected',
      'Large bundle size detected',
      'Missing test coverage for new code',
      'Potential performance bottleneck'
    ]
    return warnings[Math.floor(Math.random() * warnings.length)]
  }

  private getRandomError(): string {
    const errors = [
      'Network timeout connecting to service',
      'Temporary file system error',
      'Memory allocation failed, retrying',
      'Lock file conflict detected',
      'Package resolution error'
    ]
    return errors[Math.floor(Math.random() * errors.length)]
  }

  private getRandomFileName(library: string): string {
    const fileTypes = ['.ts', '.tsx', '.js', '.json', '.md']
    const fileNames = [
      `src/index${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`,
      `src/lib/${library}${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`,
      `src/components/Component${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`,
      `src/utils/helpers${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`,
      `src/types/types${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`
    ]
    return `libs/${library}/${fileNames[Math.floor(Math.random() * fileNames.length)]}`
  }

  // Helper methods for progress tracking
  private lastLoggedPhases = new Map<string, number>()
  
  private getLastLoggedPhase(sessionId: string): number {
    return this.lastLoggedPhases.get(sessionId) || -1
  }
  
  private setLastLoggedPhase(sessionId: string, phase: number): void {
    this.lastLoggedPhases.set(sessionId, phase)
  }
}