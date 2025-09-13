export interface NxClaudeSessionsPluginOptions {
  maxConcurrency?: number;
  sessionTimeout?: string;
  knowledgeRetention?: string;
  orchestrationStrategy?: 'dependency-aware' | 'parallel' | 'sequential';
  autoTransitions?: {
    enabled: boolean;
    crossLibraryThreshold: number;
    topicShiftConfidence: number;
  };
  sessionStorage?: {
    path: string;
    compressionInterval: string;
    maxHistorySize: number;
  };
}

export default {
  name: 'nx-claude-sessions'
};