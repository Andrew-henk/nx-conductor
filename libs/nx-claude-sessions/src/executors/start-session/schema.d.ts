export interface StartSessionExecutorSchema {
  library: string
  task: string
  taskType?: 'feature' | 'bug-fix' | 'refactor' | 'test' | 'documentation'
  priority?: number
  complexity?: 'low' | 'medium' | 'high'
  scope?: string[]
  timeout?: string
  contextRefresh?: boolean
  passthroughArgs?: string[]
  dangerouslySkipPermissions?: boolean
  customClaudePath?: string
  rawMode?: boolean
}