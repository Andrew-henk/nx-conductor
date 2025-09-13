import { logger } from '@nx/devkit'
import { LibraryContextLoader } from './context-loader'
import { WorkingMemoryManager } from './working-memory'
import { McpIntegration } from './mcp-integration'
import { LibraryContext } from '../types/session.types'

export interface ContextInjectionResult {
  mode: 'context-injection'
  success: boolean
  context: LibraryContext | null
  workingMemory: string | null
  suggestions: string[]
  nextActions: string[]
  orchestrationPlan?: OrchestrationPlan | null
  error?: string
}

export interface OrchestrationPlan {
  task: string
  libraries: string[]
  recommendedOrder: string[]
  dependencies: Record<string, string[]>
  estimatedComplexity: 'low' | 'medium' | 'high'
  phases: OrchestrationPhase[]
}

export interface OrchestrationPhase {
  name: string
  libraries: string[]
  description: string
  dependencies: string[]
  estimatedDuration: string
}

export class ContextInjector {
  private contextLoader: LibraryContextLoader
  private workingMemoryManager: WorkingMemoryManager
  private mcpIntegration: McpIntegration
  private workspaceRoot: string

  constructor(workspaceRoot: string, projectGraph: any) {
    this.workspaceRoot = workspaceRoot
    this.contextLoader = new LibraryContextLoader(workspaceRoot, projectGraph)
    this.workingMemoryManager = new WorkingMemoryManager(workspaceRoot)
    this.mcpIntegration = new McpIntegration(workspaceRoot)
  }

