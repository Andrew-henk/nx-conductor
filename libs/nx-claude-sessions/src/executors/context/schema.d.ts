export interface ContextExecutorSchema {
  command: 'load' | 'inject' | 'analyze' | 'suggest-libraries' | 'check-dependencies' | 'generate-plan'
  library?: string
  task?: string
  format?: 'markdown' | 'json' | 'text'
}