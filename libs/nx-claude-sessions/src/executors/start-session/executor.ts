import { ExecutorContext, logger, readProjectsConfigurationFromProjectGraph, createProjectGraphAsync } from '@nx/devkit'
import { StartSessionExecutorSchema } from './schema'
import { SessionPool } from '../../utils/session-pool'
import { LibraryContextLoader } from '../../utils/context-loader'
import { IntelligentSessionWrapper } from '../../utils/intelligent-session-wrapper'
import { TaskDescriptor } from '../../types/session.types'
import { SessionModeDetector } from '../../utils/session-mode-detector'
import { ContextInjector } from '../../utils/context-injector'

export default async function runExecutor(
  options: StartSessionExecutorSchema,
  context: ExecutorContext
) {
  logger.info(`🚀 Starting Claude Code session for library: ${options.library}`)
  
  // Generate unique session ID early so it's available in error handling
  const sessionId = `${options.library}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  // 🧠 NEW: Detect session mode and adapt behavior
  const sessionDetection = SessionModeDetector.detect()
  
  if (sessionDetection.mode === 'context-injection') {
    logger.info('')
    logger.info('🎯 Context Injection Mode Detected!')
    logger.info('   → Running inside Claude Code or AI environment')
    logger.info('   → Will provide context instead of launching CLI')
    logger.info('')
    
    return await runContextInjectionMode(options, context, sessionId)
  }
  
  // Continue with traditional CLI launch mode
  logger.info('')
  logger.info('🖥️ CLI Launch Mode - Starting traditional session')
  logger.info('')
  
  try {
    const projectGraph = await createProjectGraphAsync()
    const projectsConfig = readProjectsConfigurationFromProjectGraph(projectGraph)
    
    if (!projectsConfig.projects[options.library]) {
      throw new Error(`Library '${options.library}' not found in workspace`)
    }

    const contextLoader = new LibraryContextLoader(context.root, projectGraph)
    
    if (options.contextRefresh) {
      contextLoader.clearCache()
      logger.info('Context cache cleared, forcing refresh')
    }
    
    logger.info('📋 Loading library context...')
    const libraryContext = await contextLoader.loadContext(options.library)
    
    const taskDescriptor: TaskDescriptor = {
      type: options.taskType || 'feature',
      description: options.task,
      scope: options.scope || [options.library],
      priority: options.priority || 50,
      estimatedComplexity: options.complexity || 'medium',
      crossLibraryDependencies: libraryContext.dependencies
    }
    
    logger.info('🎯 Context loaded successfully')
    logger.info(`   Dependencies: ${libraryContext.dependencies.join(', ') || 'None'}`)
    logger.info(`   Patterns: ${libraryContext.patterns.codingConventions.length} conventions`)
    logger.info(`   History: ${libraryContext.history.totalSessionCount} previous sessions`)
    
    const sessionPool = new SessionPool(5, context.root)
    
    // Handle dangerous mode warnings
    if (options.dangerouslySkipPermissions) {
      logger.warn('⚠️  DANGEROUS MODE ENABLED!')
      logger.warn('⚠️  All permission checks and safety validations will be bypassed!')
      logger.warn('⚠️  Use at your own risk!')
      logger.warn('')
    }
    
    // Build session options
    const sessionOptions = {
      passthroughArgs: options.passthroughArgs,
      dangerouslySkipPermissions: options.dangerouslySkipPermissions,
      customClaudePath: options.customClaudePath,
      rawMode: options.rawMode
    }
    
    if (options.rawMode) {
      logger.info('🔧 Raw mode enabled - minimal NX context will be provided')
    }
    
    if (options.customClaudePath) {
      logger.info(`🎯 Using custom Claude Code path: ${options.customClaudePath}`)
    }
    
    if (options.passthroughArgs?.length) {
      logger.info(`🔗 Passthrough arguments: ${options.passthroughArgs.join(' ')}`)
    }
    
    
    logger.info('📖 Session Context Summary:')
    logger.info(`   Library: ${libraryContext.library}`)
    logger.info(`   Task: ${taskDescriptor.description}`)
    logger.info(`   Type: ${taskDescriptor.type}`)
    logger.info(`   Priority: ${taskDescriptor.priority}`)
    logger.info(`   Complexity: ${taskDescriptor.estimatedComplexity}`)
    logger.info('')
    
    // Display hierarchical knowledge if available
    if (libraryContext.hierarchicalKnowledge) {
      const hk = libraryContext.hierarchicalKnowledge
      
      logger.info('🏢 Workspace Knowledge Available:')
      logger.info(`   Decisions: ${hk.workspace.decisions.length}`)
      logger.info(`   Patterns: ${hk.workspace.patterns.length}`)
      
      if (hk.workspace.decisions.length > 0) {
        hk.workspace.decisions.slice(0, 2).forEach((decision: any) => {
          logger.info(`   • ${decision.title}`)
        })
      }
      logger.info('')
      
      logger.info('📚 Library Knowledge Available:')
      logger.info(`   Decisions: ${hk.library.decisions.length}`)
      logger.info(`   Patterns: ${hk.library.patterns.length}`)
      
      if (hk.library.decisions.length > 0) {
        hk.library.decisions.slice(0, 2).forEach((decision: any) => {
          logger.info(`   • ${decision.title}`)
        })
      }
      
      if (hk.merged.inheritanceChain) {
        logger.info(`   Inheritance: ${hk.merged.inheritanceChain.join(' → ')}`)
      }
      logger.info('')
    } else {
      // Fallback to old pattern display
      if (libraryContext.history.accumulatedKnowledge.patterns.length > 0) {
        logger.info('🧠 Available patterns from previous sessions:')
        libraryContext.history.accumulatedKnowledge.patterns.slice(0, 3).forEach(pattern => {
          logger.info(`   - ${pattern.pattern}: ${pattern.description}`)
        })
        logger.info('')
      }
    }
    
    if (taskDescriptor.crossLibraryDependencies && taskDescriptor.crossLibraryDependencies.length > 0) {
      logger.info('🔗 Cross-library dependencies detected:')
      taskDescriptor.crossLibraryDependencies.forEach(dep => {
        logger.info(`   - ${dep}`)
      })
      logger.info('   Consider using orchestrate-feature for coordinated development')
      logger.info('')
    }

    // Use intelligent session wrapper instead of session pool
    const intelligentSession = new IntelligentSessionWrapper({
      sessionId,
      library: options.library,
      task: taskDescriptor.description,
      workspaceRoot: context.root,
      libraryContext
    })

    logger.info('⏳ Starting intelligent Claude Code session...')
    const sessionResult = await intelligentSession.startIntelligentSession()
    
    if (!sessionResult.success) {
      throw new Error(`Failed to start intelligent session: ${sessionId}`)
    }

    logger.info('✅ Intelligent session started successfully!')
    logger.info(`   Session ID: ${sessionId}`)
    logger.info(`   Enhanced with real-time knowledge capture`)
    logger.info('')

    // Set up session completion monitoring
    return await waitForIntelligentSessionCompletion(intelligentSession, sessionResult)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Failed to start session for library '${options.library}': ${errorMessage}`)
    
    // Provide specific guidance based on error type
    if (errorMessage.includes('not found in project graph') || errorMessage.includes('Library') && errorMessage.includes('not found')) {
      logger.error(`💡 Hint: Library '${options.library}' was not found in the NX project graph`)
      logger.error(`   Run 'nx show projects' to see available libraries`)
    } else if (errorMessage.includes('claude') && (errorMessage.includes('ENOENT') || errorMessage.includes('command not found'))) {
      logger.error('💡 Hint: Claude Code is not installed or not in PATH')
      logger.error('   Install Claude Code: npm install -g @anthropic/claude-code')
    } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      logger.error('💡 Hint: Permission denied - check file system permissions')
      logger.error('   Ensure the workspace directory and .nx-claude-sessions are writable')
    } else if (errorMessage.includes('hierarchical') || errorMessage.includes('knowledge')) {
      logger.error('💡 Hint: Knowledge loading failed - session will start with basic context only')
    }
    
    return { 
      success: false, 
      error: errorMessage,
      library: options.library,
      sessionId: sessionId
    }
  }
}

