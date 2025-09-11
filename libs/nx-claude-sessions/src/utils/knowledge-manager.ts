import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { logger } from '@nx/devkit'
import { 
  CompressedSessionHistory, 
  DistilledKnowledge, 
  SessionSummary, 
  CodePattern,
  ArchitecturalDecision,
  ReusableSolution,
  KnownIssue,
  CrossLibraryInsight
} from '../types/session.types'

export interface SessionKnowledgeInput {
  sessionId: string
  library: string
  startTime: Date
  endTime: Date
  taskType: string
  outcome: 'success' | 'partial' | 'failed'
  conversationLog: string[]
  artifactsCreated: string[]
  errorsEncountered: string[]
}

export class KnowledgeManager {
  private workspaceRoot: string
  private knowledgeStoragePath: string

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
    this.knowledgeStoragePath = join(workspaceRoot, '.nx-claude-sessions', 'history')
    this.ensureStorageDirectories()
  }

  async persistSessionKnowledge(sessionData: SessionKnowledgeInput): Promise<void> {
    logger.info(`🧠 Distilling knowledge from session: ${sessionData.sessionId}`)
    
    try {
      const distilledKnowledge = await this.distillSessionKnowledge(sessionData)
      const sessionSummary = this.createSessionSummary(sessionData)
      
      await this.updateLibraryKnowledge(sessionData.library, sessionSummary, distilledKnowledge)
      
      logger.info(`✅ Knowledge persisted for ${sessionData.library}`)
    } catch (error) {
      logger.error(`❌ Failed to persist knowledge: ${error}`)
    }
  }

  async loadLibraryKnowledge(library: string): Promise<CompressedSessionHistory> {
    const knowledgeFile = join(this.knowledgeStoragePath, `${library}.json`)
    
    if (!existsSync(knowledgeFile)) {
      return this.createEmptyKnowledgeBase()
    }

    try {
      const data = readFileSync(knowledgeFile, 'utf-8')
      const knowledge = JSON.parse(data) as CompressedSessionHistory
      
      // Convert date strings back to Date objects
      knowledge.lastCompressionDate = new Date(knowledge.lastCompressionDate)
      knowledge.recentSessions = knowledge.recentSessions.map(session => ({
        ...session,
        date: new Date(session.date)
      }))
      
      return knowledge
    } catch (error) {
      logger.warn(`Could not load knowledge for ${library}: ${error}`)
      return this.createEmptyKnowledgeBase()
    }
  }

  async searchKnowledge(query: string, library?: string): Promise<{
    patterns: CodePattern[]
    solutions: ReusableSolution[]
    decisions: ArchitecturalDecision[]
    insights: CrossLibraryInsight[]
  }> {
    const queryLower = query.toLowerCase()
    const results = {
      patterns: [] as CodePattern[],
      solutions: [] as ReusableSolution[],
      decisions: [] as ArchitecturalDecision[],
      insights: [] as CrossLibraryInsight[]
    }

    const librariesToSearch = library ? [library] : await this.getAllLibraries()

    for (const lib of librariesToSearch) {
      const knowledge = await this.loadLibraryKnowledge(lib)
      const accumulated = knowledge.accumulatedKnowledge

      // Search patterns
      results.patterns.push(...accumulated.patterns.filter(pattern =>
        pattern.pattern.toLowerCase().includes(queryLower) ||
        pattern.description.toLowerCase().includes(queryLower) ||
        pattern.context.toLowerCase().includes(queryLower)
      ))

      // Search solutions
      results.solutions.push(...accumulated.solutions.filter(solution =>
        solution.problem.toLowerCase().includes(queryLower) ||
        solution.solution.toLowerCase().includes(queryLower)
      ))

      // Search decisions
      results.decisions.push(...accumulated.decisions.filter(decision =>
        decision.decision.toLowerCase().includes(queryLower) ||
        decision.rationale.toLowerCase().includes(queryLower)
      ))

      // Search insights
      results.insights.push(...accumulated.crossLibraryLearnings.filter(insight =>
        insight.insight.toLowerCase().includes(queryLower) ||
        insight.libraries.some(l => l.toLowerCase().includes(queryLower))
      ))
    }

    return results
  }

  async compressOldSessions(library: string, maxRecentSessions: number = 10): Promise<void> {
    const knowledge = await this.loadLibraryKnowledge(library)
    
    if (knowledge.recentSessions.length <= maxRecentSessions) {
      return // No compression needed
    }

    logger.info(`📦 Compressing sessions for ${library}`)

    const sessionsToCompress = knowledge.recentSessions.slice(maxRecentSessions)
    const additionalKnowledge = await this.extractKnowledgeFromSessions(sessionsToCompress)

    // Merge with existing knowledge
    knowledge.accumulatedKnowledge = this.mergeKnowledge(
      knowledge.accumulatedKnowledge,
      additionalKnowledge
    )

    // Keep only recent sessions
    knowledge.recentSessions = knowledge.recentSessions.slice(0, maxRecentSessions)
    knowledge.lastCompressionDate = new Date()

    await this.saveLibraryKnowledge(library, knowledge)
    
    logger.info(`✅ Compressed ${sessionsToCompress.length} sessions for ${library}`)
  }

  private async distillSessionKnowledge(sessionData: SessionKnowledgeInput): Promise<DistilledKnowledge> {
    const patterns = this.extractCodePatterns(sessionData)
    const decisions = this.extractArchitecturalDecisions(sessionData)
    const solutions = this.extractReusableSolutions(sessionData)
    const pitfalls = this.extractKnownIssues(sessionData)
    const crossLibraryLearnings = this.extractCrossLibraryInsights(sessionData)

    return {
      patterns,
      decisions,
      solutions,
      pitfalls,
      crossLibraryLearnings
    }
  }

  private extractCodePatterns(sessionData: SessionKnowledgeInput): CodePattern[] {
    const patterns: CodePattern[] = []
    
    // Look for common code patterns in the conversation
    const codeBlocks = this.extractCodeBlocks(sessionData.conversationLog)
    const commonPatterns = [
      { pattern: 'async/await', keywords: ['async', 'await', 'Promise'] },
      { pattern: 'error-handling', keywords: ['try', 'catch', 'throw', 'Error'] },
      { pattern: 'type-guards', keywords: ['instanceof', 'typeof', 'is'] },
      { pattern: 'react-hooks', keywords: ['useState', 'useEffect', 'useCallback'] },
      { pattern: 'dependency-injection', keywords: ['inject', 'provider', 'service'] }
    ]

    commonPatterns.forEach(({ pattern, keywords }) => {
      const relevantBlocks = codeBlocks.filter(block => 
        keywords.some(keyword => block.includes(keyword))
      )
      
      if (relevantBlocks.length > 0) {
        patterns.push({
          pattern,
          description: `Found ${relevantBlocks.length} usage(s) of ${pattern} pattern`,
          context: sessionData.library,
          examples: relevantBlocks.slice(0, 2),
          confidence: Math.min(relevantBlocks.length * 0.3, 1.0)
        })
      }
    })

    return patterns
  }

  private extractArchitecturalDecisions(sessionData: SessionKnowledgeInput): ArchitecturalDecision[] {
    const decisions: ArchitecturalDecision[] = []
    
    // Look for architectural decisions in conversation
    const decisionKeywords = ['decided', 'chose', 'approach', 'architecture', 'design', 'pattern']
    const relevantMessages = sessionData.conversationLog.filter(msg =>
      decisionKeywords.some(keyword => msg.toLowerCase().includes(keyword))
    )

    if (relevantMessages.length > 0) {
      decisions.push({
        decision: `Architectural approach for ${sessionData.taskType} in ${sessionData.library}`,
        rationale: relevantMessages[0] || 'Session contained architectural discussion',
        alternatives: [],
        consequences: sessionData.outcome === 'success' ? ['Successful implementation'] : ['Needs refinement'],
        date: sessionData.endTime
      })
    }

    return decisions
  }

  private extractReusableSolutions(sessionData: SessionKnowledgeInput): ReusableSolution[] {
    const solutions: ReusableSolution[] = []
    
    if (sessionData.outcome === 'success' && sessionData.errorsEncountered.length > 0) {
      sessionData.errorsEncountered.forEach(error => {
        solutions.push({
          problem: error,
          solution: `Successfully resolved during ${sessionData.taskType} task`,
          prerequisites: [`Working in ${sessionData.library} library`],
          variations: [],
          applicableContexts: [sessionData.library, 'similar-libraries']
        })
      })
    }

    return solutions
  }

  private extractKnownIssues(sessionData: SessionKnowledgeInput): KnownIssue[] {
    const issues: KnownIssue[] = []
    
    if (sessionData.outcome === 'failed' || sessionData.errorsEncountered.length > 0) {
      sessionData.errorsEncountered.forEach(error => {
        issues.push({
          issue: error,
          symptoms: ['Session encountered this error'],
          rootCause: 'To be investigated further',
          workarounds: sessionData.outcome === 'partial' ? ['Partial solution found'] : [],
          permanentSolution: sessionData.outcome === 'success' ? 'Solution implemented' : undefined
        })
      })
    }

    return issues
  }

  private extractCrossLibraryInsights(sessionData: SessionKnowledgeInput): CrossLibraryInsight[] {
    const insights: CrossLibraryInsight[] = []
    
    // Look for mentions of other libraries in the conversation
    const libraryMentions = this.findLibraryMentions(sessionData.conversationLog)
    
    if (libraryMentions.length > 0) {
      insights.push({
        libraries: [sessionData.library, ...libraryMentions],
        insight: `Integration work involving ${sessionData.library} and ${libraryMentions.join(', ')}`,
        implications: ['Cross-library coordination may be needed'],
        coordinationRequired: true
      })
    }

    return insights
  }

  private extractCodeBlocks(conversationLog: string[]): string[] {
    const codeBlocks: string[] = []
    
    conversationLog.forEach(msg => {
      // Simple extraction of code blocks (would be more sophisticated in real implementation)
      const matches = msg.match(/```[\s\S]*?```/g) || []
      codeBlocks.push(...matches.map(match => match.replace(/```\w*\n?/g, '')))
    })

    return codeBlocks
  }

  private findLibraryMentions(conversationLog: string[]): string[] {
    const commonLibraryNames = ['auth', 'api', 'ui', 'shared', 'common', 'utils', 'database', 'web-app', 'mobile-app']
    const mentions = new Set<string>()
    
    conversationLog.forEach(msg => {
      commonLibraryNames.forEach(lib => {
        if (msg.toLowerCase().includes(lib)) {
          mentions.add(lib)
        }
      })
    })

    return Array.from(mentions)
  }

  private createSessionSummary(sessionData: SessionKnowledgeInput): SessionSummary {
    return {
      id: sessionData.sessionId,
      date: sessionData.endTime,
      taskType: sessionData.taskType,
      outcome: sessionData.outcome,
      keyDecisions: [], // Would extract from conversation in real implementation
      artifactsCreated: sessionData.artifactsCreated
    }
  }

  private async updateLibraryKnowledge(
    library: string, 
    sessionSummary: SessionSummary, 
    distilledKnowledge: DistilledKnowledge
  ): Promise<void> {
    const currentKnowledge = await this.loadLibraryKnowledge(library)
    
    // Add new session to recent sessions
    currentKnowledge.recentSessions.unshift(sessionSummary)
    currentKnowledge.totalSessionCount += 1
    
    // Merge new knowledge with existing
    currentKnowledge.accumulatedKnowledge = this.mergeKnowledge(
      currentKnowledge.accumulatedKnowledge,
      distilledKnowledge
    )

    await this.saveLibraryKnowledge(library, currentKnowledge)
  }

  private mergeKnowledge(existing: DistilledKnowledge, additional: DistilledKnowledge): DistilledKnowledge {
    return {
      patterns: [...existing.patterns, ...additional.patterns],
      decisions: [...existing.decisions, ...additional.decisions],
      solutions: [...existing.solutions, ...additional.solutions],
      pitfalls: [...existing.pitfalls, ...additional.pitfalls],
      crossLibraryLearnings: [...existing.crossLibraryLearnings, ...additional.crossLibraryLearnings]
    }
  }

  private async extractKnowledgeFromSessions(sessions: SessionSummary[]): Promise<DistilledKnowledge> {
    // Simplified extraction from session summaries
    return {
      patterns: [],
      decisions: sessions.map(session => ({
        decision: `Session outcome: ${session.outcome}`,
        rationale: `Based on ${session.taskType} task`,
        alternatives: [],
        consequences: [],
        date: session.date
      })),
      solutions: [],
      pitfalls: sessions.filter(s => s.outcome === 'failed').map(session => ({
        issue: `Failed ${session.taskType} task`,
        symptoms: ['Session marked as failed'],
        rootCause: 'Unknown',
        workarounds: []
      })),
      crossLibraryLearnings: []
    }
  }

  private createEmptyKnowledgeBase(): CompressedSessionHistory {
    return {
      recentSessions: [],
      accumulatedKnowledge: {
        patterns: [],
        decisions: [],
        solutions: [],
        pitfalls: [],
        crossLibraryLearnings: []
      },
      totalSessionCount: 0,
      lastCompressionDate: new Date()
    }
  }

  private async saveLibraryKnowledge(library: string, knowledge: CompressedSessionHistory): Promise<void> {
    const knowledgeFile = join(this.knowledgeStoragePath, `${library}.json`)
    writeFileSync(knowledgeFile, JSON.stringify(knowledge, null, 2))
  }

  private async getAllLibraries(): Promise<string[]> {
    try {
      const files = require('fs').readdirSync(this.knowledgeStoragePath)
      return files
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => file.replace('.json', ''))
    } catch {
      return []
    }
  }

  private ensureStorageDirectories(): void {
    if (!existsSync(this.knowledgeStoragePath)) {
      mkdirSync(this.knowledgeStoragePath, { recursive: true })
    }
  }
}