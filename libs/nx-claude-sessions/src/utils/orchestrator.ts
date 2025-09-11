import { logger, ProjectGraph } from '@nx/devkit'
import { SessionPool } from './session-pool'
import { LibraryContextLoader } from './context-loader'
import { TaskDescriptor, SessionInstance } from '../types/session.types'
import { OrchestrationPlan, OrchestrationPhase, CoordinationPoint, FeatureScope } from '../types/nx-integration.types'

export interface MasterSessionConfig {
  feature: string
  libraries: string[]
  maxSessions: number
  strategy: 'dependency-aware' | 'parallel' | 'sequential'
  priority: number
  timeout: string
  coordinationMode: 'automatic' | 'manual' | 'hybrid'
  includeTests: boolean
}

export class FeatureOrchestrator {
  private workspaceRoot: string
  private projectGraph: ProjectGraph
  private sessionPool: SessionPool
  private contextLoader: LibraryContextLoader
  private coordinationChannels = new Map<string, CoordinationChannel>()

  constructor(workspaceRoot: string, projectGraph: ProjectGraph) {
    this.workspaceRoot = workspaceRoot
    this.projectGraph = projectGraph
    this.sessionPool = new SessionPool(5, workspaceRoot)
    this.contextLoader = new LibraryContextLoader(workspaceRoot, projectGraph)
  }

  async analyzeFeatureScope(feature: string, providedLibraries?: string[]): Promise<FeatureScope> {
    logger.info(`🔍 Analyzing feature scope: ${feature}`)
    
    if (providedLibraries && providedLibraries.length > 0) {
      return await this.validateProvidedLibraries(feature, providedLibraries)
    }
    
    return await this.detectAffectedLibraries(feature)
  }

  async createOrchestrationPlan(
    config: MasterSessionConfig, 
    scope: FeatureScope
  ): Promise<OrchestrationPlan> {
    logger.info(`📋 Creating orchestration plan for: ${config.feature}`)
    
    const phases = await this.planPhases(scope, config.strategy, config.maxSessions)
    const coordinationPoints = this.identifyCoordinationPoints(scope, phases)
    const totalEstimatedTime = this.estimateTotalTime(phases, config.timeout)
    
    return {
      phases,
      totalEstimatedTime,
      concurrencyMap: this.buildConcurrencyMap(phases, config.maxSessions),
      coordinationPoints
    }
  }

  async executeOrchestrationPlan(
    config: MasterSessionConfig, 
    plan: OrchestrationPlan
  ): Promise<{ success: boolean; sessions: SessionInstance[]; duration: number }> {
    const startTime = Date.now()
    const allSessions: SessionInstance[] = []
    
    logger.info(`🚀 Executing orchestration plan with ${plan.phases.length} phases`)
    
    try {
      for (let phaseIndex = 0; phaseIndex < plan.phases.length; phaseIndex++) {
        const phase = plan.phases[phaseIndex]
        logger.info(`📌 Phase ${phase.phase}: ${phase.libraries.join(', ')}`)
        
        const phaseSessions = await this.executePhase(phase, config, plan.coordinationPoints)
        allSessions.push(...phaseSessions)
        
        if (!phase.parallelizable && phaseIndex < plan.phases.length - 1) {
          logger.info(`⏳ Waiting for phase ${phase.phase} to complete before continuing...`)
          await this.waitForPhaseCompletion(phaseSessions)
        }
      }
      
      if (plan.phases.some(phase => phase.parallelizable)) {
        logger.info(`⏳ Waiting for all parallel sessions to complete...`)
        await this.waitForAllSessionsCompletion(allSessions)
      }
      
      const duration = Date.now() - startTime
      logger.info(`✅ Orchestration completed in ${Math.round(duration / 1000)}s`)
      
      return { success: true, sessions: allSessions, duration }
      
    } catch (error) {
      logger.error(`❌ Orchestration failed: ${error}`)
      await this.cleanupSessions(allSessions)
      return { success: false, sessions: allSessions, duration: Date.now() - startTime }
    }
  }

