export interface SessionInstance {
  id: string
  library: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  taskDescriptor: TaskDescriptor
  contextLoaded: LibraryContext
  claudeCodeProcess?: any
}

export interface TaskDescriptor {
  type: 'feature' | 'bug-fix' | 'refactor' | 'test' | 'documentation'
  description: string
  scope: string[]
  priority: number
  estimatedComplexity: 'low' | 'medium' | 'high'
  crossLibraryDependencies?: string[]
}

export interface LibraryContext {
  library: string
  primary: ClaudeFileContent
  shared: SharedResourcesContext
  dependencies: string[]
  history: CompressedSessionHistory
  patterns: LibraryPatterns
}

export interface ClaudeFileContent {
  path: string
  content: string
  lastModified: Date
}

export interface SharedResourcesContext {
  types: Record<string, string>
  utilities: Record<string, string>
  configurations: Record<string, any>
}

export interface CompressedSessionHistory {
  recentSessions: SessionSummary[]
  accumulatedKnowledge: DistilledKnowledge
  totalSessionCount: number
  lastCompressionDate: Date
}

export interface SessionSummary {
  id: string
  date: Date
  taskType: string
  outcome: 'success' | 'partial' | 'failed'
  keyDecisions: string[]
  artifactsCreated: string[]
}

export interface DistilledKnowledge {
  patterns: CodePattern[]
  decisions: ArchitecturalDecision[]
  solutions: ReusableSolution[]
  pitfalls: KnownIssue[]
  crossLibraryLearnings: CrossLibraryInsight[]
}

export interface CodePattern {
  pattern: string
  description: string
  context: string
  examples: string[]
  confidence: number
}

export interface ArchitecturalDecision {
  decision: string
  rationale: string
  alternatives: string[]
  consequences: string[]
  date: Date
}

export interface ReusableSolution {
  problem: string
  solution: string
  prerequisites: string[]
  variations: string[]
  applicableContexts: string[]
}

export interface KnownIssue {
  issue: string
  symptoms: string[]
  rootCause: string
  workarounds: string[]
  permanentSolution?: string
}

export interface CrossLibraryInsight {
  libraries: string[]
  insight: string
  implications: string[]
  coordinationRequired: boolean
}

export interface LibraryPatterns {
  codingConventions: string[]
  architecturalPatterns: string[]
  testingApproaches: string[]
  commonDependencies: string[]
  integrationPoints: string[]
}

export interface SessionCommunication {
  coordinationNamespace: string
  notifySharedResourceChange(resource: string, change: ChangeDescriptor): Promise<void>
  requestCrossLibraryConsultation(query: string): Promise<ConsultationResponse>
}

export interface ChangeDescriptor {
  type: 'interface' | 'implementation' | 'configuration' | 'dependency'
  resource: string
  changes: string[]
  impact: 'breaking' | 'non-breaking' | 'enhancement'
}

export interface ConsultationResponse {
  response: string
  confidence: number
  suggestedActions: string[]
  requiresCoordination: boolean
}