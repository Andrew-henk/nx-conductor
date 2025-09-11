export interface SessionManagerExecutorSchema {
  command?: 'status' | 'cleanup' | 'search' | 'terminate' | 'list' | 'logs' | 'commits' | 'stop'
  sessionId?: string
  query?: string
  library?: string
  maxAge?: string
  includeActive?: boolean
  detailed?: boolean
  limit?: number
}