  private async validateProvidedLibraries(feature: string, libraries: string[]): Promise<FeatureScope> {
    const validLibraries = libraries.filter(lib => this.projectGraph.nodes[lib])
    const invalidLibraries = libraries.filter(lib => !this.projectGraph.nodes[lib])
    
    if (invalidLibraries.length > 0) {
      logger.warn(`⚠️  Invalid libraries will be skipped: ${invalidLibraries.join(', ')}`)
    }
    
    const dependencies = this.analyzeDependencies(validLibraries)
    
    return {
      primaryLibraries: validLibraries,
      secondaryLibraries: dependencies.filter(dep => !validLibraries.includes(dep)),
      sharedResources: this.identifySharedResources(validLibraries),
      coordinationRequired: validLibraries.length > 1,
      estimatedSessionCount: validLibraries.length
    }
  }

  private async detectAffectedLibraries(feature: string): Promise<FeatureScope> {
    // In a real implementation, this would analyze:
    // 1. Feature description for keywords matching library names
    // 2. Recent changes in git history
    // 3. Import/dependency patterns
    // 4. Similar feature implementations
    
    logger.info(`🤖 Auto-detecting libraries for feature: ${feature}`)
    
    const featureLower = feature.toLowerCase()
    const potentialLibraries: string[] = []
    
    // Keyword-based detection
    const libraryKeywords = {
      'auth': ['auth', 'login', 'user', 'permission', 'security'],
      'api': ['api', 'endpoint', 'service', 'http'],
      'ui': ['ui', 'component', 'interface', 'form', 'button'],
      'database': ['database', 'db', 'storage', 'persist'],
      'shared': ['shared', 'common', 'util'],
      'web-app': ['app', 'application', 'main'],
      'mobile-app': ['mobile', 'native']
    }
    
    Object.entries(libraryKeywords).forEach(([lib, keywords]) => {
      if (this.projectGraph.nodes[lib] && keywords.some(keyword => featureLower.includes(keyword))) {
        potentialLibraries.push(lib)
      }
    })
    
    // If no libraries detected, include common ones
    if (potentialLibraries.length === 0) {
      potentialLibraries.push(...Object.keys(this.projectGraph.nodes).slice(0, 2))
    }
    
    logger.info(`🎯 Detected libraries: ${potentialLibraries.join(', ')}`)
    
    return {
      primaryLibraries: potentialLibraries,
      secondaryLibraries: this.analyzeDependencies(potentialLibraries),
      sharedResources: this.identifySharedResources(potentialLibraries),
      coordinationRequired: potentialLibraries.length > 1,
      estimatedSessionCount: potentialLibraries.length
    }
  }

  private async planPhases(
    scope: FeatureScope, 
    strategy: string, 
    maxSessions: number
  ): Promise<OrchestrationPhase[]> {
    const allLibraries = [...scope.primaryLibraries, ...scope.secondaryLibraries]
    
    switch (strategy) {
      case 'sequential':
        return this.createSequentialPhases(allLibraries)
      case 'parallel':
        return this.createParallelPhases(allLibraries, maxSessions)
      case 'dependency-aware':
      default:
        return this.createDependencyAwarePhases(allLibraries, maxSessions)
    }
  }

  private createSequentialPhases(libraries: string[]): OrchestrationPhase[] {
    return libraries.map((lib, index) => ({
      phase: index + 1,
      libraries: [lib],
      parallelizable: false,
      dependencies: index > 0 ? [libraries[index - 1]] : [],
      estimatedDuration: 30 * 60 * 1000 // 30 minutes per phase
    }))
  }

  private createParallelPhases(libraries: string[], maxSessions: number): OrchestrationPhase[] {
    const chunks = this.chunkArray(libraries, maxSessions)
    
    return chunks.map((chunk, index) => ({
      phase: index + 1,
      libraries: chunk,
      parallelizable: true,
      dependencies: [],
      estimatedDuration: 45 * 60 * 1000 // 45 minutes for parallel phases
    }))
  }

