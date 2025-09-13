import { logger } from '@nx/devkit'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface WorkingMemoryEntry {
  timestamp: string
  sessionId: string
  type: 'todo' | 'completed' | 'blocked' | 'question' | 'decision' | 'change'
  content: string
  metadata?: Record<string, any>
}

export interface SessionHandoff {
  sessionId: string
  library: string
  startTime: string
  endTime: string
  taskDescription: string
  completed: string[]
  blocked: string[]
  todos: string[]
  questions: string[]
  nextSteps: string[]
  filesModified: string[]
  testsStatus?: 'passing' | 'failing' | 'not-run'
  buildStatus?: 'success' | 'failed' | 'not-run'
}

export interface LibraryWorkingMemory {
  library: string
  lastUpdated: string
  currentTodos: WorkingMemoryEntry[]
  recentChanges: WorkingMemoryEntry[]
  openQuestions: WorkingMemoryEntry[]
  blockedItems: WorkingMemoryEntry[]
  recentHandoffs: SessionHandoff[]
  currentContext: string
}

export class WorkingMemoryManager {
  private workspaceRoot: string
  private memoryCache: Map<string, LibraryWorkingMemory> = new Map()
  private readonly MAX_ENTRIES_PER_TYPE = 20
  private readonly MAX_HANDOFFS = 5
  private readonly MAX_CONTEXT_LENGTH = 5000

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  /**
   * Get or create working memory for a library
   */
  async getWorkingMemory(library: string): Promise<LibraryWorkingMemory> {
    if (this.memoryCache.has(library)) {
      return this.memoryCache.get(library)!
    }

    const memoryPath = this.getMemoryPath(library)
    
    if (existsSync(memoryPath)) {
      try {
        const rawMemory = JSON.parse(readFileSync(memoryPath, 'utf-8'))
        // Validate and ensure all required arrays exist
        const memory: LibraryWorkingMemory = {
          library: rawMemory.library || library,
          lastUpdated: rawMemory.lastUpdated || new Date().toISOString(),
          currentTodos: Array.isArray(rawMemory.currentTodos) ? rawMemory.currentTodos : [],
          recentChanges: Array.isArray(rawMemory.recentChanges) ? rawMemory.recentChanges : [],
          openQuestions: Array.isArray(rawMemory.openQuestions) ? rawMemory.openQuestions : [],
          blockedItems: Array.isArray(rawMemory.blockedItems) ? rawMemory.blockedItems : [],
          recentHandoffs: Array.isArray(rawMemory.recentHandoffs) ? rawMemory.recentHandoffs : [],
          currentContext: rawMemory.currentContext || ''
        }
        this.memoryCache.set(library, memory)
        return memory
      } catch (error) {
        logger.warn(`Failed to load working memory for ${library}, creating new`)
      }
    }

    // Create new working memory
    const newMemory: LibraryWorkingMemory = {
      library,
      lastUpdated: new Date().toISOString(),
      currentTodos: [],
      recentChanges: [],
      openQuestions: [],
      blockedItems: [],
      recentHandoffs: [],
      currentContext: ''
    }

    this.memoryCache.set(library, newMemory)
    await this.saveWorkingMemory(library)
    return newMemory
  }

  /**
   * Add an entry to working memory
   */
  async addEntry(library: string, entry: Omit<WorkingMemoryEntry, 'timestamp'>): Promise<void> {
    const memory = await this.getWorkingMemory(library)
    const timestampedEntry: WorkingMemoryEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    switch (entry.type) {
      case 'todo':
        memory.currentTodos.unshift(timestampedEntry)
        memory.currentTodos = memory.currentTodos.slice(0, this.MAX_ENTRIES_PER_TYPE)
        break
      case 'completed':
        // Remove from todos if exists (with safety check)
        memory.currentTodos = Array.isArray(memory.currentTodos)
          ? memory.currentTodos.filter(todo => todo && todo.content && todo.content !== entry.content)
          : []
        memory.recentChanges.unshift(timestampedEntry)
        memory.recentChanges = memory.recentChanges.slice(0, this.MAX_ENTRIES_PER_TYPE)
        break
      case 'blocked':
        memory.blockedItems.unshift(timestampedEntry)
        memory.blockedItems = memory.blockedItems.slice(0, this.MAX_ENTRIES_PER_TYPE)
        break
      case 'question':
        memory.openQuestions.unshift(timestampedEntry)
        memory.openQuestions = memory.openQuestions.slice(0, this.MAX_ENTRIES_PER_TYPE)
        break
      case 'change':
        memory.recentChanges.unshift(timestampedEntry)
        memory.recentChanges = memory.recentChanges.slice(0, this.MAX_ENTRIES_PER_TYPE)
        break
      case 'decision':
        memory.recentChanges.unshift(timestampedEntry)
        memory.recentChanges = memory.recentChanges.slice(0, this.MAX_ENTRIES_PER_TYPE)
        break
    }

    memory.lastUpdated = new Date().toISOString()
    await this.saveWorkingMemory(library)
  }

