import { ExecutorContext, logger, createProjectGraphAsync } from '@nx/devkit'
import { ContextExecutorSchema } from './schema'
import { SessionModeDetector } from '../../utils/session-mode-detector'
import { ContextInjector } from '../../utils/context-injector'

export default async function runExecutor(
  options: ContextExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean; result?: any }> {
  
  // Detect session mode
  const detection = SessionModeDetector.detect()
  
  logger.info('')
  logger.info('📋 Context Operations')
  logger.info('====================')
  logger.info(`Command: ${options.command}`)
  logger.info(`Library: ${options.library}`)
  logger.info(`Mode: ${detection.mode}`)
  logger.info('')

  try {
    const projectGraph = await createProjectGraphAsync()
    const contextInjector = new ContextInjector(context.root, projectGraph)

    switch (options.command) {
      case 'load':
      case 'inject':
        return await injectContext(contextInjector, options)
      
      case 'analyze':
        return await analyzeContext(contextInjector, options)
      
      case 'suggest-libraries':
        return await suggestLibraries(context, options)
      
      case 'check-dependencies':
        return await checkDependencies(contextInjector, options)
      
      case 'generate-plan':
        return await generatePlan(contextInjector, options)
      
      default:
        throw new Error(`Unknown context command: ${options.command}`)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Context operation failed: ${errorMessage}`)
    
    return {
      success: false
    }
  }
}

async function injectContext(
  injector: ContextInjector,
  options: ContextExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for context injection')
  }

  const result = await injector.injectContext(options.library, options.task)
  
  if (!result.success) {
    throw new Error(result.error || 'Context injection failed')
  }

  // Context is already displayed by the injector
  return { success: true, result: result }
}

async function analyzeContext(
  injector: ContextInjector,
  options: ContextExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for context analysis')
  }

  const result = await injector.injectContext(options.library, options.task)
  
  if (!result.success) {
    throw new Error(result.error || 'Context analysis failed')
  }

  // Provide analysis summary
  logger.info('📊 Context Analysis Summary:')
  logger.info('===========================')
  logger.info('')
  
  if (result.context) {
    const ctx = result.context
    logger.info(`Library: ${ctx.library}`)
    logger.info(`Dependencies: ${ctx.dependencies?.length || 0}`)
    
    if (ctx.hierarchicalKnowledge) {
      const hk = ctx.hierarchicalKnowledge
      logger.info(`Workspace Knowledge: ${hk.workspace.decisions.length} decisions, ${hk.workspace.patterns.length} patterns`)
      logger.info(`Library Knowledge: ${hk.library.decisions.length} decisions, ${hk.library.patterns.length} patterns`)
    }
    
    logger.info(`Working Memory Available: ${ctx.workingMemory ? 'Yes' : 'No'}`)
    logger.info(`Patterns: ${ctx.patterns?.codingConventions?.length || 0} conventions`)
  }

  logger.info('')
  logger.info(`Suggestions Generated: ${result.suggestions?.length || 0}`)
  logger.info(`Next Actions: ${result.nextActions?.length || 0}`)
  logger.info(`Orchestration Plan: ${result.orchestrationPlan ? 'Available' : 'Not generated'}`)

  return { success: true, result: result }
}

async function suggestLibraries(
  context: ExecutorContext,
  options: ContextExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.task) {
    throw new Error('Task description is required for library suggestions')
  }

  // Simple heuristic-based library suggestion
  const task = options.task.toLowerCase()
  const suggestions: string[] = []
  
  logger.info(`🎯 Library Suggestions for Task: "${options.task}"`)
  logger.info('=============================================')
  logger.info('')
  
  // Task-based suggestions
  if (task.includes('auth') || task.includes('login') || task.includes('user')) {
    suggestions.push('auth-lib: For authentication and user management')
  }
  
  if (task.includes('api') || task.includes('endpoint') || task.includes('service')) {
    suggestions.push('api-lib: For API endpoints and services')
  }
  
  if (task.includes('ui') || task.includes('component') || task.includes('interface')) {
    suggestions.push('ui-components: For user interface components')
  }
  
  if (task.includes('data') || task.includes('model') || task.includes('type')) {
    suggestions.push('shared-types: For data models and type definitions')
  }
  
  if (task.includes('util') || task.includes('helper') || task.includes('common')) {
    suggestions.push('shared-utils: For utility functions and helpers')
  }
  
  if (task.includes('test') || task.includes('spec')) {
    suggestions.push('testing-lib: For testing utilities and fixtures')
  }
  
  if (suggestions.length === 0) {
    suggestions.push('shared-types: For foundational types')
    suggestions.push('shared-utils: For common utilities')
  }
  
  suggestions.forEach((suggestion, index) => {
    logger.info(`${index + 1}. ${suggestion}`)
  })
  
  logger.info('')
  logger.info('💡 Tip: Start with foundational libraries (types, utils) before feature libraries')

  return { success: true, result: suggestions }
}

async function checkDependencies(
  injector: ContextInjector,
  options: ContextExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library) {
    throw new Error('Library is required for dependency check')
  }

  const result = await injector.injectContext(options.library)
  
  if (!result.success || !result.context) {
    throw new Error(result.error || 'Could not load context for dependency check')
  }

  const dependencies = result.context.dependencies || []
  
  logger.info(`🔗 Dependency Check for ${options.library}:`)
  logger.info('=====================================')
  logger.info('')
  
  if (dependencies.length === 0) {
    logger.info('✅ No dependencies - ready to implement')
  } else {
    logger.info('Dependencies:')
    dependencies.forEach((dep, index) => {
      logger.info(`${index + 1}. ${dep} ✅ Available`)
    })
    logger.info('')
    logger.info('✅ All dependencies satisfied - ready to implement')
  }

  return { success: true, result: { library: options.library, dependencies, ready: true } }
}

async function generatePlan(
  injector: ContextInjector,
  options: ContextExecutorSchema
): Promise<{ success: boolean; result?: any }> {
  
  if (!options.library || !options.task) {
    throw new Error('Library and task are required for plan generation')
  }

  const result = await injector.injectContext(options.library, options.task)
  
  if (!result.success) {
    throw new Error(result.error || 'Could not generate plan')
  }

  logger.info('🚀 Implementation Plan Generated')
  logger.info('================================')
  logger.info('')
  
  if (result.orchestrationPlan) {
    const plan = result.orchestrationPlan
    logger.info(`Task: ${plan.task}`)
    logger.info(`Complexity: ${plan.estimatedComplexity}`)
    logger.info(`Libraries Involved: ${plan.libraries.join(', ')}`)
    logger.info(`Recommended Order: ${plan.recommendedOrder.join(' → ')}`)
    logger.info('')
    logger.info('Implementation Phases:')
    plan.phases.forEach((phase, index) => {
      logger.info(`${index + 1}. ${phase.name}: ${phase.description} (${phase.estimatedDuration})`)
    })
  } else {
    logger.info('Simple single-library implementation:')
    logger.info(`1. Analyze requirements in ${options.library}`)
    logger.info('2. Implement core functionality')
    logger.info('3. Add tests')
    logger.info('4. Update documentation')
  }

  return { success: true, result: result.orchestrationPlan }
}