  private createDependencyAwarePhases(libraries: string[], maxSessions: number): OrchestrationPhase[] {
    const dependencyMap = this.buildDependencyMap(libraries)
    const phases: OrchestrationPhase[] = []
    const processed = new Set<string>()
    let phaseNumber = 1
    
    while (processed.size < libraries.length) {
      const readyLibraries = libraries.filter(lib => 
        !processed.has(lib) && 
        dependencyMap[lib]?.every(dep => processed.has(dep)) !== false
      )
      
      if (readyLibraries.length === 0) {
        // Break dependency cycle by including remaining libraries
        const remaining = libraries.filter(lib => !processed.has(lib))
        readyLibraries.push(...remaining.slice(0, maxSessions))
      }
      
      const currentPhaseLibs = readyLibraries.slice(0, maxSessions)
      
      phases.push({
        phase: phaseNumber++,
        libraries: currentPhaseLibs,
        parallelizable: currentPhaseLibs.length > 1,
        dependencies: currentPhaseLibs.flatMap(lib => dependencyMap[lib] || []),
        estimatedDuration: 35 * 60 * 1000 // 35 minutes
      })
      
      currentPhaseLibs.forEach(lib => processed.add(lib))
    }
    
    return phases
  }

  private async executePhase(
    phase: OrchestrationPhase, 
    config: MasterSessionConfig,
    coordinationPoints: CoordinationPoint[]
  ): Promise<SessionInstance[]> {
    const sessions: SessionInstance[] = []
    
    logger.info(`🎯 Starting phase ${phase.phase} with libraries: ${phase.libraries.join(', ')}`)
    
    const phaseCoordinationPoints = coordinationPoints.filter(cp => cp.phase === phase.phase)
    
    for (const library of phase.libraries) {
      const context = await this.contextLoader.loadContext(library)
      
      const taskDescriptor: TaskDescriptor = {
        type: 'feature',
        description: `Implement ${config.feature} for ${library}`,
        scope: [library, ...phase.libraries.filter(l => l !== library)],
        priority: config.priority,
        estimatedComplexity: 'medium',
        crossLibraryDependencies: phase.dependencies
      }
      
      // Set up coordination channel if needed
      if (phaseCoordinationPoints.length > 0) {
        this.setupCoordinationChannel(library, phaseCoordinationPoints)
      }
      
      const session = await this.sessionPool.requestSession(library, taskDescriptor, context)
      sessions.push(session)
      
      logger.info(`   ✓ Started session for ${library}: ${session.id}`)
    }
    
    return sessions
  }

  private buildDependencyMap(libraries: string[]): Record<string, string[]> {
    const dependencyMap: Record<string, string[]> = {}
    
    libraries.forEach(lib => {
      const deps = this.projectGraph.dependencies[lib]?.map(dep => dep.target) || []
      dependencyMap[lib] = deps.filter(dep => libraries.includes(dep))
    })
    
    return dependencyMap
  }

  private analyzeDependencies(libraries: string[]): string[] {
    const allDeps = new Set<string>()
    
    libraries.forEach(lib => {
      const deps = this.projectGraph.dependencies[lib]?.map(dep => dep.target) || []
      deps.forEach(dep => {
        if (this.projectGraph.nodes[dep] && !libraries.includes(dep)) {
          allDeps.add(dep)
        }
      })
    })
    
    return Array.from(allDeps)
  }

  private identifySharedResources(libraries: string[]): string[] {
    return libraries
      .flatMap(lib => this.projectGraph.dependencies[lib]?.map(dep => dep.target) || [])
      .filter(dep => dep.includes('shared') || dep.includes('common'))
      .filter((dep, index, arr) => arr.indexOf(dep) === index) // unique
  }

