import { ExecutorContext, logger, createProjectGraphAsync } from '@nx/devkit'
import { MemoryExecutorSchema } from './schema'
import { WorkingMemoryManager } from '../../utils/working-memory'
import { SessionModeDetector } from '../../utils/session-mode-detector'
import { ContextInjector } from '../../utils/context-injector'

/**
 * Resolve library name to handle both short and full names
 */
function resolveLibraryName(library: string, context: ExecutorContext): string {
  // For now, return the library as-is since we don't have project graph access here
  // The proper resolution will happen in the context loader
  return library
}

export default async function runExecutor(
  options: MemoryExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean; result?: any }> {
  
  // Detect session mode
  const detection = SessionModeDetector.detect()
  
  // Resolve library name if provided
  const resolvedLibrary = options.library ? resolveLibraryName(options.library, context) : undefined
  
  logger.info('')
  logger.info('🧠 Working Memory Operations')
  logger.info('============================')
  logger.info(`Command: ${options.command}`)
  logger.info(`Library: ${resolvedLibrary || 'workspace'}`)
  logger.info(`Mode: ${detection.mode}`)
  logger.info('')

  try {
    const workingMemoryManager = new WorkingMemoryManager(context.root)
    const sessionId = `memory-op-${Date.now()}`

    // Create options object with resolved library
    const resolvedOptions = { ...options, library: resolvedLibrary }

    switch (options.command) {
      case 'update':
        return await updateMemory(workingMemoryManager, resolvedOptions, sessionId)
      
      case 'show':
        return await showMemory(workingMemoryManager, resolvedOptions)
      
      case 'track':
        return await trackProgress(workingMemoryManager, resolvedOptions, sessionId)
      
      case 'suggest-next':
        return await suggestNext(context, resolvedOptions)
      
      case 'find-related':
        return await findRelated(workingMemoryManager, resolvedOptions)
      
      case 'checkpoint':
        return await createCheckpoint(workingMemoryManager, resolvedOptions, sessionId)
      
      case 'cleanup':
        return await cleanupMemory(workingMemoryManager, resolvedOptions)
      
      default:
        throw new Error(`Unknown memory command: ${options.command}`)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Memory operation failed: ${errorMessage}`)
    
    return {
      success: false
    }
  }
}

async function updateMemory(
  manager: WorkingMemoryManager, 
  options: MemoryExecutorSchema,
  sessionId: string
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for memory updates')
  }

  const type = options.type || 'completed'
  const content = options.content || 'Memory update from nx memory:update'

  await manager.addEntry(options.library, {
    sessionId,
    type: type as 'todo' | 'completed' | 'blocked' | 'question',
    content
  })

  logger.info(`✅ Added ${type.toUpperCase()}: ${content}`)
  logger.info('')

  // Show updated memory
  const updatedMemory = await manager.generateSessionContext(options.library)
  logger.info('📋 Updated Working Memory:')
  logger.info(updatedMemory)

  return { success: true, result: { type, content, library: options.library } }
}

async function showMemory(
  manager: WorkingMemoryManager,
  options: MemoryExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required to show memory')
  }

  const memory = await manager.generateSessionContext(options.library)
  
  logger.info(`📋 Working Memory for ${options.library}:`)
  logger.info('=====================================')
  logger.info('')
  logger.info(memory)

  return { success: true, result: memory }
}

async function trackProgress(
  manager: WorkingMemoryManager,
  options: MemoryExecutorSchema,
  sessionId: string
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for progress tracking')
  }

  const status = options.content || 'Progress checkpoint'
  
  await manager.addEntry(options.library, {
    sessionId,
    type: 'change',
    content: `Progress: ${status}`
  })

  logger.info(`📊 Progress tracked: ${status}`)
  
  return { success: true, result: { status, library: options.library } }
}

async function suggestNext(
  context: ExecutorContext,
  options: MemoryExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for suggestions')
  }

  const projectGraph = await createProjectGraphAsync()
  const contextInjector = new ContextInjector(context.root, projectGraph)
  
  const injectionResult = await contextInjector.injectContext(options.library)
  
  logger.info('💡 AI Suggestions Based on Working Memory:')
  logger.info('==========================================')
  logger.info('')
  
  if (injectionResult.suggestions.length > 0) {
    injectionResult.suggestions.forEach((suggestion, index) => {
      logger.info(`${index + 1}. ${suggestion}`)
    })
  } else {
    logger.info('No specific suggestions available. Consider reviewing working memory.')
  }
  
  logger.info('')
  
  if (injectionResult.nextActions.length > 0) {
    logger.info('🎯 Recommended Next Actions:')
    injectionResult.nextActions.forEach((action, index) => {
      logger.info(`${index + 1}. ${action}`)
    })
    logger.info('')
  }

  return { 
    success: true, 
    result: { 
      suggestions: injectionResult.suggestions,
      nextActions: injectionResult.nextActions
    }
  }
}

async function findRelated(
  manager: WorkingMemoryManager,
  options: MemoryExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library || !options.query) {
    throw new Error('Library and query are required for search')
  }

  const memory = await manager.getWorkingMemory(options.library)
  const query = options.query.toLowerCase()
  
  // Simple search through all memory entries with safety checks
  const allEntries = [
    ...(Array.isArray(memory.currentTodos) ? memory.currentTodos : []),
    ...(Array.isArray(memory.recentChanges) ? memory.recentChanges : []),
    ...(Array.isArray(memory.openQuestions) ? memory.openQuestions : []),
    ...(Array.isArray(memory.blockedItems) ? memory.blockedItems : [])
  ]
  
  const related = allEntries.filter(entry => 
    entry && entry.content && entry.content.toLowerCase().includes(query)
  )
  
  logger.info(`🔍 Related items for "${options.query}":`)
  logger.info('=====================================')
  logger.info('')
  
  if (related.length === 0) {
    logger.info('No related items found.')
  } else {
    related.forEach((item, index) => {
      const timeAgo = getTimeAgo(new Date(item.timestamp))
      logger.info(`${index + 1}. [${item.type.toUpperCase()}] ${item.content} (${timeAgo})`)
    })
  }
  
  logger.info('')

  return { success: true, result: related }
}

async function createCheckpoint(
  manager: WorkingMemoryManager,
  options: MemoryExecutorSchema,
  sessionId: string
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for checkpoint')
  }

  const status = options.content || 'Session checkpoint'
  
  await manager.addEntry(options.library, {
    sessionId,
    type: 'change',
    content: `Checkpoint: ${status}`,
    metadata: {
      isCheckpoint: true,
      timestamp: new Date().toISOString()
    }
  })

  logger.info(`🎯 Checkpoint created: ${status}`)
  logger.info(`   Library: ${options.library}`)
  logger.info(`   Time: ${new Date().toLocaleString()}`)
  
  return { success: true, result: { status, library: options.library, timestamp: new Date() } }
}

async function cleanupMemory(
  manager: WorkingMemoryManager,
  options: MemoryExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for cleanup')
  }

  const maxAge = parseInt(options.content || '72') // Default 72 hours
  
  await manager.cleanupOldEntries(options.library, maxAge)
  
  logger.info(`🧹 Cleaned up memory entries older than ${maxAge} hours`)
  logger.info(`   Library: ${options.library}`)
  
  return { success: true, result: { library: options.library, maxAge } }
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}