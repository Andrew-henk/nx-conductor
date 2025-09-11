import type { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit'

export interface NxClaudeSessionsConfig {
  maxConcurrency: number
  sessionTimeout: string
  knowledgeRetention: string
  orchestrationStrategy: 'dependency-aware' | 'parallel' | 'sequential'
  autoTransitions: {
    enabled: boolean
    crossLibraryThreshold: number
    topicShiftConfidence: number
  }
  sessionStorage: {
    path: string
    compressionInterval: string
    maxHistorySize: number
  }
}

export interface NxProjectContext {
  project: ProjectGraphProjectNode
  dependencies: string[]
  dependents: string[]
  sharedResources: string[]
  criticalPath: boolean
}

export interface NxWorkspaceContext {
  projectGraph: ProjectGraph
  libraries: string[]
  sharedLibraries: string[]
  rootConfig: any
  tsConfig: any
}

export interface FeatureScope {
  primaryLibraries: string[]
  secondaryLibraries: string[]
  sharedResources: string[]
  coordinationRequired: boolean
  estimatedSessionCount: number
}

export interface OrchestrationPlan {
  phases: OrchestrationPhase[]
  totalEstimatedTime: number
  concurrencyMap: Map<string, number>
  coordinationPoints: CoordinationPoint[]
}

export interface OrchestrationPhase {
  phase: number
  libraries: string[]
  parallelizable: boolean
  dependencies: string[]
  estimatedDuration: number
}

export interface CoordinationPoint {
  phase: number
  libraries: string[]
  coordinationType: 'sync' | 'async' | 'handoff'
  trigger: string
  actions: string[]
}