export interface PassthroughExecutorSchema {
  args?: string[]
  library?: string
  includeContext?: boolean
  dangerouslySkipPermissions?: boolean
  customClaudePath?: string
  workingDirectory?: string
  timeout?: string
  interactive?: boolean
}