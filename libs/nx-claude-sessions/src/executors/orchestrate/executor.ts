import { ExecutorContext, logger, createProjectGraphAsync } from '@nx/devkit'
import { OrchestrationExecutorSchema } from './schema'
import { FeatureOrchestrator, MasterSessionConfig } from '../../utils/orchestrator'

export default async function runExecutor(
  options: OrchestrationExecutorSchema,
  context: ExecutorContext
) {
  logger.info(`🎼 Feature Orchestration: ${options.feature}`)
  logger.info('========================================')
  
  try {
    const projectGraph = await createProjectGraphAsync()
    const orchestrator = new FeatureOrchestrator(context.root, projectGraph)
    
    // Step 1: Analyze Feature Scope
    logger.info('📊 Step 1: Analyzing feature scope...')
    const featureScope = await orchestrator.analyzeFeatureScope(options.feature, options.libraries)
    
    logger.info('🎯 Feature Scope Analysis:')
    logger.info(`   Primary Libraries: ${featureScope.primaryLibraries.join(', ')}`)
    logger.info(`   Secondary Libraries: ${featureScope.secondaryLibraries.join(', ')}`)
    logger.info(`   Shared Resources: ${featureScope.sharedResources.join(', ') || 'None'}`)
    logger.info(`   Coordination Required: ${featureScope.coordinationRequired ? 'Yes' : 'No'}`)
    logger.info(`   Estimated Sessions: ${featureScope.estimatedSessionCount}`)
    logger.info('')
    
    // Step 2: Create Orchestration Plan
    logger.info('📋 Step 2: Creating orchestration plan...')
    
    const masterConfig: MasterSessionConfig = {
      feature: options.feature,
      libraries: [...featureScope.primaryLibraries, ...featureScope.secondaryLibraries],
      maxSessions: options.maxSessions || 3,
      strategy: options.strategy || 'dependency-aware',
      priority: options.priority || 50,
      timeout: options.timeout || '2h',
      coordinationMode: options.coordinationMode || 'automatic',
      includeTests: options.includeTests || true
    }
    
    const orchestrationPlan = await orchestrator.createOrchestrationPlan(masterConfig, featureScope)
    
    logger.info('🗓️  Orchestration Plan:')
    logger.info(`   Total Phases: ${orchestrationPlan.phases.length}`)
    logger.info(`   Estimated Duration: ${Math.round(orchestrationPlan.totalEstimatedTime / (60 * 1000))} minutes`)
    logger.info(`   Coordination Points: ${orchestrationPlan.coordinationPoints.length}`)
    logger.info('')
    
    orchestrationPlan.phases.forEach(phase => {
      const parallelText = phase.parallelizable ? '(parallel)' : '(sequential)'
      const durationMin = Math.round(phase.estimatedDuration / (60 * 1000))
      logger.info(`   Phase ${phase.phase}: ${phase.libraries.join(', ')} ${parallelText} (~${durationMin}min)`)
      
      if (phase.dependencies.length > 0) {
        logger.info(`     Dependencies: ${phase.dependencies.join(', ')}`)
      }
    })
    
    if (orchestrationPlan.coordinationPoints.length > 0) {
      logger.info('')
      logger.info('🔗 Coordination Points:')
      orchestrationPlan.coordinationPoints.forEach(point => {
        logger.info(`   Phase ${point.phase}: ${point.coordinationType} coordination for ${point.libraries.join(', ')}`)
        logger.info(`     Trigger: ${point.trigger}`)
        logger.info(`     Actions: ${point.actions.join(', ')}`)
      })
    }
    
    logger.info('')
    
    // Step 3: Dry Run Check
    if (options.dryRun) {
      logger.info('🏃‍♂️ Dry run completed - no sessions started')
      return { 
        success: true, 
        dryRun: true, 
        featureScope, 
        orchestrationPlan,
        estimatedDuration: orchestrationPlan.totalEstimatedTime
      }
    }
    
    // Step 4: Execute Orchestration
    logger.info('🚀 Step 3: Executing orchestration plan...')
    logger.info(`   Max Concurrent Sessions: ${masterConfig.maxSessions}`)
    logger.info(`   Strategy: ${masterConfig.strategy}`)
    logger.info(`   Coordination Mode: ${masterConfig.coordinationMode}`)
    logger.info('')
    
    const result = await orchestrator.executeOrchestrationPlan(masterConfig, orchestrationPlan)
    
    // Step 5: Report Results
    logger.info('')
    logger.info('📊 Orchestration Results:')
    logger.info('========================')
    
    if (result.success) {
      logger.info('✅ Feature orchestration completed successfully!')
      logger.info(`   Total Sessions: ${result.sessions.length}`)
      logger.info(`   Actual Duration: ${Math.round(result.duration / 1000)}s`)
      
      const librarySessionCount = result.sessions.reduce((acc, session) => {
        acc[session.library] = (acc[session.library] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      logger.info('')
      logger.info('📚 Sessions by Library:')
      Object.entries(librarySessionCount).forEach(([library, count]) => {
        logger.info(`   ${library}: ${count} session${count > 1 ? 's' : ''}`)
      })
      
      // Provide next steps
      logger.info('')
      logger.info('🎯 Next Steps:')
      logger.info('1. Review completed sessions with: nx session-manager --command=list')
      logger.info('2. Check for any integration issues between libraries')
      logger.info('3. Run tests to validate the feature implementation')
      logger.info('4. Consider creating documentation for the new feature')
      
    } else {
      logger.error('❌ Feature orchestration encountered issues')
      logger.error(`   Duration: ${Math.round(result.duration / 1000)}s`)
      logger.error(`   Sessions started: ${result.sessions.length}`)
      
      logger.info('')
      logger.info('🔧 Troubleshooting:')
      logger.info('1. Check session logs with: nx session-manager --command=search --query="error"')
      logger.info('2. Review library dependencies for conflicts')
      logger.info('3. Consider reducing maxSessions or using sequential strategy')
      logger.info('4. Check available Claude Code installation')
    }
    
    return {
      success: result.success,
      sessions: result.sessions.length,
      duration: result.duration,
      libraries: masterConfig.libraries,
      featureScope,
      orchestrationPlan
    }
    
  } catch (error) {
    logger.error(`❌ Orchestration failed: ${error}`)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (60 * 1000))
  const seconds = Math.floor((ms % (60 * 1000)) / 1000)
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}