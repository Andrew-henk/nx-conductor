export interface OrchestrationExecutorSchema {
  feature: string
  libraries?: string[]
  maxSessions?: number
  strategy?: 'dependency-aware' | 'parallel' | 'sequential'
  priority?: number
  dryRun?: boolean
  timeout?: string
  coordinationMode?: 'automatic' | 'manual' | 'hybrid'
  includeTests?: boolean
  passthroughArgs?: string[]
  dangerouslySkipPermissions?: boolean
  customClaudePath?: string
  rawMode?: boolean
}