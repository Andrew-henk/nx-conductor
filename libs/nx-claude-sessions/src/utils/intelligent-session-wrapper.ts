import { logger } from '@nx/devkit'
import { McpIntegration } from './mcp-integration'
import { WorkingMemoryManager, SessionHandoff } from './working-memory'
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface SessionContext {
  sessionId: string
  library: string
  task: string
  workspaceRoot: string
  libraryContext: any
}

export interface ScopedCapture {
  content: string
  scope: 'workspace' | 'library'
}

export class IntelligentSessionWrapper {
  private mcpIntegration: McpIntegration
  private workingMemoryManager: WorkingMemoryManager
  private sessionContext: SessionContext
  private claudeProcess?: ChildProcess
  private outputBuffer: string = ''
  private decisionCaptures: (string | ScopedCapture)[] = []
  private patternCaptures: (string | ScopedCapture)[] = []
  private sessionStartTime: string

  constructor(sessionContext: SessionContext) {
    this.sessionContext = sessionContext
    this.mcpIntegration = new McpIntegration(sessionContext.workspaceRoot)
    this.workingMemoryManager = new WorkingMemoryManager(sessionContext.workspaceRoot)
    this.sessionStartTime = new Date().toISOString()
  }

  async startIntelligentSession(): Promise<{ success: boolean; sessionId: string; process?: ChildProcess }> {
    logger.info(`🧠 Starting intelligent Claude Code session for ${this.sessionContext.library}`)

    try {
      // Create session context file with accumulated knowledge
      await this.createEnhancedContextFile()

      // Start Claude Code process with session monitoring
      const claudeArgs = [
        'code',
        '--project', this.sessionContext.library,
        '--context', this.getContextFilePath(),
        '--session-id', this.sessionContext.sessionId
      ]

      // Add knowledge from previous sessions with hierarchical context
      const hierarchicalKnowledge = await this.mcpIntegration.getHierarchicalContext(this.sessionContext.library)
      
      const workspaceDecisions = hierarchicalKnowledge.workspace?.decisions?.length || 0
      const libraryDecisions = hierarchicalKnowledge.librarySpecific?.decisions?.length || 0
      const workspacePatterns = hierarchicalKnowledge.workspace?.patterns?.length || 0
      const libraryPatterns = hierarchicalKnowledge.librarySpecific?.patterns?.length || 0
      
      logger.info(`📚 Loading hierarchical knowledge:`)
      logger.info(`   Workspace decisions: ${workspaceDecisions}`)
      logger.info(`   Library decisions: ${libraryDecisions}`) 
      logger.info(`   Workspace patterns: ${workspacePatterns}`)
      logger.info(`   Library patterns: ${libraryPatterns}`)

      // Start Claude Code with enhanced monitoring
      this.claudeProcess = spawn('claude', claudeArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: this.sessionContext.sessionId,
          CLAUDE_LIBRARY: this.sessionContext.library,
          CLAUDE_WORKSPACE_ROOT: this.sessionContext.workspaceRoot
        }
      })

      // Set up real-time output monitoring for decision/pattern capture
      this.setupOutputMonitoring()

      // Set up session completion handlers
      this.setupCompletionHandlers()

      logger.info(`✅ Intelligent session started: ${this.sessionContext.sessionId}`)
      return {
        success: true,
        sessionId: this.sessionContext.sessionId,
        process: this.claudeProcess
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`❌ Failed to start intelligent session for ${this.sessionContext.library}: ${errorMessage}`)
      
      // Provide helpful context based on error type
      if (errorMessage.includes('ENOENT') || errorMessage.includes('command not found')) {
        logger.error('💡 Hint: Ensure Claude Code is installed and available in PATH')
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
        logger.error('💡 Hint: Check file permissions for the workspace and .nx-claude-sessions directory')
      } else if (errorMessage.includes('hierarchical')) {
        logger.error('💡 Hint: Hierarchical knowledge loading failed - session will start with basic context')
      }
      