  /**
   * Main context injection method - provides all context without launching CLI
   */
  async injectContext(library: string, task?: string): Promise<ContextInjectionResult> {
    logger.info('')
    logger.info('🧠 Context Injection Mode - Loading Complete Context')
    logger.info('====================================================')
    logger.info('')

    try {
      // Load full context (includes hierarchical knowledge + working memory)
      const context = await this.contextLoader.loadContext(library)
      
      // Generate intelligent suggestions based on context
      const suggestions = await this.generateSuggestions(context, task)
      
      // Generate next actions based on working memory
      const nextActions = await this.generateNextActions(context, task)
      
      // Generate orchestration plan if task provided
      let orchestrationPlan: OrchestrationPlan | null = null
      if (task) {
        orchestrationPlan = await this.generateOrchestrationPlan(library, task, context)
      }

      const result: ContextInjectionResult = {
        mode: 'context-injection',
        success: true,
        context,
        workingMemory: context.workingMemory || null,
        suggestions,
        nextActions,
        orchestrationPlan
      }

      this.logInjectionResult(result)
      return result

    } catch (error) {
      logger.error(`❌ Context injection failed: ${error}`)
      
      return {
        mode: 'context-injection',
        success: false,
        context: null,
        workingMemory: null,
        suggestions: [],
        nextActions: [],
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Generate intelligent suggestions based on context
   */
  private async generateSuggestions(context: LibraryContext, task?: string): Promise<string[]> {
    const suggestions: string[] = []

    // Working memory based suggestions
    if (context.workingMemory) {
      if (context.workingMemory.includes('📋 Active TODOs')) {
        suggestions.push('🎯 You have active TODOs from previous sessions - consider completing these first')
      }
      
      if (context.workingMemory.includes('🚫 Blocked Items')) {
        suggestions.push('🚫 Review blocked items from previous sessions - some may now be unblocked')
      }
      
      if (context.workingMemory.includes('❓ Open Questions')) {
        suggestions.push('❓ Address open questions from previous sessions for clarity')
      }
    }

    // Hierarchical knowledge suggestions
    if (context.hierarchicalKnowledge) {
      const workspaceDecisions = Array.isArray(context.hierarchicalKnowledge.workspace?.decisions) 
        ? context.hierarchicalKnowledge.workspace.decisions.length : 0
      const libraryDecisions = Array.isArray(context.hierarchicalKnowledge.library?.decisions) 
        ? context.hierarchicalKnowledge.library.decisions.length : 0
      
      if (workspaceDecisions > 0) {
        suggestions.push(`📚 ${workspaceDecisions} workspace-level decisions available for reference`)
      }
      
      if (libraryDecisions > 0) {
        suggestions.push(`🏗️ ${libraryDecisions} library-specific decisions guide architecture`)
      }
      
      if (workspaceDecisions === 0 && libraryDecisions === 0) {
        suggestions.push('💡 Consider documenting key decisions as you work for future sessions')
      }
    }

    // Dependency-based suggestions
    if (Array.isArray(context.dependencies) && context.dependencies.length > 0) {
      suggestions.push(`🔗 This library depends on ${context.dependencies.length} other libraries - review their APIs`)
    }

    // Pattern-based suggestions
    if (context.patterns && Array.isArray(context.patterns.codingConventions)) {
      const conventionCount = context.patterns.codingConventions.length
      if (conventionCount > 0) {
        suggestions.push(`📋 Follow ${conventionCount} established coding conventions for consistency`)
      }
    }

    // Task-specific suggestions
    if (task) {
      if (task.toLowerCase().includes('test')) {
        suggestions.push('🧪 Consider testing patterns established in this library')
      }
      
      if (task.toLowerCase().includes('refactor')) {
        suggestions.push('🔄 Review existing patterns before refactoring to maintain consistency')
      }
      
      if (task.toLowerCase().includes('feature') || task.toLowerCase().includes('add')) {
        suggestions.push('🚀 Check if similar features exist in dependent libraries for reuse')
      }
    }

    return suggestions
  }

  /**
   * Generate next actions based on working memory and context
   */
  private async generateNextActions(context: LibraryContext, task?: string): Promise<string[]> {
    const actions: string[] = []

    // Parse working memory for specific actions
    if (context.workingMemory) {
      const workingMemory = context.workingMemory

      // Extract TODOs
      const todoMatch = workingMemory.match(/## 📋 Active TODOs\n((?:- .+\n?)+)/m)
      if (todoMatch) {
        const todos = todoMatch[1].split('\n').filter(line => line.trim().startsWith('-'))
        todos.slice(0, 3).forEach(todo => {
          actions.push(`Continue: ${todo.replace(/^- /, '').trim()}`)
        })
      }

      // Extract from last session summary
      const lastSessionMatch = workingMemory.match(/\*\*Recommended Next Steps\*\*:\n((?:\d+\. .+\n?)+)/m)
      if (lastSessionMatch) {
        const steps = lastSessionMatch[1].split('\n').filter(line => line.trim().match(/^\d+\./))
        steps.slice(0, 2).forEach(step => {
          actions.push(step.replace(/^\d+\.\s*/, '').trim())
        })
      }
    }

    // Add task-specific actions
    if (task) {
      actions.push(`Focus on: ${task}`)
      
      if (task.toLowerCase().includes('bug') || task.toLowerCase().includes('fix')) {
        actions.push('1. Reproduce the issue')
        actions.push('2. Write failing test')
        actions.push('3. Implement fix')
        actions.push('4. Verify tests pass')
      }
    }

    // Add default actions if none found
    if (actions.length === 0) {
      actions.push('Review library context and recent changes')
      actions.push('Check working memory for previous session insights')
      actions.push('Begin implementation following established patterns')
    }

    return actions
  }

  /**
   * Generate orchestration plan without launching processes
   */
  private async generateOrchestrationPlan(
    library: string, 
    task: string, 
    context: LibraryContext
  ): Promise<OrchestrationPlan | null> {
    try {
      // Analyze task complexity and scope
      const isMultiLibrary = task.toLowerCase().includes('across') || 
                            task.toLowerCase().includes('integration') ||
                            task.toLowerCase().includes('system')

      if (!isMultiLibrary) {
        // Single library task - simple plan
        return {
          task,
          libraries: [library],
          recommendedOrder: [library],
          dependencies: { [library]: Array.isArray(context.dependencies) ? context.dependencies : [] },
          estimatedComplexity: this.estimateComplexity(task),
          phases: [{
            name: 'Implementation',
            libraries: [library],
            description: `Implement ${task} in ${library}`,
            dependencies: Array.isArray(context.dependencies) ? context.dependencies : [],
            estimatedDuration: this.estimateDuration(task)
          }]
        }
      }

      // Multi-library orchestration plan
      const relatedLibraries = await this.findRelatedLibraries(library, task, context)
      
      return {
        task,
        libraries: [library, ...relatedLibraries],
        recommendedOrder: this.determineImplementationOrder([library, ...relatedLibraries], context),
        dependencies: await this.analyzeDependencies([library, ...relatedLibraries]),
        estimatedComplexity: 'high',
        phases: this.generatePhases(task, [library, ...relatedLibraries])
      }

    } catch (error) {
      logger.warn(`Could not generate orchestration plan: ${error}`)
      return null
    }
  }

  private estimateComplexity(task: string): 'low' | 'medium' | 'high' {
    const complexityKeywords = {
      high: ['system', 'architecture', 'refactor', 'migration', 'integration', 'orchestrat'],
      medium: ['feature', 'component', 'service', 'api'],
      low: ['fix', 'update', 'style', 'format', 'comment']
    }

    const taskLower = task.toLowerCase()
    
    if (complexityKeywords.high.some(keyword => taskLower.includes(keyword))) {
      return 'high'
    }
    
    if (complexityKeywords.medium.some(keyword => taskLower.includes(keyword))) {
      return 'medium'
    }
    
    return 'low'
  }

  private estimateDuration(task: string): string {
    const complexity = this.estimateComplexity(task)
    
    switch (complexity) {
      case 'high': return '4-8 hours'
      case 'medium': return '2-4 hours'
      case 'low': return '30min-2 hours'
      default: return '2-4 hours'
    }
  }

  private async findRelatedLibraries(library: string, task: string, context: LibraryContext): Promise<string[]> {
    // Simple heuristic - use dependencies as related libraries
    const dependencies = Array.isArray(context.dependencies) ? context.dependencies : []
    return dependencies.slice(0, 3) // Limit to avoid overwhelming
  }

  private determineImplementationOrder(libraries: string[], context: LibraryContext): string[] {
    // Simple dependency-aware ordering
    const dependencies = Array.isArray(context.dependencies) ? context.dependencies : []
    const withDeps = libraries.filter(lib => dependencies.includes(lib))
    const withoutDeps = libraries.filter(lib => !dependencies.includes(lib))
    
    return [...withDeps, ...withoutDeps]
  }

  private async analyzeDependencies(libraries: string[]): Promise<Record<string, string[]>> {
    const deps: Record<string, string[]> = {}
    
    for (const lib of libraries) {
      // Simplified - would use actual project graph
      deps[lib] = []
    }
    
    return deps
  }

  private generatePhases(task: string, libraries: string[]): OrchestrationPhase[] {
    if (libraries.length === 1) {
      return [{
        name: 'Implementation',
        libraries,
        description: `Implement ${task}`,
        dependencies: [],
        estimatedDuration: this.estimateDuration(task)
      }]
    }

    // Multi-library phases
    return [
      {
        name: 'Foundation',
        libraries: libraries.slice(0, Math.ceil(libraries.length / 2)),
        description: 'Implement core foundation components',
        dependencies: [],
        estimatedDuration: '2-4 hours'
      },
      {
        name: 'Integration',
        libraries: libraries.slice(Math.ceil(libraries.length / 2)),
        description: 'Integrate and connect components',
        dependencies: libraries.slice(0, Math.ceil(libraries.length / 2)),
        estimatedDuration: '2-3 hours'
      }
    ]
  }

  private logInjectionResult(result: ContextInjectionResult): void {
    logger.info('✅ Context Injection Complete!')
    logger.info('')
    logger.info('📋 Available Information:')
    logger.info(`   Library Context: ${result.context ? '✅' : '❌'}`)
    logger.info(`   Working Memory: ${result.workingMemory ? '✅' : '❌'}`)
    logger.info(`   Suggestions: ${result.suggestions.length}`)
    logger.info(`   Next Actions: ${result.nextActions.length}`)
    logger.info(`   Orchestration Plan: ${result.orchestrationPlan ? '✅' : '❌'}`)
    logger.info('')
    
    if (result.suggestions.length > 0) {
      logger.info('💡 Intelligent Suggestions:')
      result.suggestions.forEach((suggestion, index) => {
        logger.info(`   ${index + 1}. ${suggestion}`)
      })
      logger.info('')
    }
    
    if (result.nextActions.length > 0) {
      logger.info('🎯 Recommended Next Actions:')
      result.nextActions.forEach((action, index) => {
        logger.info(`   ${index + 1}. ${action}`)
      })
      logger.info('')
    }
    
    logger.info('🧠 Ready for intelligent development!')
    logger.info('')
  }

  /**
   * Update working memory in real-time during session
   */
  async updateWorkingMemory(
    library: string, 
    type: 'todo' | 'completed' | 'blocked' | 'question',
    content: string,
    sessionId?: string
  ): Promise<void> {
    await this.workingMemoryManager.addEntry(library, {
      sessionId: sessionId || `context-injection-${Date.now()}`,
      type,
      content
    })
    
    logger.info(`📝 Working Memory updated: ${type.toUpperCase()} - ${content}`)
  }

  /**
   * Get current working memory for display
   */
  async getCurrentWorkingMemory(library: string): Promise<string> {
    return await this.workingMemoryManager.generateSessionContext(library)
  }
}