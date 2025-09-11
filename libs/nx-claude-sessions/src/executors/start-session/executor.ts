import { ExecutorContext, logger, readProjectsConfigurationFromProjectGraph, createProjectGraphAsync } from '@nx/devkit'
import { StartSessionExecutorSchema } from './schema'
import { SessionPool } from '../../utils/session-pool'
import { LibraryContextLoader } from '../../utils/context-loader'
import { TaskDescriptor } from '../../types/session.types'

export default async function runExecutor(
  options: StartSessionExecutorSchema,
  context: ExecutorContext
) {
  logger.info(`🚀 Starting Claude Code session for library: ${options.library}`)
  
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
    
    logger.info('⏳ Requesting session slot...')
    const session = await sessionPool.requestSession(options.library, taskDescriptor, libraryContext, sessionOptions)
    
    logger.info('✅ Session started successfully!')
    logger.info(`   Session ID: ${session.id}`)
    logger.info(`   Status: ${session.status}`)
    logger.info(`   Started at: ${session.startTime.toISOString()}`)
    
    logger.info('')
    logger.info('📖 Session Context Summary:')
    logger.info(`   Library: ${libraryContext.library}`)
    logger.info(`   Task: ${taskDescriptor.description}`)
    logger.info(`   Type: ${taskDescriptor.type}`)
    logger.info(`   Priority: ${taskDescriptor.priority}`)
    logger.info(`   Complexity: ${taskDescriptor.estimatedComplexity}`)
    logger.info('')
    
    if (libraryContext.history.accumulatedKnowledge.patterns.length > 0) {
      logger.info('🧠 Available patterns from previous sessions:')
      libraryContext.history.accumulatedKnowledge.patterns.slice(0, 3).forEach(pattern => {
        logger.info(`   - ${pattern.pattern}: ${pattern.description}`)
      })
      logger.info('')
    }
    
    if (taskDescriptor.crossLibraryDependencies && taskDescriptor.crossLibraryDependencies.length > 0) {
      logger.info('🔗 Cross-library dependencies detected:')
      taskDescriptor.crossLibraryDependencies.forEach(dep => {
        logger.info(`   - ${dep}`)
      })
      logger.info('   Consider using orchestrate-feature for coordinated development')
      logger.info('')
    }
    
    return await waitForSessionCompletion(session, sessionPool)
    
  } catch (error) {
    logger.error(`❌ Failed to start session: ${error}`)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function waitForSessionCompletion(session: any, sessionPool: SessionPool): Promise<{ success: boolean; sessionId?: string; duration?: number }> {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const status = sessionPool.getActiveSessionsStatus().find(s => s.sessionId === session.id)
      
      if (!status) {
        clearInterval(checkInterval)
        const duration = Date.now() - session.startTime.getTime()
        
        logger.info('📊 Session completed!')
        logger.info(`   Duration: ${Math.round(duration / 1000)}s`)
        
        resolve({
          success: true,
          sessionId: session.id,
          duration
        })
      }
    }, 1000)
    
    process.on('SIGINT', () => {
      logger.info('🛑 Gracefully shutting down session...')
      clearInterval(checkInterval)
      sessionPool.terminateSession(session.id).then(() => {
        resolve({ success: false })
      })
    })
    
    setTimeout(() => {
      logger.warn('⏰ Session timeout reached, terminating...')
      clearInterval(checkInterval)
      sessionPool.terminateSession(session.id).then(() => {
        resolve({ success: false })
      })
    }, parseTimeout(session.contextLoaded.timeout || '30m'))
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