export interface MemoryExecutorSchema {
  command: 'update' | 'show' | 'track' | 'suggest-next' | 'find-related' | 'checkpoint' | 'cleanup'
  library?: string
  type?: 'todo' | 'completed' | 'blocked' | 'question' | 'change'
  content?: string
  query?: string
}