import { spawn, ChildProcess } from 'child_process'
import { logger } from '@nx/devkit'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { SessionInstance, LibraryContext, TaskDescriptor } from '../types/session.types'

export interface ClaudeCodeSession {
  process: ChildProcess
  sessionDir: string
  contextFile: string
  outputHandler: (data: string) => void
  rawMode?: boolean
  dangerousMode?: boolean
}

export interface ClaudeSessionOptions {
  passthroughArgs?: string[]
  dangerouslySkipPermissions?: boolean
  customClaudePath?: string
  rawMode?: boolean
}

export class ClaudeCodeIntegration {
  private workspaceRoot: string
  private sessionStoragePath: string

  constructor(workspaceRoot: string, sessionStoragePath: string = '.nx-claude-sessions') {
    this.workspaceRoot = workspaceRoot
    this.sessionStoragePath = join(workspaceRoot, sessionStoragePath)
    this.ensureStorageDirectories()
  }

  async startSession(session: SessionInstance, options?: ClaudeSessionOptions): Promise<ClaudeCodeSession> {
    const sessionDir = join(this.sessionStoragePath, 'active', session.id)
    
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }

    const contextFile = join(sessionDir, 'context.md')
    const contextContent = this.buildSessionContext(session.contextLoaded, session.taskDescriptor, session.library)
    
    writeFileSync(contextFile, contextContent)
    logger.info(`Context written to: ${contextFile}`)