  private identifyCoordinationPoints(scope: FeatureScope, phases: OrchestrationPhase[]): CoordinationPoint[] {
    const coordinationPoints: CoordinationPoint[] = []
    
    phases.forEach(phase => {
      if (phase.libraries.length > 1) {
        coordinationPoints.push({
          phase: phase.phase,
          libraries: phase.libraries,
          coordinationType: 'sync',
          trigger: 'phase-start',
          actions: ['share-context', 'coordinate-interfaces']
        })
        
        coordinationPoints.push({
          phase: phase.phase,
          libraries: phase.libraries,
          coordinationType: 'async',
          trigger: 'interface-change',
          actions: ['notify-dependents', 'validate-compatibility']
        })
      }
    })
    
    return coordinationPoints
  }

  private setupCoordinationChannel(library: string, coordinationPoints: CoordinationPoint[]): void {
    const channelId = `${library}-coordination`
    const channel = new CoordinationChannel(channelId, library, coordinationPoints)
    this.coordinationChannels.set(channelId, channel)
    
    logger.info(`🔗 Set up coordination channel for ${library}`)
  }

  private estimateTotalTime(phases: OrchestrationPhase[], timeout: string): number {
    const sequential = phases.filter(p => !p.parallelizable)
    const parallel = phases.filter(p => p.parallelizable)
    
    const sequentialTime = sequential.reduce((sum, phase) => sum + phase.estimatedDuration, 0)
    const maxParallelTime = Math.max(...parallel.map(p => p.estimatedDuration), 0)
    
    return sequentialTime + maxParallelTime
  }

  private buildConcurrencyMap(phases: OrchestrationPhase[], maxSessions: number): Map<string, number> {
    const concurrencyMap = new Map<string, number>()
    
    phases.forEach(phase => {
      phase.libraries.forEach(lib => {
        concurrencyMap.set(lib, phase.parallelizable ? maxSessions : 1)
      })
    })
    
    return concurrencyMap
  }

  private async waitForPhaseCompletion(sessions: SessionInstance[]): Promise<void> {
    return new Promise((resolve, reject) => {
      let retryCount = 0
      const maxRetries = 450 // 15 minutes timeout (450 * 2000ms)
      
      const checkInterval = setInterval(() => {
        try {
          const activeStatuses = sessions.map(s => this.sessionPool.getActiveSessionsStatus().find(status => status.sessionId === s.id))
          const allCompleted = activeStatuses.every(status => !status)
          
          if (allCompleted) {
            clearInterval(checkInterval)
            resolve()
            return
          }
          
          retryCount++
          if (retryCount >= maxRetries) {
            clearInterval(checkInterval)
            reject(new Error(`Phase completion timeout after ${maxRetries * 2} seconds`))
            return
          }
        } catch (error) {
          clearInterval(checkInterval)
          reject(error)
        }
      }, 2000)
      
      // Clean up interval on process exit to prevent memory leaks
      process.once('exit', () => clearInterval(checkInterval))
      process.once('SIGINT', () => clearInterval(checkInterval))
      process.once('SIGTERM', () => clearInterval(checkInterval))
    })
  }

  private async waitForAllSessionsCompletion(sessions: SessionInstance[]): Promise<void> {
    return this.waitForPhaseCompletion(sessions)
  }

  private async cleanupSessions(sessions: SessionInstance[]): Promise<void> {
    logger.info(`🧹 Cleaning up ${sessions.length} sessions...`)
    
    await Promise.all(sessions.map(async session => {
      try {
        await this.sessionPool.terminateSession(session.id)
      } catch (error) {
        logger.warn(`Could not cleanup session ${session.id}: ${error}`)
      }
    }))
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}

class CoordinationChannel {
  constructor(
    private id: string,
    private library: string,
    private coordinationPoints: CoordinationPoint[]
  ) {}

  async notify(message: string, type: string): Promise<void> {
    logger.info(`📡 [${this.library}] ${type}: ${message}`)
  }
}