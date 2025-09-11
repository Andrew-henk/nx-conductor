export interface SessionManagerExecutorSchema {
  command?: 'status' | 'cleanup' | 'search' | 'terminate' | 'list'
  sessionId?: string
  query?: string
  library?: string
  maxAge?: string
  includeActive?: boolean
  detailed?: boolean
}