  /**
   * Add a session handoff summary
   */
  async addHandoff(library: string, handoff: SessionHandoff): Promise<void> {
    const memory = await this.getWorkingMemory(library)
    
    memory.recentHandoffs.unshift(handoff)
    memory.recentHandoffs = memory.recentHandoffs.slice(0, this.MAX_HANDOFFS)
    
    // Update current context with handoff summary
    const handoffSummary = this.formatHandoffSummary(handoff)
    memory.currentContext = await this.updateCurrentContext(memory.currentContext, handoffSummary)
    
    memory.lastUpdated = new Date().toISOString()
    await this.saveWorkingMemory(library)
  }

  /**
   * Generate working memory context for a new session
   */
  async generateSessionContext(library: string): Promise<string> {
    const memory = await this.getWorkingMemory(library)
    
    let context = `# Working Memory for ${library}\n\n`
    context += `Last Updated: ${new Date(memory.lastUpdated).toLocaleString()}\n\n`

    // Current context summary
    if (memory.currentContext) {
      context += `## Current State\n${memory.currentContext}\n\n`
    }

    // Active TODOs
    if (Array.isArray(memory.currentTodos) && memory.currentTodos.length > 0) {
      context += `## 📋 Active TODOs\n`
      memory.currentTodos.slice(0, 10).forEach(todo => {
        if (todo && todo.content) {
          context += `- ${todo.content} (from session: ${todo.sessionId || 'unknown'})\n`
        }
      })
      context += '\n'
    }

    // Blocked items that need resolution
    if (Array.isArray(memory.blockedItems) && memory.blockedItems.length > 0) {
      context += `## 🚫 Blocked Items\n`
      memory.blockedItems.slice(0, 5).forEach(blocked => {
        if (blocked && blocked.content) {
          context += `- ${blocked.content}\n`
        }
      })
      context += '\n'
    }

    // Open questions
    if (Array.isArray(memory.openQuestions) && memory.openQuestions.length > 0) {
      context += `## ❓ Open Questions\n`
      memory.openQuestions.slice(0, 5).forEach(question => {
        if (question && question.content) {
          context += `- ${question.content}\n`
        }
      })
      context += '\n'
    }

    // Recent changes for context
    if (Array.isArray(memory.recentChanges) && memory.recentChanges.length > 0) {
      context += `## 🔄 Recent Changes\n`
      memory.recentChanges.slice(0, 10).forEach(change => {
        if (change && change.content && change.timestamp) {
          const timeAgo = this.getTimeAgo(new Date(change.timestamp))
          context += `- ${change.content} (${timeAgo})\n`
        }
      })
      context += '\n'
    }

    // Most recent handoff
    if (Array.isArray(memory.recentHandoffs) && memory.recentHandoffs.length > 0) {
      const lastHandoff = memory.recentHandoffs[0]
      if (lastHandoff) {
        context += `## 📝 Last Session Summary\n`
        context += this.formatHandoffSummary(lastHandoff)
        context += '\n'
      }
    }

    return context
  }

  /**
   * Clear completed TODOs older than specified hours
   */
  async cleanupOldEntries(library: string, hoursOld: number = 72): Promise<void> {
    const memory = await this.getWorkingMemory(library)
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000)

    // Clean up old entries with safety checks
    memory.currentTodos = Array.isArray(memory.currentTodos) 
      ? memory.currentTodos.filter(todo => todo && todo.timestamp && new Date(todo.timestamp) > cutoffTime)
      : []
    memory.recentChanges = Array.isArray(memory.recentChanges)
      ? memory.recentChanges.filter(change => change && change.timestamp && new Date(change.timestamp) > cutoffTime)
      : []
    memory.openQuestions = Array.isArray(memory.openQuestions)
      ? memory.openQuestions.filter(question => question && question.timestamp && new Date(question.timestamp) > cutoffTime)
      : []

