import { logger } from '@nx/devkit'
import { SessionInstance, TaskDescriptor, LibraryContext, CompressedSessionHistory } from '../types/session.types'
import { ClaudeCodeIntegration, ClaudeCodeSession, ClaudeSessionOptions } from './claude-integration'

export interface SessionTask {
  library: string
  task: TaskDescriptor
  context: LibraryContext
  priority: number
  resolve: (session: SessionInstance) => void
  reject: (error: Error) => void
}

export class SessionPool {
  private maxConcurrency: number
  private activeSessionsMap = new Map<string, SessionInstance>()
  private claudeSessionsMap = new Map<string, ClaudeCodeSession>()
  private taskQueue: SessionTask[] = []
  private sessionIdCounter = 0
  private claudeIntegration: ClaudeCodeIntegration

  constructor(maxConcurrency: number = 5, workspaceRoot: string = process.cwd()) {
    this.maxConcurrency = maxConcurrency
    this.claudeIntegration = new ClaudeCodeIntegration(workspaceRoot)
  }

  async requestSession(library: string, task: TaskDescriptor, context: LibraryContext, sessionOptions?: ClaudeSessionOptions): Promise<SessionInstance> {
    return new Promise((resolve, reject) => {
      if (this.hasAvailableSlot()) {
        this.spawnSession(library, task, context, sessionOptions).then(resolve).catch(reject)
      } else {
        const priority = this.calculatePriority(library, task)
        const sessionTask: SessionTask = { library, task, context, priority, resolve, reject }
        this.queueTask(sessionTask)
      }
    })
  }

  private hasAvailableSlot(): boolean {
    return this.activeSessionsMap.size < this.maxConcurrency
  }

  private async spawnSession(library: string, task: TaskDescriptor, context: LibraryContext, sessionOptions?: ClaudeSessionOptions): Promise<SessionInstance> {
    const sessionId = `${library}-${++this.sessionIdCounter}-${Date.now()}`
    
    const session: SessionInstance = {
      id: sessionId,
      library,
      status: 'pending',
      startTime: new Date(),
      taskDescriptor: task,
      contextLoaded: context
    }

    try {
      session.status = 'active'
      const claudeSession = await this.startClaudeCodeSession(session, sessionOptions)
      session.claudeCodeProcess = claudeSession
      this.activeSessionsMap.set(sessionId, session)
      
      logger.info(`Started Claude Code session ${sessionId} for library ${library}`)
      return session
    } catch (error) {
      session.status = 'failed'
      session.endTime = new Date()
      throw new Error(`Failed to start session ${sessionId}: ${error}`)
    }
  }

  private async startClaudeCodeSession(session: SessionInstance, sessionOptions?: ClaudeSessionOptions): Promise<ClaudeCodeSession> {
    const claudeSession = await this.claudeIntegration.startSession(session, sessionOptions)
    
    this.claudeSessionsMap.set(session.id, claudeSession)

    claudeSession.process.on('exit', (code) => {
      this.handleSessionExit(session.id, code)
    })

    claudeSession.process.on('error', (error) => {
      logger.error(`Session ${session.id} error: ${error}`)
      this.handleSessionExit(session.id, 1)
    })

    return claudeSession
  }



  private calculatePriority(library: string, task: TaskDescriptor): number {
    let priority = task.priority

    if (task.crossLibraryDependencies && task.crossLibraryDependencies.length > 0) {
      priority += 10
    }

    if (task.estimatedComplexity === 'high') {
      priority += 5
    }

    if (task.type === 'bug-fix') {
      priority += 20
    }

    return priority
  }

  private queueTask(sessionTask: SessionTask): void {
    this.taskQueue.push(sessionTask)
    this.taskQueue.sort((a, b) => b.priority - a.priority)
    logger.info(`Queued session for ${sessionTask.library}, queue length: ${this.taskQueue.length}`)
  }

  private handleSessionExit(sessionId: string, exitCode: number | null): void {
    const session = this.activeSessionsMap.get(sessionId)
    if (!session) return

    session.endTime = new Date()
    session.status = exitCode === 0 ? 'completed' : 'failed'
    
    this.activeSessionsMap.delete(sessionId)
    this.claudeSessionsMap.delete(sessionId)
    logger.info(`Session ${sessionId} ended with status: ${session.status}`)

    this.processQueue()
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0 || !this.hasAvailableSlot()) {
      return
    }

    const nextTask = this.taskQueue.shift()!
    this.spawnSession(nextTask.library, nextTask.task, nextTask.context)
      .then(nextTask.resolve)
      .catch(nextTask.reject)
  }

  getActiveSessionsStatus(): { sessionId: string; library: string; status: string; duration: number }[] {
    return Array.from(this.activeSessionsMap.values()).map(session => ({
      sessionId: session.id,
      library: session.library,
      status: session.status,
      duration: Date.now() - session.startTime.getTime()
    }))
  }

  getQueueStatus(): { library: string; priority: number; waitTime: number }[] {
    const now = Date.now()
    return this.taskQueue.map(task => ({
      library: task.library,
      priority: task.priority,
      waitTime: now
    }))
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeSessionsMap.get(sessionId)
    const claudeSession = this.claudeSessionsMap.get(sessionId)
    
    if (!session || !claudeSession) {
      throw new Error(`Session ${sessionId} not found or not active`)
    }

    claudeSession.process.kill('SIGTERM')
    await this.claudeIntegration.terminateSession(sessionId)
    
    session.status = 'completed'
    session.endTime = new Date()
    this.activeSessionsMap.delete(sessionId)
    this.claudeSessionsMap.delete(sessionId)
    
    logger.info(`Terminated session ${sessionId}`)
    this.processQueue()
  }

  async shutdown(): Promise<void> {
    const activeSessions = Array.from(this.activeSessionsMap.values())
    
    await Promise.all(activeSessions.map(async session => {
      const claudeSession = this.claudeSessionsMap.get(session.id)
      if (claudeSession) {
        claudeSession.process.kill('SIGTERM')
        await this.claudeIntegration.terminateSession(session.id)
        session.status = 'completed'
        session.endTime = new Date()
      }
    }))

    this.activeSessionsMap.clear()
    this.claudeSessionsMap.clear()
    this.taskQueue.forEach(task => task.reject(new Error('Session pool shutdown')))
    this.taskQueue.length = 0

    logger.info('Session pool shutdown complete')
  }
}