      return { 
        success: false, 
        sessionId: this.sessionContext.sessionId
      }
    }
  }

  private async createEnhancedContextFile(): Promise<void> {
    const contextPath = this.getContextFilePath()
    const hierarchicalKnowledge = await this.mcpIntegration.getHierarchicalContext(this.sessionContext.library)

    const enhancedContext = `# Claude Code Session Context (Hierarchical)

## Current Task
**Library**: ${this.sessionContext.library}
**Task**: ${this.sessionContext.task}
**Session ID**: ${this.sessionContext.sessionId}

## Library Context
${this.sessionContext.libraryContext.documentation || 'No documentation available'}

## Workspace-Level Knowledge
**Scope**: Applies to entire workspace/monorepo

### Workspace Decisions
${this.formatPreviousDecisions(hierarchicalKnowledge.workspace?.decisions || [], 'workspace')}

### Workspace Patterns
${this.formatProvenPatterns(hierarchicalKnowledge.workspace?.patterns || [], 'workspace')}

## Library-Specific Knowledge
**Scope**: Applies specifically to ${this.sessionContext.library}

### Library Decisions
${this.formatPreviousDecisions(hierarchicalKnowledge.librarySpecific?.decisions || [], 'library')}

### Library Patterns  
${this.formatProvenPatterns(hierarchicalKnowledge.librarySpecific?.patterns || [], 'library')}

## Combined Session History
${this.formatCombinedSessionInsights(hierarchicalKnowledge.sessionHistory || {})}

## Working Memory (Current Session State)
${this.sessionContext.libraryContext.workingMemory || 'No working memory available'}

## Dependencies
${this.sessionContext.libraryContext.dependencies?.join(', ') || 'None'}

## Knowledge Inheritance Chain
This session inherits knowledge in this order:
1. **Workspace** (${hierarchicalKnowledge.workspace?.decisions?.length || 0} decisions, ${hierarchicalKnowledge.workspace?.patterns?.length || 0} patterns)
2. **${this.sessionContext.library}** (${hierarchicalKnowledge.librarySpecific?.decisions?.length || 0} decisions, ${hierarchicalKnowledge.librarySpecific?.patterns?.length || 0} patterns)

*Note: Library-specific knowledge takes precedence over workspace knowledge when conflicts arise.*

---

**Instructions for Claude Code:**
1. **Inheritance**: Build on both workspace-level and library-specific knowledge
2. **Precedence**: Library-specific decisions override workspace ones when applicable
3. **Scope Awareness**: Consider whether new decisions should apply at workspace or library level
4. **Documentation**: When making decisions, specify if they're workspace-wide or library-specific

**Knowledge Capture:**
- Prefix workspace decisions with "WORKSPACE-DECISION:"
- Prefix library decisions with "LIBRARY-DECISION:" or just "DECISION:"
- Prefix patterns with "PATTERN:" or "WORKSPACE-PATTERN:"
- Prefix key learnings with "LEARNING:"

**Working Memory Updates:**
- When you complete a task: "COMPLETED: [description]"
- When you're blocked: "BLOCKED: [description and reason]"
- When adding TODOs: "TODO: [what needs to be done]"
- When you have questions: "QUESTION: [what you need to know]"

This hierarchical system ensures proper knowledge inheritance and scope management, while working memory ensures session continuity.
`

    writeFileSync(contextPath, enhancedContext)
    logger.info(`📝 Created hierarchical context file: ${contextPath}`)
  }

  private setupOutputMonitoring(): void {
    if (!this.claudeProcess) return

    // Monitor stdout for decisions and patterns
    this.claudeProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      this.outputBuffer += output
      
      // Real-time capture of decisions, patterns, and working memory
      this.captureDecisionsFromOutput(output)
      this.capturePatternsFromOutput(output)
      this.captureWorkingMemoryFromOutput(output)
      
      // Forward output to user
      process.stdout.write(data)
    })

    // Monitor stderr
    this.claudeProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data)
    })
  }

  private setupCompletionHandlers(): void {
    if (!this.claudeProcess) return

    this.claudeProcess.on('close', async (code) => {
      logger.info(`🎯 Claude Code session completed with code: ${code}`)
      
      // Generate session handoff summary
      await this.generateSessionHandoff(code)
      
      // Extract and persist knowledge from the complete session
      await this.extractSessionKnowledge()
      
      // Mark session as completed for archival
      this.markSessionCompleted()
    })

    this.claudeProcess.on('error', (error) => {
      logger.error(`❌ Claude Code session error: ${error}`)
    })
  }

  private captureDecisionsFromOutput(output: string): void {
    // Capture workspace-level decisions
    const workspaceDecisionMatches = output.match(/WORKSPACE-DECISION:\s*(.+?)(?:\n|$)/gi)
    if (workspaceDecisionMatches) {
      workspaceDecisionMatches.forEach(match => {
        const decision = match.replace(/WORKSPACE-DECISION:\s*/i, '').trim()
        this.decisionCaptures.push({ content: decision, scope: 'workspace' })
        logger.info(`🏢 Captured workspace decision: ${decision}`)
      })
    }

    // Capture library-level decisions  
    const libraryDecisionMatches = output.match(/(?:LIBRARY-DECISION|DECISION):\s*(.+?)(?:\n|$)/gi)
    if (libraryDecisionMatches) {
      libraryDecisionMatches.forEach(match => {
        const decision = match.replace(/(?:LIBRARY-DECISION|DECISION):\s*/i, '').trim()
        this.decisionCaptures.push({ content: decision, scope: 'library' })
        logger.info(`📚 Captured library decision: ${decision}`)
      })
    }

    // Also capture natural language decisions (default to library scope)
    const naturalDecisions = [
      /I (?:decided|chose) to (.+?) because (.+?)[\.\n]/gi,
      /Let me use (.+?) instead of (.+?) because (.+?)[\.\n]/gi,
      /I'll implement (.+?) approach since (.+?)[\.\n]/gi
    ]

    naturalDecisions.forEach(pattern => {
      const matches = output.match(pattern)
      if (matches) {
        matches.forEach(match => {
          this.decisionCaptures.push({ content: match.trim(), scope: 'library' })
        })
      }
    })
  }

  private capturePatternsFromOutput(output: string): void {
    const patternMatches = output.match(/PATTERN:\s*(.+?)(?:\n|$)/gi)
    if (patternMatches) {
      patternMatches.forEach(match => {
        const pattern = match.replace(/PATTERN:\s*/i, '').trim()
        this.patternCaptures.push(pattern)
        logger.info(`🎨 Captured pattern: ${pattern}`)
      })
    }

    // Also capture code patterns
    const codePatterns = [
      /I(?:'ll|'m going to) create (?:a|an) (.+?) (?:utility|helper|component|function)/gi,
      /Let me (?:build|create|implement) (?:a|an) (.+?) that (.+?)[\.\n]/gi,
      /I'll add (?:a|an) (.+?) pattern for (.+?)[\.\n]/gi
    ]

    codePatterns.forEach(pattern => {
      const matches = output.match(pattern)
      if (matches) {
        matches.forEach(match => {
          this.patternCaptures.push(match.trim())
        })
      }
    })
  }

  private captureWorkingMemoryFromOutput(output: string): void {
    // Capture explicit working memory entries
    const completedMatches = output.match(/COMPLETED:\s*(.+?)(?:\n|$)/gi)
    if (completedMatches) {
      completedMatches.forEach(match => {
        const content = match.replace(/COMPLETED:\s*/i, '').trim()
        this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'completed',
          content
        }).catch(error => logger.warn(`Failed to add completed entry: ${error}`))
        logger.info(`✅ Captured completion: ${content}`)
      })
    }

    const blockedMatches = output.match(/BLOCKED:\s*(.+?)(?:\n|$)/gi)
    if (blockedMatches) {
      blockedMatches.forEach(match => {
        const content = match.replace(/BLOCKED:\s*/i, '').trim()
        this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'blocked',
          content
        }).catch(error => logger.warn(`Failed to add blocked entry: ${error}`))
        logger.info(`🚫 Captured blocked item: ${content}`)
      })
    }

    const todoMatches = output.match(/TODO:\s*(.+?)(?:\n|$)/gi)
    if (todoMatches) {
      todoMatches.forEach(match => {
        const content = match.replace(/TODO:\s*/i, '').trim()
        this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'todo',
          content
        }).catch(error => logger.warn(`Failed to add todo entry: ${error}`))
        logger.info(`📋 Captured TODO: ${content}`)
      })
    }

    const questionMatches = output.match(/QUESTION:\s*(.+?)(?:\n|$)/gi)
    if (questionMatches) {
      questionMatches.forEach(match => {
        const content = match.replace(/QUESTION:\s*/i, '').trim()
        this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'question',
          content
        }).catch(error => logger.warn(`Failed to add question entry: ${error}`))
        logger.info(`❓ Captured question: ${content}`)
      })
    }

    // Also capture natural language expressions
    const naturalCompletions = [
      /(?:I (?:have |)completed|I (?:have |)finished|Done with) (.+?)[\.\n]/gi,
      /✅ (.+?)[\.\n]/gi
    ]

    naturalCompletions.forEach(pattern => {
      const matches = output.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const content = match.replace(/^(?:I (?:have |)completed|I (?:have |)finished|Done with|✅)\s*/i, '').replace(/[\.\n]$/, '').trim()
          if (content && content.length > 3) {
            this.workingMemoryManager.addEntry(this.sessionContext.library, {
              sessionId: this.sessionContext.sessionId,
              type: 'completed',
              content
            }).catch(error => logger.warn(`Failed to add natural completion: ${error}`))
          }
        })
      }
    })
  }

  private async extractSessionKnowledge(): Promise<void> {
    logger.info('🧠 Extracting session knowledge...')

    try {
      // Extract knowledge from complete session output
      const sessionLearning = await this.mcpIntegration.extractSessionLearnings(
        this.sessionContext.sessionId,
        join(this.sessionContext.workspaceRoot, '.nx-claude-sessions', 'active', this.sessionContext.sessionId)
      )

      if (sessionLearning) {
        // Merge real-time captures with extracted learnings
        const decisionContents = this.decisionCaptures.map(d => typeof d === 'string' ? d : d.content)
        const patternContents = this.patternCaptures.map(p => typeof p === 'string' ? p : p.content)
        sessionLearning.keyDecisions = [...new Set([...sessionLearning.keyDecisions, ...decisionContents])]
        sessionLearning.patternsCreated = [...new Set([...sessionLearning.patternsCreated, ...patternContents])]

        // Record decisions from this session with proper scoping
        for (const decision of this.decisionCaptures) {
          const decisionContent = typeof decision === 'string' ? decision : decision.content
          const decisionScope = typeof decision === 'string' ? 'library' : decision.scope
          
          if (decisionScope === 'workspace') {
            // Record as workspace decision
            await this.mcpIntegration.recordWorkspaceDecision({
              title: decisionContent,
              description: `Workspace decision made during Claude Code session ${this.sessionContext.sessionId}`,
              reasoning: 'Captured from real-time session output - applies workspace-wide',
              impact: 'Workspace-wide',
              alternatives: [],
              context: {
                library: this.sessionContext.library,
                session: this.sessionContext.sessionId,
                timestamp: new Date().toISOString(),
                author: 'claude-code'
              },
              tags: ['real-time-capture', 'claude-code-session', 'workspace-scope']
            })
          } else {
            // Record as library decision
            await this.mcpIntegration.recordDecision({
              title: decisionContent,
              description: `Library decision made during Claude Code session ${this.sessionContext.sessionId}`,
              reasoning: 'Captured from real-time session output',
              impact: 'Library-specific',
              alternatives: [],
              context: {
                library: this.sessionContext.library,
                session: this.sessionContext.sessionId,
                timestamp: new Date().toISOString(),
                author: 'claude-code',
                scope: 'library'
              },
              tags: ['real-time-capture', 'claude-code-session', 'library-scope']
            })
          }
        }

        // Record patterns from this session (patterns can also be workspace-scoped)
        for (const pattern of this.patternCaptures) {
          const patternContent = typeof pattern === 'string' ? pattern : pattern.content
          const patternScope = typeof pattern === 'string' ? 'library' : pattern.scope || 'library'
          
          await this.mcpIntegration.recordPattern({
            name: patternContent,
            description: `Pattern created during Claude Code session ${this.sessionContext.sessionId}`,
            code: '// Code would need to be extracted from session files',
            language: 'typescript',
            context: {
              library: this.sessionContext.library,
              useCase: this.sessionContext.task,
              complexity: 'moderate' as const,
              scope: patternScope
            },
            tags: ['real-time-capture', 'claude-code-session', `${patternScope}-scope`],
            relatedPatterns: []
          })
        }

        const workspaceDecisions = this.decisionCaptures.filter(d => typeof d !== 'string' && d.scope === 'workspace').length
        const libraryDecisions = this.decisionCaptures.length - workspaceDecisions
        
        logger.info(`✅ Captured hierarchical knowledge:`)
        logger.info(`   Workspace decisions: ${workspaceDecisions}`)
        logger.info(`   Library decisions: ${libraryDecisions}`)
        logger.info(`   Patterns: ${this.patternCaptures.length}`)
      }
    } catch (error) {
      logger.warn(`⚠️ Failed to extract session knowledge: ${error}`)
    }
  }

  private markSessionCompleted(): void {
    const flagPath = join(
      this.sessionContext.workspaceRoot,
      '.nx-claude-sessions',
      'active',
      this.sessionContext.sessionId,
      'completed.flag'
    )

    try {
      writeFileSync(flagPath, JSON.stringify({
        completedAt: new Date().toISOString(),
        decisionsCaptures: this.decisionCaptures.length,
        patternsCaptures: this.patternCaptures.length,
        library: this.sessionContext.library,
        task: this.sessionContext.task
      }, null, 2))
    } catch (error) {
      logger.warn(`⚠️ Could not create completion flag: ${error}`)
    }
  }

  private getContextFilePath(): string {
    return join(
      this.sessionContext.workspaceRoot,
      '.nx-claude-sessions',
      'active',
      this.sessionContext.sessionId,
      'enhanced-context.md'
    )
  }

  private formatPreviousDecisions(decisions: any[], scope: string = 'library'): string {
    if (decisions.length === 0) return `No previous ${scope} decisions recorded.`

    return decisions.slice(0, 5).map(decision => `
### ${decision.title}
**Reasoning**: ${decision.reasoning}
**Impact**: ${decision.impact}
**Scope**: ${decision.context?.scope || scope}
**When**: ${new Date(decision.context.timestamp).toLocaleDateString()}
`).join('\n')
  }

  private formatProvenPatterns(patterns: any[], scope: string = 'library'): string {
    if (patterns.length === 0) return `No previous ${scope} patterns available.`

    return patterns.slice(0, 5).map(pattern => `
### ${pattern.name}
**Description**: ${pattern.description}
**Use Case**: ${pattern.context.useCase}
**Language**: ${pattern.language}
**Scope**: ${pattern.context?.scope || scope}
`).join('\n')
  }

  private formatCombinedSessionInsights(sessionHistory: any): string {
    if (!sessionHistory || (!sessionHistory.workspace?.length && !sessionHistory.library?.length)) {
      return 'No previous session insights.'
    }

    let insights = ''
    
    if (sessionHistory.workspace?.length > 0) {
      insights += '\n### Workspace Session History\n'
      insights += sessionHistory.workspace.slice(0, 2).map((session: any) => `
**${session.taskType}**: ${session.outcome}
- **Learnings**: ${session.lessonsLearned?.join(', ') || 'None recorded'}
- **Recommendations**: ${session.recommendations?.join(', ') || 'None recorded'}
`).join('\n')
    }

    if (sessionHistory.library?.length > 0) {
      insights += '\n### Library Session History\n'
      insights += sessionHistory.library.slice(0, 2).map((session: any) => `
**${session.taskType}**: ${session.outcome}  
- **Learnings**: ${session.lessonsLearned?.join(', ') || 'None recorded'}
- **Recommendations**: ${session.recommendations?.join(', ') || 'None recorded'}
`).join('\n')
    }

    return insights
  }

  private formatSessionInsights(sessionHistory: any[]): string {
    if (!sessionHistory || sessionHistory.length === 0) return 'No previous session insights.'

    const recentSessions = sessionHistory.slice(0, 3)
    return recentSessions.map(session => `
### Recent Session: ${session.taskType}
**Outcome**: ${session.outcome}
**Key Learnings**: ${session.lessonsLearned?.join(', ') || 'None recorded'}
**Recommendations**: ${session.recommendations?.join(', ') || 'None recorded'}
`).join('\n')
  }

  private async generateSessionHandoff(exitCode: number | null): Promise<void> {
    try {
      logger.info('📋 Generating session handoff summary...')
      
      // Create handoff from captured information
      const handoff: SessionHandoff = {
        sessionId: this.sessionContext.sessionId,
        library: this.sessionContext.library,
        startTime: this.sessionStartTime,
        endTime: new Date().toISOString(),
        taskDescription: this.sessionContext.task,
        completed: [],
        blocked: [],
        todos: [],
        questions: [],
        nextSteps: [],
        filesModified: [],
        testsStatus: 'not-run',
        buildStatus: exitCode === 0 ? 'success' : 'failed'
      }

      // Extract completed items from decision captures
      for (const capture of this.decisionCaptures) {
        const content = typeof capture === 'string' ? capture : capture.content
        if (content.toLowerCase().includes('completed') || content.toLowerCase().includes('finished')) {
          handoff.completed.push(content)
        } else if (content.toLowerCase().includes('blocked') || content.toLowerCase().includes('failed')) {
          handoff.blocked.push(content)
        } else if (content.toLowerCase().includes('todo') || content.toLowerCase().includes('next')) {
          handoff.todos.push(content)
        } else if (content.toLowerCase().includes('question') || content.includes('?')) {
          handoff.questions.push(content)
        }
      }

      // Extract patterns as next steps
      for (const pattern of this.patternCaptures) {
        const content = typeof pattern === 'string' ? pattern : pattern.content
        handoff.nextSteps.push(`Apply pattern: ${content}`)
      }

      // Add generic recommendations based on what was captured
      if (handoff.completed.length === 0 && handoff.blocked.length === 0) {
        handoff.nextSteps.push('Review session output to determine what was accomplished')
      }

      if (exitCode !== 0) {
        handoff.nextSteps.push('Investigate and resolve any build/execution errors')
      }

      // Add to working memory
      await this.workingMemoryManager.addHandoff(this.sessionContext.library, handoff)
      
      // Update working memory with findings
      for (const todo of handoff.todos) {
        await this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'todo',
          content: todo
        })
      }

      for (const blocked of handoff.blocked) {
        await this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'blocked',
          content: blocked
        })
      }

      for (const completed of handoff.completed) {
        await this.workingMemoryManager.addEntry(this.sessionContext.library, {
          sessionId: this.sessionContext.sessionId,
          type: 'completed',
          content: completed
        })
      }

      logger.info(`✅ Session handoff generated: ${handoff.completed.length} completed, ${handoff.todos.length} TODOs, ${handoff.blocked.length} blocked`)
      
    } catch (error) {
      logger.warn(`⚠️ Failed to generate session handoff: ${error}`)
    }
  }

  async terminateSession(): Promise<void> {
    if (this.claudeProcess) {
      logger.info('⏹️ Terminating intelligent session...')
      
      // Generate handoff before terminating
      await this.generateSessionHandoff(null)
      
      // Extract knowledge before terminating
      await this.extractSessionKnowledge()
      
      this.claudeProcess.kill()
      this.claudeProcess = undefined
      
      logger.info('✅ Session terminated and knowledge extracted')
    }
  }
}