    await this.saveWorkingMemory(library)
  }

  /**
   * Auto-summarize context when it gets too long
   */
  private async updateCurrentContext(current: string, newContent: string): Promise<string> {
    const combined = `${current}\n\n${newContent}`.trim()
    
    if (combined.length <= this.MAX_CONTEXT_LENGTH) {
      return combined
    }

    // Simple summarization: keep the most recent content and summarize older
    const sections = combined.split('\n\n')
    const recentSections = sections.slice(-3) // Keep last 3 sections
    const olderSections = sections.slice(0, -3)
    
    let summary = ''
    if (olderSections.length > 0) {
      summary = `[Previous Context Summary]\n`
      summary += `- ${olderSections.length} older sections summarized\n`
      summary += `- Key points: ${this.extractKeyPoints(olderSections.join(' ')).join(', ')}\n\n`
    }
    
    return summary + recentSections.join('\n\n')
  }

  private extractKeyPoints(text: string): string[] {
    // Simple key point extraction - in production, could use AI
    const points: string[] = []
    
    // Extract completed items
    const completed = text.match(/completed:?\s*([^.!?\n]+)/gi) || []
    points.push(...completed.slice(0, 2).map(c => c.replace(/completed:?\s*/i, '').trim()))
    
    // Extract decisions
    const decisions = text.match(/decided?\s*to\s*([^.!?\n]+)/gi) || []
    points.push(...decisions.slice(0, 2).map(d => d.replace(/decided?\s*to\s*/i, '').trim()))
    
    return points.slice(0, 5)
  }

  private formatHandoffSummary(handoff: SessionHandoff): string {
    let summary = `### Session ${handoff.sessionId}\n`
    summary += `**Task**: ${handoff.taskDescription}\n`
    summary += `**Duration**: ${this.getDuration(handoff.startTime, handoff.endTime)}\n\n`
    
    if (handoff.completed.length > 0) {
      summary += `**Completed**:\n${handoff.completed.map(c => `- ${c}`).join('\n')}\n\n`
    }
    
    if (handoff.blocked.length > 0) {
      summary += `**Blocked**:\n${handoff.blocked.map(b => `- 🚫 ${b}`).join('\n')}\n\n`
    }
    
    if (handoff.todos.length > 0) {
      summary += `**Remaining TODOs**:\n${handoff.todos.map(t => `- [ ] ${t}`).join('\n')}\n\n`
    }
    
    if (handoff.nextSteps.length > 0) {
      summary += `**Recommended Next Steps**:\n${handoff.nextSteps.map(n => `1. ${n}`).join('\n')}\n\n`
    }
    
    if (handoff.testsStatus) {
      summary += `**Tests**: ${handoff.testsStatus === 'passing' ? '✅' : '❌'} ${handoff.testsStatus}\n`
    }
    
    if (handoff.buildStatus) {
      summary += `**Build**: ${handoff.buildStatus === 'success' ? '✅' : '❌'} ${handoff.buildStatus}\n`
    }
    
    return summary
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  private getDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const minutes = Math.floor(ms / 60000)
    
    if (minutes < 60) return `${minutes} minutes`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  }

  private getMemoryPath(library: string): string {
    const dir = join(this.workspaceRoot, '.nx-claude-sessions', 'memory')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    // Sanitize library name for filesystem compatibility
    const sanitizedLibrary = this.sanitizeLibraryName(library)
    return join(dir, `${sanitizedLibrary}.working-memory.json`)
  }

  /**
   * Sanitize library name for safe filesystem usage
   * @param library - Library name (e.g., "@manuscript/editor-core" or "editor-core")
   * @returns Safe filename (e.g., "manuscript-editor-core" or "editor-core")
   */
  private sanitizeLibraryName(library: string): string {
    return library
      .replace(/[@/]/g, '-')  // Replace @ and / with -
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .replace(/-+/g, '-')     // Replace multiple dashes with single dash
      .toLowerCase()
  }

  private async saveWorkingMemory(library: string): Promise<void> {
    const memory = this.memoryCache.get(library)
    if (!memory) return

    const path = this.getMemoryPath(library)
    writeFileSync(path, JSON.stringify(memory, null, 2))
  }

  /**
   * Generate handoff from session artifacts
   */
  async generateHandoffFromSession(
    sessionId: string,
    library: string,
    sessionPath: string
  ): Promise<SessionHandoff> {
    // Extract information from session artifacts
    const handoff: SessionHandoff = {
      sessionId,
      library,
      startTime: new Date().toISOString(), // Would be extracted from session
      endTime: new Date().toISOString(),
      taskDescription: 'Session task', // Would be extracted
      completed: [],
      blocked: [],
      todos: [],
      questions: [],
      nextSteps: [],
      filesModified: [],
      testsStatus: 'not-run',
      buildStatus: 'not-run'
    }

    // Try to extract from session artifacts
    const summaryPath = join(sessionPath, 'session-summary.json')
    if (existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'))
        Object.assign(handoff, summary)
      } catch (error) {
        logger.warn(`Failed to load session summary for ${sessionId}`)
      }
    }

    return handoff
  }
}