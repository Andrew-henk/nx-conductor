import { logger } from '@nx/devkit'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export interface Decision {
  id: string
  title: string
  description: string
  reasoning: string
  impact: string
  alternatives: string[]
  context: {
    library: string
    session: string
    timestamp: string
    author: string
    scope: 'workspace' | 'library' // NEW: Knowledge scope
  }
  tags: string[]
}

export interface Pattern {
  id: string
  name: string
  description: string
  code: string
  language: string
  context: {
    library: string
    useCase: string
    complexity: 'simple' | 'moderate' | 'complex'
    scope: 'workspace' | 'library' // NEW: Pattern scope
  }
  tags: string[]
  relatedPatterns: string[]
}

export interface SessionLearning {
  sessionId: string
  library: string
  taskType: string
  outcome: string
  duration: number
  keyDecisions: string[]
  patternsCreated: string[]
  lessonsLearned: string[]
  recommendations: string[]
}

export class McpIntegration {
  private workspaceRoot: string
  private mcpServerAvailable: boolean = false

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
    this.checkMcpServerAvailability()
  }

  private async checkMcpServerAvailability(): Promise<void> {
    try {
      await execAsync('which claude-session-intelligence-mcp')
      this.mcpServerAvailable = true
      logger.info('🧠 MCP server available for knowledge persistence')
    } catch {
      this.mcpServerAvailable = false
      logger.warn('⚠️ MCP server not available - using local knowledge storage')
    }
  }

  async recordDecision(decision: Omit<Decision, 'id'>): Promise<boolean> {
    const fullDecision: Decision = {
      ...decision,
      id: `${decision.context.library}-${Date.now()}`
    }

    if (this.mcpServerAvailable) {
      try {
        // Use MCP server to record decision
        const mcpCommand = `echo '${JSON.stringify({
          tool: 'record_decision',
          args: {
            decision: fullDecision.title,
            reasoning: fullDecision.reasoning,
            context: JSON.stringify(fullDecision.context),
            impact: fullDecision.impact,
            alternatives: JSON.stringify(fullDecision.alternatives),
            tags: JSON.stringify(fullDecision.tags)
          }
        })}' | claude-session-intelligence-mcp`
        
        await execAsync(mcpCommand, { 
          env: { ...process.env, WORKSPACE_ROOT: this.workspaceRoot } 
        })
        
        logger.info(`✅ Decision recorded via MCP: ${fullDecision.title}`)
        return true
      } catch (error) {
        logger.warn(`⚠️ MCP decision recording failed: ${error}`)
        // Fall back to local storage
      }
    }

    // Fallback to local .claude/decisions.json storage
    return this.recordDecisionLocally(fullDecision)
  }

  async recordPattern(pattern: Omit<Pattern, 'id'>): Promise<boolean> {
    const fullPattern: Pattern = {
      ...pattern,
      id: `${pattern.context.library}-${Date.now()}`
    }

    if (this.mcpServerAvailable) {
      try {
        const mcpCommand = `echo '${JSON.stringify({
          tool: 'record_pattern',
          args: {
            name: fullPattern.name,
            description: fullPattern.description,
            code: fullPattern.code,
            language: fullPattern.language,
            context: JSON.stringify(fullPattern.context),
            tags: JSON.stringify(fullPattern.tags)
          }
        })}' | claude-session-intelligence-mcp`
        
        await execAsync(mcpCommand, {
          env: { ...process.env, WORKSPACE_ROOT: this.workspaceRoot }
        })
        
        logger.info(`✅ Pattern recorded via MCP: ${fullPattern.name}`)
        return true
      } catch (error) {
        logger.warn(`⚠️ MCP pattern recording failed: ${error}`)
      }
    }

    return this.recordPatternLocally(fullPattern)
  }

  async searchDecisions(query: string, library?: string): Promise<Decision[]> {
    if (this.mcpServerAvailable) {
      try {
        const mcpCommand = `echo '${JSON.stringify({
          tool: 'search_decisions',
          args: {
            query,
            library: library || '',
            limit: 10
          }
        })}' | claude-session-intelligence-mcp`
        
        const { stdout } = await execAsync(mcpCommand, {
          env: { ...process.env, WORKSPACE_ROOT: this.workspaceRoot }
        })
        
        const results = JSON.parse(stdout)
        return results.decisions || []
      } catch (error) {
        logger.warn(`⚠️ MCP decision search failed: ${error}`)
      }
    }

    return this.searchDecisionsLocally(query, library)
  }

  async getLibraryContext(library: string): Promise<any> {
    if (this.mcpServerAvailable) {
      try {
        const mcpCommand = `echo '${JSON.stringify({
          tool: 'get_library_context',
          args: { library }
        })}' | claude-session-intelligence-mcp`
        
        const { stdout } = await execAsync(mcpCommand, {
          env: { ...process.env, WORKSPACE_ROOT: this.workspaceRoot }
        })
        
        return JSON.parse(stdout)
      } catch (error) {
        logger.warn(`⚠️ MCP context retrieval failed: ${error}`)
      }
    }

    return this.getLibraryContextLocally(library)
  }

  async getHierarchicalContext(library: string): Promise<any> {
    // Get workspace-level knowledge
    const workspaceContext = await this.getWorkspaceContext()
    
    // Get library-specific knowledge
    const libraryContext = await this.getLibraryContext(library)
    
    // Merge with inheritance (library overrides workspace)
    return this.mergeContexts(workspaceContext, libraryContext, library)
  }

  async getWorkspaceContext(): Promise<any> {
    if (this.mcpServerAvailable) {
      try {
        const mcpCommand = `echo '${JSON.stringify({
          tool: 'get_workspace_context',
          args: {}
        })}' | claude-session-intelligence-mcp`
        
        const { stdout } = await execAsync(mcpCommand, {
          env: { ...process.env, WORKSPACE_ROOT: this.workspaceRoot }
        })
        
        return JSON.parse(stdout)
      } catch (error) {
        logger.warn(`⚠️ MCP workspace context retrieval failed: ${error}`)
      }
    }

    return this.getWorkspaceContextLocally()
  }

  async recordWorkspaceDecision(decision: Omit<Decision, 'id' | 'context'> & { context: Omit<Decision['context'], 'scope'> }): Promise<boolean> {
    const workspaceDecision: Decision = {
      ...decision,
      id: `workspace-${Date.now()}`,
      context: {
        ...decision.context,
        scope: 'workspace'
      }
    }

    if (this.mcpServerAvailable) {
      try {
        const mcpCommand = `echo '${JSON.stringify({
          tool: 'record_workspace_decision',
          args: {
            decision: workspaceDecision.title,
            reasoning: workspaceDecision.reasoning,
            context: JSON.stringify(workspaceDecision.context),
            impact: workspaceDecision.impact,
            alternatives: JSON.stringify(workspaceDecision.alternatives),
            tags: JSON.stringify(workspaceDecision.tags)
          }
        })}' | claude-session-intelligence-mcp`
        
        await execAsync(mcpCommand, { 
          env: { ...process.env, WORKSPACE_ROOT: this.workspaceRoot } 
        })
        
        logger.info(`✅ Workspace decision recorded via MCP: ${workspaceDecision.title}`)
        return true
      } catch (error) {
        logger.warn(`⚠️ MCP workspace decision recording failed: ${error}`)
      }
    }

    return this.recordWorkspaceDecisionLocally(workspaceDecision)
  }

  async extractSessionLearnings(sessionId: string, sessionPath: string): Promise<SessionLearning | null> {
    try {
      // Read session context and logs to extract learnings
      const contextPath = join(sessionPath, 'context.md')
      const logPath = join(sessionPath, 'session.log')
      
      if (!require('fs').existsSync(contextPath)) {
        logger.warn(`⚠️ Session context not found: ${contextPath}`)
        return null
      }

      const context = readFileSync(contextPath, 'utf-8')
      const logs = require('fs').existsSync(logPath) ? readFileSync(logPath, 'utf-8') : ''
      
      // Extract basic session info
      const libraryMatch = context.match(/\*\*Library\*\*: (.+)/m)
      const taskMatch = context.match(/\*\*Task\*\*: (.+)/m)
      const library = libraryMatch?.[1] || 'unknown'
      const taskType = taskMatch?.[1] || 'unknown'
      
      // Extract decisions made during the session
      const keyDecisions = this.extractDecisionsFromContent(context + logs)
      
      // Extract patterns created
      const patternsCreated = this.extractPatternsFromContent(context + logs)
      
      // Extract lessons learned
      const lessonsLearned = this.extractLessonsFromContent(context + logs)
      
      const learning: SessionLearning = {
        sessionId,
        library,
        taskType,
        outcome: 'completed', // Could be extracted from logs
        duration: 0, // Could be calculated from timestamps
        keyDecisions,
        patternsCreated,
        lessonsLearned,
        recommendations: this.generateRecommendations(keyDecisions, patternsCreated, lessonsLearned)
      }

      logger.info(`🧠 Extracted learnings from session: ${sessionId}`)
      return learning
    } catch (error) {
      logger.error(`❌ Failed to extract session learnings: ${error}`)
      return null
    }
  }

  // Local fallback methods
  
  private recordDecisionLocally(decision: Decision): boolean {
    try {
      const decisionsPath = join(this.workspaceRoot, 'libs', decision.context.library, '.claude', 'decisions.json')
      let decisions: Decision[] = []
      
      if (require('fs').existsSync(decisionsPath)) {
        decisions = JSON.parse(readFileSync(decisionsPath, 'utf-8'))
      }
      
      decisions.push(decision)
      
      // Ensure directory exists
      require('fs').mkdirSync(require('path').dirname(decisionsPath), { recursive: true })
      writeFileSync(decisionsPath, JSON.stringify(decisions, null, 2))
      
      logger.info(`✅ Decision recorded locally: ${decision.title}`)
      return true
    } catch (error) {
      logger.error(`❌ Failed to record decision locally: ${error}`)
      return false
    }
  }

  private recordPatternLocally(pattern: Pattern): boolean {
    try {
      const patternsPath = join(this.workspaceRoot, 'libs', pattern.context.library, '.claude', 'patterns.json')
      let patterns: Pattern[] = []
      
      if (require('fs').existsSync(patternsPath)) {
        patterns = JSON.parse(readFileSync(patternsPath, 'utf-8'))
      }
      
      patterns.push(pattern)
      
      require('fs').mkdirSync(require('path').dirname(patternsPath), { recursive: true })
      writeFileSync(patternsPath, JSON.stringify(patterns, null, 2))
      
      logger.info(`✅ Pattern recorded locally: ${pattern.name}`)
      return true
    } catch (error) {
      logger.error(`❌ Failed to record pattern locally: ${error}`)
      return false
    }
  }

  private searchDecisionsLocally(query: string, library?: string): Decision[] {
    const results: Decision[] = []
    const libsPath = join(this.workspaceRoot, 'libs')
    
    try {
      const libraries = library ? [library] : require('fs').readdirSync(libsPath)
      
      for (const lib of libraries) {
        const decisionsPath = join(libsPath, lib, '.claude', 'decisions.json')
        
        if (require('fs').existsSync(decisionsPath)) {
          const decisions: Decision[] = JSON.parse(readFileSync(decisionsPath, 'utf-8'))
          const matches = decisions.filter(d => 
            d.title.toLowerCase().includes(query.toLowerCase()) ||
            d.description.toLowerCase().includes(query.toLowerCase()) ||
            d.reasoning.toLowerCase().includes(query.toLowerCase())
          )
          results.push(...matches)
        }
      }
    } catch (error) {
      logger.warn(`⚠️ Local decision search failed: ${error}`)
    }
    
    return results
  }

  private getLibraryContextLocally(library: string): any {
    try {
      const contextPath = join(this.workspaceRoot, 'libs', library, '.claude')
      const context: any = { 
        library, 
        scope: 'library',
        decisions: [],
        patterns: [],
        sessionHistory: { sessions: [] }
      }
      
      // Load decisions - ensure always array
      const decisionsPath = join(contextPath, 'decisions.json')
      if (require('fs').existsSync(decisionsPath)) {
        const decisionsData = JSON.parse(readFileSync(decisionsPath, 'utf-8'))
        context.decisions = Array.isArray(decisionsData) ? decisionsData : []
      }
      
      // Load patterns - ensure always array
      const patternsPath = join(contextPath, 'patterns.json')
      if (require('fs').existsSync(patternsPath)) {
        const patternsData = JSON.parse(readFileSync(patternsPath, 'utf-8'))
        context.patterns = Array.isArray(patternsData) ? patternsData : []
      }
      
      // Load session history - ensure proper structure
      const historyPath = join(contextPath, 'session-history.json')
      if (require('fs').existsSync(historyPath)) {
        const historyData = JSON.parse(readFileSync(historyPath, 'utf-8'))
        context.sessionHistory = {
          sessions: Array.isArray(historyData.sessions) ? historyData.sessions : [],
          totalSessions: historyData.totalSessions || 0
        }
      }
      
      return context
    } catch (error) {
      logger.warn(`⚠️ Failed to load local library context: ${error}`)
      return { 
        library, 
        scope: 'library',
        decisions: [],
        patterns: [],
        sessionHistory: { sessions: [] }
      }
    }
  }

  private getWorkspaceContextLocally(): any {
    try {
      const contextPath = join(this.workspaceRoot, '.claude')
      const context: any = { 
        scope: 'workspace',
        decisions: [],
        patterns: [],
        sessionHistory: { sessions: [] }
      }
      
      // Load workspace-level decisions - ensure always array
      const decisionsPath = join(contextPath, 'decisions.json')
      if (require('fs').existsSync(decisionsPath)) {
        const decisionsData = JSON.parse(readFileSync(decisionsPath, 'utf-8'))
        context.decisions = Array.isArray(decisionsData) ? decisionsData : []
      }
      
      // Load workspace-level patterns - ensure always array
      const patternsPath = join(contextPath, 'patterns.json')
      if (require('fs').existsSync(patternsPath)) {
        const patternsData = JSON.parse(readFileSync(patternsPath, 'utf-8'))
        context.patterns = Array.isArray(patternsData) ? patternsData : []
      }
      
      // Load workspace session history - ensure proper structure
      const historyPath = join(contextPath, 'session-history.json')
      if (require('fs').existsSync(historyPath)) {
        const historyData = JSON.parse(readFileSync(historyPath, 'utf-8'))
        context.sessionHistory = {
          sessions: Array.isArray(historyData.sessions) ? historyData.sessions : [],
          totalSessions: historyData.totalSessions || 0
        }
      }
      
      return context
    } catch (error) {
      logger.warn(`⚠️ Failed to load workspace context: ${error}`)
      return { 
        scope: 'workspace',
        decisions: [],
        patterns: [],
        sessionHistory: { sessions: [] }
      }
    }
  }

  private recordWorkspaceDecisionLocally(decision: Decision): boolean {
    try {
      const decisionsPath = join(this.workspaceRoot, '.claude', 'decisions.json')
      let decisions: Decision[] = []
      
      if (require('fs').existsSync(decisionsPath)) {
        decisions = JSON.parse(readFileSync(decisionsPath, 'utf-8'))
      }
      
      decisions.push(decision)
      
      // Ensure directory exists
      require('fs').mkdirSync(require('path').dirname(decisionsPath), { recursive: true })
      writeFileSync(decisionsPath, JSON.stringify(decisions, null, 2))
      
      logger.info(`✅ Workspace decision recorded locally: ${decision.title}`)
      return true
    } catch (error) {
      logger.error(`❌ Failed to record workspace decision locally: ${error}`)
      return false
    }
  }

  private mergeContexts(workspaceContext: any, libraryContext: any, library: string): any {
    // Ensure workspace and library contexts have valid array structures
    const safeWorkspaceContext = {
      decisions: Array.isArray(workspaceContext?.decisions) ? workspaceContext.decisions : [],
      patterns: Array.isArray(workspaceContext?.patterns) ? workspaceContext.patterns : [],
      sessionHistory: Array.isArray(workspaceContext?.sessionHistory) ? workspaceContext.sessionHistory : []
    }
    
    const safeLibraryContext = {
      decisions: Array.isArray(libraryContext?.decisions) ? libraryContext.decisions : [],
      patterns: Array.isArray(libraryContext?.patterns) ? libraryContext.patterns : [],
      sessionHistory: Array.isArray(libraryContext?.sessionHistory) ? libraryContext.sessionHistory : []
    }

    const merged: any = {
      library,
      workspace: safeWorkspaceContext,
      librarySpecific: safeLibraryContext,
      inheritedDecisions: [...safeWorkspaceContext.decisions, ...safeLibraryContext.decisions],
      inheritedPatterns: [...safeWorkspaceContext.patterns, ...safeLibraryContext.patterns],
      inheritanceChain: ['workspace', library]
    }

    // Prioritize library-specific over workspace (library overrides workspace)
    merged.decisions = this.prioritizeLibraryKnowledge(
      safeWorkspaceContext.decisions,
      safeLibraryContext.decisions
    )
    
    merged.patterns = this.prioritizeLibraryKnowledge(
      safeWorkspaceContext.patterns,
      safeLibraryContext.patterns
    )

    // Combine session histories
    const workspaceHistory = workspaceContext.sessionHistory?.sessions || []
    const libraryHistory = libraryContext.sessionHistory?.sessions || []
    merged.sessionHistory = {
      workspace: workspaceHistory,
      library: libraryHistory,
      combined: [...workspaceHistory, ...libraryHistory].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    }

    return merged
  }

  private prioritizeLibraryKnowledge(workspaceItems: any[], libraryItems: any[]): any[] {
    // Library-specific knowledge takes precedence
    const combined = [...workspaceItems, ...libraryItems]
    const seen = new Set()
    
    // Remove duplicates, keeping library version when both exist
    return combined.reverse().filter(item => {
      const key = item.title || item.name || item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).reverse()
  }

  // Content extraction helpers
  
  private extractDecisionsFromContent(content: string): string[] {
    const decisions: string[] = []
    const decisionPatterns = [
      /decided to (.+?)[\.\n]/gi,
      /we chose (.+?) because/gi,
      /implemented (.+?) approach/gi,
      /using (.+?) instead of/gi
    ]
    
    decisionPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        decisions.push(...matches.map(m => m.trim()))
      }
    })
    
    return [...new Set(decisions)] // Remove duplicates
  }

  private extractPatternsFromContent(content: string): string[] {
    const patterns: string[] = []
    const patternIndicators = [
      /created (.+?) pattern/gi,
      /implemented (.+?) utility/gi,
      /added (.+?) helper/gi,
      /built (.+?) component/gi
    ]
    
    patternIndicators.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        patterns.push(...matches.map(m => m.trim()))
      }
    })
    
    return [...new Set(patterns)]
  }

  private extractLessonsFromContent(content: string): string[] {
    const lessons: string[] = []
    const lessonPatterns = [
      /learned that (.+?)[\.\n]/gi,
      /important to (.+?)[\.\n]/gi,
      /should (.+?) next time/gi,
      /avoid (.+?) because/gi
    ]
    
    lessonPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        lessons.push(...matches.map(m => m.trim()))
      }
    })
    
    return [...new Set(lessons)]
  }

  private generateRecommendations(decisions: string[], patterns: string[], lessons: string[]): string[] {
    const recommendations: string[] = []
    
    if (decisions.length > 0) {
      recommendations.push('Document key architectural decisions with reasoning for future reference')
    }
    
    if (patterns.length > 0) {
      recommendations.push('Consider extracting reusable patterns into shared utilities')
    }
    
    if (lessons.length > 0) {
      recommendations.push('Apply lessons learned to improve development practices')
    }
    
    if (decisions.length > 2) {
      recommendations.push('Consider breaking down complex tasks into smaller, focused sessions')
    }
    
    return recommendations
  }
}