export interface InitGeneratorSchema {
  maxConcurrency?: number
  sessionTimeout?: string
  knowledgeRetention?: string
  orchestrationStrategy?: 'dependency-aware' | 'parallel' | 'sequential'
  autoTransitions?: boolean
  skipFormat?: boolean
}