/**
 * NEW: Context Injection Mode - provides context instead of launching CLI
 */
async function runContextInjectionMode(
  options: StartSessionExecutorSchema,
  context: ExecutorContext,
  sessionId: string
): Promise<{ success: boolean; sessionId: string; mode: string; context?: any }> {
  try {
    const projectGraph = await createProjectGraphAsync()
    const projectsConfig = readProjectsConfigurationFromProjectGraph(projectGraph)
    
    if (!projectsConfig.projects[options.library]) {
      throw new Error(`Library '${options.library}' not found in workspace`)
    }

    // Create context injector
    const contextInjector = new ContextInjector(context.root, projectGraph)
    
    // Inject full context instead of launching CLI
    const injectionResult = await contextInjector.injectContext(options.library, options.task)
    
    if (!injectionResult.success) {
      throw new Error(injectionResult.error || 'Context injection failed')
    }

    // Format context for display
    const displayContext = formatContextForDisplay(injectionResult)
    
    logger.info('📋 CONTEXT INJECTION COMPLETE!')
    logger.info('================================')
    logger.info('')
    logger.info(displayContext)
    logger.info('')
    logger.info('🎯 You can now work directly with this context in your current Claude Code session!')
    logger.info('')
    
    // Return success with injected context
    return {
      success: true,
      sessionId,
      mode: 'context-injection',
      context: injectionResult
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Context injection failed for library '${options.library}': ${errorMessage}`)
    
    return {
      success: false,
      sessionId,
      mode: 'context-injection'
    }
  }
}

/**
 * Format injected context for readable display in Claude Code
 */
function formatContextForDisplay(injectionResult: any): string {
  let display = ''
  
  // Working Memory
  if (injectionResult.workingMemory) {
    display += '🧠 WORKING MEMORY:\n'
    display += '=================\n'
    display += injectionResult.workingMemory
    display += '\n\n'
  }
  
  // Suggestions
  if (injectionResult.suggestions && injectionResult.suggestions.length > 0) {
    display += '💡 INTELLIGENT SUGGESTIONS:\n'
    display += '==========================\n'
    injectionResult.suggestions.forEach((suggestion: string, index: number) => {
      display += `${index + 1}. ${suggestion}\n`
    })
    display += '\n'
  }
  
  // Next Actions
  if (injectionResult.nextActions && injectionResult.nextActions.length > 0) {
    display += '🎯 RECOMMENDED NEXT ACTIONS:\n'
    display += '===========================\n'
    injectionResult.nextActions.forEach((action: string, index: number) => {
      display += `${index + 1}. ${action}\n`
    })
    display += '\n'
  }
  
  // Orchestration Plan
  if (injectionResult.orchestrationPlan) {
    const plan = injectionResult.orchestrationPlan
    display += '🚀 ORCHESTRATION PLAN:\n'
    display += '=====================\n'
    display += `Task: ${plan.task}\n`
    display += `Complexity: ${plan.estimatedComplexity}\n`
    display += `Libraries: ${plan.libraries.join(', ')}\n`
    display += `Recommended Order: ${plan.recommendedOrder.join(' → ')}\n`
    display += '\nPhases:\n'
    plan.phases.forEach((phase: any, index: number) => {
      display += `${index + 1}. ${phase.name}: ${phase.description} (${phase.estimatedDuration})\n`
    })
    display += '\n'
  }
  
  // Hierarchical Knowledge Summary
  if (injectionResult.context?.hierarchicalKnowledge) {
    const hk = injectionResult.context.hierarchicalKnowledge
    display += '📚 HIERARCHICAL KNOWLEDGE:\n'
    display += '=========================\n'
    display += `Workspace Decisions: ${hk.workspace.decisions.length}\n`
    display += `Library Decisions: ${hk.library.decisions.length}\n`
    display += `Workspace Patterns: ${hk.workspace.patterns.length}\n`
    display += `Library Patterns: ${hk.library.patterns.length}\n`
    display += '\n'
  }
  
  // Dependencies
  if (injectionResult.context?.dependencies && injectionResult.context.dependencies.length > 0) {
    display += '🔗 DEPENDENCIES:\n'
    display += '===============\n'
    display += injectionResult.context.dependencies.join(', ')
    display += '\n\n'
  }
  
  return display
}

async function waitForIntelligentSessionCompletion(
  intelligentSession: IntelligentSessionWrapper, 
  sessionResult: { success: boolean; sessionId: string; process?: any }
): Promise<{ success: boolean; sessionId?: string; duration?: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    
    if (!sessionResult.process) {
      resolve({ success: false, sessionId: sessionResult.sessionId })
      return
    }

    // Monitor Claude Code process completion
    sessionResult.process.on('close', (code: number) => {
      const duration = Date.now() - startTime
      
      logger.info('📊 Intelligent session completed!')
      logger.info(`   Duration: ${Math.round(duration / 1000)}s`)
      logger.info(`   Exit code: ${code}`)
      logger.info('🧠 Knowledge captured and persisted automatically')
      
      resolve({
        success: code === 0,
        sessionId: sessionResult.sessionId,
        duration
      })
    })

    sessionResult.process.on('error', (error: Error) => {
      logger.error(`❌ Session process error: ${error}`)
      resolve({ success: false, sessionId: sessionResult.sessionId })
    })
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Gracefully shutting down intelligent session...')
      await intelligentSession.terminateSession()
      resolve({ success: false, sessionId: sessionResult.sessionId })
    })
    
    // Session timeout handling
    setTimeout(async () => {
      logger.warn('⏰ Session timeout reached, terminating...')
      await intelligentSession.terminateSession()
      resolve({ success: false, sessionId: sessionResult.sessionId })
    }, parseTimeout('30m')) // Default 30 minute timeout
  })
}

function parseTimeout(timeoutStr: string): number {
  const match = timeoutStr.match(/^(\d+)([smh])$/)
  if (!match) return 30 * 60 * 1000

  const [, value, unit] = match
  const num = parseInt(value, 10)
  
  switch (unit) {
    case 's': return num * 1000
    case 'm': return num * 60 * 1000
    case 'h': return num * 60 * 60 * 1000
    default: return 30 * 60 * 1000
  }
}