    return await this.spawnClaudeCodeProcess(session, sessionDir, contextFile, options)
  }

  private async spawnClaudeCodeProcess(
    session: SessionInstance, 
    sessionDir: string, 
    contextFile: string,
    options?: ClaudeSessionOptions
  ): Promise<ClaudeCodeSession> {
    
    // Handle dangerous skip permissions mode
    if (options?.dangerouslySkipPermissions) {
      logger.warn('⚠️  DANGEROUS MODE: All permission checks disabled!')
      logger.warn('⚠️  This mode bypasses all safety validations!')
    }

    const claudeCodePath = options?.customClaudePath || await this.findClaudeCodeBinary()
    
    if (!claudeCodePath && !options?.dangerouslySkipPermissions) {
      logger.warn('Claude Code not found, starting simulation mode')
      return this.startSimulationMode(session, sessionDir, contextFile, options)
    }
    
    if (!claudeCodePath && options?.dangerouslySkipPermissions) {
      logger.error('⚠️  DANGEROUS MODE: No Claude Code binary found but permissions checks disabled')
      logger.error('⚠️  Attempting to continue anyway...')
    }

    logger.info(`Starting Claude Code session: ${session.id}`)
    
    // Build command arguments
    const baseArgs = options?.rawMode ? [] : [
      '--workspace', this.workspaceRoot,
      '--context-file', contextFile,
      '--session-id', session.id,
      '--library', session.library
    ]
    
    // Add passthrough arguments
    const allArgs = [
      ...baseArgs,
      ...(options?.passthroughArgs || [])
    ]
    
    if (options?.rawMode) {
      logger.info('🔧 Raw mode enabled - minimal NX context processing')
    }
    
    if (options?.passthroughArgs?.length) {
      logger.info(`🔗 Passthrough args: ${options.passthroughArgs.join(' ')}`)
    }
    
    const claudeProcess = spawn(claudeCodePath || 'claude-code', allArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.workspaceRoot,
      env: {
        ...process.env,
        NX_CLAUDE_SESSION_ID: session.id,
        NX_CLAUDE_LIBRARY: session.library,
        NX_CLAUDE_TASK_TYPE: session.taskDescriptor.type,
        NX_CLAUDE_DANGEROUS_MODE: options?.dangerouslySkipPermissions ? 'true' : 'false',
        NX_CLAUDE_RAW_MODE: options?.rawMode ? 'true' : 'false'
      }
    })

    const outputHandler = (data: string) => {
      logger.info(`[${session.id}] ${data.toString().trim()}`)
    }

    claudeProcess.stdout?.on('data', outputHandler)
    claudeProcess.stderr?.on('data', (data) => {
      logger.error(`[${session.id}] ${data.toString().trim()}`)
    })

    claudeProcess.on('error', (error) => {
      logger.error(`Session ${session.id} error: ${error.message}`)
    })

    return {
      process: claudeProcess,
      sessionDir,
      contextFile,
      outputHandler,
      rawMode: options?.rawMode,
      dangerousMode: options?.dangerouslySkipPermissions
    }
  }

  private async startSimulationMode(
    session: SessionInstance, 
    sessionDir: string, 
    contextFile: string,
    options?: ClaudeSessionOptions
  ): Promise<ClaudeCodeSession> {
    logger.info(`Starting simulation mode for session: ${session.id}`)
    
    // Create a mock process that simulates Claude Code behavior
    const mockProcess = spawn('node', ['-e', `
      console.log('🤖 Claude Code Simulation Mode');
      console.log('Session ID: ${session.id}');
      console.log('Library: ${session.library}');
      console.log('Task: ${session.taskDescriptor.description}');
      console.log('Context loaded from: ${contextFile}');
      console.log('');
      console.log('In production, this would:');
      console.log('1. Load the full library context');
      console.log('2. Start an interactive Claude Code session');
      console.log('3. Provide focused assistance for the specified task');
      console.log('4. Coordinate with other sessions as needed');
      console.log('');
      console.log('Session ready! (Press Ctrl+C to end)');
      
      // Keep process alive until manually terminated
      setInterval(() => {
        console.log('[${new Date().toISOString()}] Session ${session.id} active...');
      }, 30000);
    `], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.workspaceRoot
    })

    const outputHandler = (data: string) => {
      logger.info(`[${session.id}] ${data.toString().trim()}`)
    }

    mockProcess.stdout?.on('data', outputHandler)
    mockProcess.stderr?.on('data', (data) => {
      logger.error(`[${session.id}] ${data.toString().trim()}`)
    })

    return {
      process: mockProcess,
      sessionDir,
      contextFile,
      outputHandler,
      rawMode: options?.rawMode,
      dangerousMode: options?.dangerouslySkipPermissions
    }
  }

  private async findClaudeCodeBinary(): Promise<string | null> {
    const possiblePaths = [
      'claude-code',                    // In PATH
      '/usr/local/bin/claude-code',     // Global install
      join(process.env['HOME'] || '', '.local/bin/claude-code'), // User install
      join(process.env['HOME'] || '', 'bin/claude-code'),        // User bin
    ]

    for (const path of possiblePaths) {
      try {
        const { spawn } = require('child_process')
        const testProcess = spawn(path, ['--version'], { 
          stdio: 'ignore',
          timeout: 1000
        })
        
        const exitCode = await new Promise((resolve) => {
          testProcess.on('exit', resolve)
          testProcess.on('error', () => resolve(null))
        })

        if (exitCode === 0) {
          logger.info(`Found Claude Code at: ${path}`)
          return path
        }
      } catch {
        continue
      }
    }

    return null
  }

  private buildSessionContext(context: LibraryContext, task: TaskDescriptor, library: string): string {
    return `# Claude Code Session Context

## Session Information
- **Library**: ${library}
- **Task**: ${task.description}
- **Type**: ${task.type}
- **Priority**: ${task.priority}
- **Complexity**: ${task.estimatedComplexity}
- **Scope**: ${task.scope.join(', ')}

## Library Documentation
${context.primary.content}

## Dependencies
${context.dependencies.length > 0 ? context.dependencies.map(dep => `- ${dep}`).join('\n') : 'None'}

## Shared Resources
${this.formatSharedResources(context.shared)}

## Established Patterns
${this.formatPatterns(context.patterns)}

## Previous Session Insights
${this.formatSessionHistory(context.history)}

---

**Instructions**: Please focus on the specified task for this library. Use the established patterns and coordinate with other sessions for cross-library concerns.
`
  }

  private formatSharedResources(shared: any): string {
    const sections = []
    
    if (Object.keys(shared.types || {}).length > 0) {
      sections.push('### Types\n' + Object.entries(shared.types).map(([lib, types]) => 
        `- **${lib}**: ${types}`).join('\n'))
    }
    
    if (Object.keys(shared.utilities || {}).length > 0) {
      sections.push('### Utilities\n' + Object.entries(shared.utilities).map(([lib, utils]) => 
        `- **${lib}**: ${utils}`).join('\n'))
    }
    
    return sections.length > 0 ? sections.join('\n\n') : 'No shared resources detected'
  }

  private formatPatterns(patterns: any): string {
    const sections = []
    
    if (patterns.codingConventions?.length > 0) {
      sections.push('### Coding Conventions\n' + patterns.codingConventions.map((c: string) => `- ${c}`).join('\n'))
    }
    
    if (patterns.architecturalPatterns?.length > 0) {
      sections.push('### Architectural Patterns\n' + patterns.architecturalPatterns.map((p: string) => `- ${p}`).join('\n'))
    }
    
    return sections.length > 0 ? sections.join('\n\n') : 'No established patterns'
  }

  private formatSessionHistory(history: any): string {
    if (!history.recentSessions?.length) {
      return 'No previous sessions for this library.'
    }

    const recent = history.recentSessions.slice(0, 3).map((session: any) => 
      `- ${session.date}: ${session.taskType} (${session.outcome})`
    ).join('\n')

    const knowledge = history.accumulatedKnowledge || {}
    let patterns = ''
    
    if (knowledge.patterns?.length > 0) {
      patterns = '\n\n### Learned Patterns\n' + 
        knowledge.patterns.slice(0, 2).map((p: any) => `- ${p.pattern}: ${p.description}`).join('\n')
    }

    return `### Recent Sessions\n${recent}${patterns}`
  }

  private ensureStorageDirectories(): void {
    const dirs = [
      this.sessionStoragePath,
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

  async terminateSession(sessionId: string): Promise<void> {
    // In a real implementation, this would gracefully shut down the Claude Code process
    // and save any session state
    logger.info(`Terminating session: ${sessionId}`)
  }
}