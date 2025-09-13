import { logger } from '@nx/devkit'

export type SessionMode = 'cli-launch' | 'context-injection' | 'hybrid'
export type SessionEnvironment = 'terminal' | 'claude-code' | 'vscode' | 'ci' | 'unknown'

export interface SessionDetection {
  mode: SessionMode
  environment: SessionEnvironment
  isInsideAI: boolean
  shouldLaunchCLI: boolean
  features: {
    canLaunchProcesses: boolean
    canInjectContext: boolean
    canTrackRealTime: boolean
    supportsWorkingMemory: boolean
  }
}

export class SessionModeDetector {
  
  static detect(): SessionDetection {
    const environment = this.detectEnvironment()
    const isInsideAI = this.isRunningInAI()
    
    logger.info(`🔍 Detected environment: ${environment}, AI context: ${isInsideAI}`)
    
    const detection: SessionDetection = {
      mode: this.determineMode(environment, isInsideAI),
      environment,
      isInsideAI,
      shouldLaunchCLI: !isInsideAI,
      features: this.getFeatures(environment, isInsideAI)
    }
    
    this.logDetection(detection)
    return detection
  }
  
  private static detectEnvironment(): SessionEnvironment {
    // Claude Code detection
    if (process.env['CLAUDE_CODE_SESSION'] || 
        process.env['ANTHROPIC_AGENT'] ||
        process.env['CLAUDE_SESSION'] ||
        process.env['CLAUDE_WORKSPACE'] ||
        process.cwd().includes('.claude') ||
        process.argv.some(arg => arg.includes('claude'))) {
      return 'claude-code'
    }
    
    // VS Code detection
    if (process.env['VSCODE_PID'] || 
        process.env['TERM_PROGRAM'] === 'vscode' ||
        process.env['VSCODE_INJECTION'] === '1') {
      return 'vscode'
    }
    
    // CI detection
    if (process.env['CI'] || 
        process.env['GITHUB_ACTIONS'] ||
        process.env['BUILDKITE'] ||
        process.env['JENKINS_URL']) {
      return 'ci'
    }
    
    // Terminal fallback
    if (process.env['TERM'] || process.env['SHELL']) {
      return 'terminal'
    }
    
    return 'unknown'
  }
  
  private static isRunningInAI(): boolean {
    // Multiple detection methods for AI environment
    const aiIndicators = [
      // Environment variables
      !!process.env['CLAUDE_CODE_SESSION'],
      !!process.env['ANTHROPIC_AGENT'],
      !!process.env['CLAUDE_SESSION'],
      !!process.env['AI_ASSISTANT'],
      
      // Process arguments
      process.argv.some(arg => 
        arg.includes('claude') || 
        arg.includes('anthropic') ||
        arg.includes('ai-agent')
      ),
      
      // Working directory hints
      process.cwd().includes('.claude') ||
      process.cwd().includes('anthropic') ||
      process.cwd().includes('ai-session'),
      
      // Process title hints
      process.title?.toLowerCase().includes('claude') ||
      process.title?.toLowerCase().includes('ai'),
      
      // Parent process detection (if available)
      this.detectParentProcess()
    ]
    
    return aiIndicators.some(indicator => indicator)
  }
  
  private static detectParentProcess(): boolean {
    try {
      // Try to detect if we're spawned from an AI process
      const parentPid = process.ppid
      if (!parentPid) return false
      
      // Additional parent process analysis could go here
      // For now, return false as we can't easily check parent process names
      return false
    } catch {
      return false
    }
  }
  
  private static determineMode(environment: SessionEnvironment, isInsideAI: boolean): SessionMode {
    if (isInsideAI || environment === 'claude-code') {
      return 'context-injection'
    }
    
    if (environment === 'ci') {
      return 'context-injection' // CI environments don't support interactive CLI
    }
    
    return 'cli-launch'
  }
  
  private static getFeatures(environment: SessionEnvironment, isInsideAI: boolean) {
    const base = {
      canLaunchProcesses: false,
      canInjectContext: true,
      canTrackRealTime: true,
      supportsWorkingMemory: true
    }
    
    if (isInsideAI || environment === 'claude-code') {
      return {
        ...base,
        canLaunchProcesses: false, // Don't spawn recursive Claude sessions
        canInjectContext: true,
        canTrackRealTime: true,
        supportsWorkingMemory: true
      }
    }
    
    if (environment === 'terminal') {
      return {
        ...base,
        canLaunchProcesses: true,
        canInjectContext: true,
        canTrackRealTime: false, // Limited in terminal
        supportsWorkingMemory: true
      }
    }
    
    if (environment === 'ci') {
      return {
        ...base,
        canLaunchProcesses: false,
        canInjectContext: true,
        canTrackRealTime: false,
        supportsWorkingMemory: true
      }
    }
    
    return base
  }
  
  private static logDetection(detection: SessionDetection): void {
    logger.info('')
    logger.info('🎯 Session Mode Detection Results:')
    logger.info(`   Mode: ${detection.mode}`)
    logger.info(`   Environment: ${detection.environment}`)
    logger.info(`   Inside AI: ${detection.isInsideAI ? '✅' : '❌'}`)
    logger.info(`   Should Launch CLI: ${detection.shouldLaunchCLI ? '✅' : '❌'}`)
    logger.info('')
    logger.info('🔧 Available Features:')
    logger.info(`   Launch Processes: ${detection.features.canLaunchProcesses ? '✅' : '❌'}`)
    logger.info(`   Inject Context: ${detection.features.canInjectContext ? '✅' : '❌'}`)
    logger.info(`   Real-time Tracking: ${detection.features.canTrackRealTime ? '✅' : '❌'}`)
    logger.info(`   Working Memory: ${detection.features.supportsWorkingMemory ? '✅' : '❌'}`)
    logger.info('')
    
    if (detection.mode === 'context-injection') {
      logger.info('🧠 Context Injection Mode Active')
      logger.info('   → Will provide context instead of launching CLI')
      logger.info('   → Working Memory available for real-time updates')
      logger.info('   → Orchestration planning without process spawning')
    }
  }
  
  /**
   * Quick check if we should avoid launching CLI processes
   */
  static shouldAvoidCLI(): boolean {
    const detection = this.detect()
    return !detection.shouldLaunchCLI
  }
  
  /**
   * Quick check if we should use context injection mode
   */
  static shouldUseContextInjection(): boolean {
    const detection = this.detect()
    return detection.mode === 'context-injection'
  }
  
  /**
   * Get recommended behavior based on environment
   */
  static getRecommendedAction(task: string): 'inject-context' | 'launch-cli' | 'hybrid' {
    const detection = this.detect()
    
    if (detection.isInsideAI) {
      return 'inject-context'
    }
    
    if (detection.environment === 'ci') {
      return 'inject-context'
    }
    
    // For complex multi-library tasks, might want hybrid approach
    if (task.toLowerCase().includes('orchestrat') && detection.features.canLaunchProcesses) {
      return 'hybrid'
    }
    
    return detection.features.canLaunchProcesses ? 'launch-cli' : 'inject-context'
  }
}