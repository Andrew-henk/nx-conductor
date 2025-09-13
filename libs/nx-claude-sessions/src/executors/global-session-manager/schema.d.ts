export interface GlobalSessionManagerExecutorSchema {
  command: 'status' | 'list' | 'cleanup' | 'search' | 'terminate';
  query?: string;
  sessionId?: string;
  maxAge?: string;
}