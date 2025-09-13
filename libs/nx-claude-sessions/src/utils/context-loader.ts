import { readFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { logger, ProjectGraph, readProjectsConfigurationFromProjectGraph } from '@nx/devkit'
import { LibraryContext, ClaudeFileContent, SharedResourcesContext, CompressedSessionHistory, LibraryPatterns } from '../types/session.types'
import { KnowledgeManager } from './knowledge-manager'
import { McpIntegration } from './mcp-integration'
import { WorkingMemoryManager } from './working-memory'

export class LibraryContextLoader {
  private workspaceRoot: string
  private projectGraph: ProjectGraph
  private sessionHistoryCache = new Map<string, CompressedSessionHistory>()
  private knowledgeManager: KnowledgeManager
  private mcpIntegration: McpIntegration
  private workingMemoryManager: WorkingMemoryManager

  constructor(workspaceRoot: string, projectGraph: ProjectGraph) {
    this.workspaceRoot = workspaceRoot
    this.projectGraph = projectGraph
    this.knowledgeManager = new KnowledgeManager(workspaceRoot)
    this.mcpIntegration = new McpIntegration(workspaceRoot)
    this.workingMemoryManager = new WorkingMemoryManager(workspaceRoot)
  }

  async loadContext(library: string): Promise<LibraryContext> {
    // Resolve library name to handle both short and full names
    const resolvedLibrary = this.resolveLibraryName(library)
    logger.info(`Loading hierarchical context for library: ${library} -> ${resolvedLibrary}`)

    try {
      // Load hierarchical knowledge with comprehensive error handling
      let hierarchicalKnowledge: any
      
      try {
        hierarchicalKnowledge = await this.mcpIntegration.getHierarchicalContext(resolvedLibrary)
      } catch (error) {
        logger.warn(`Failed to load hierarchical knowledge: ${error}`)
        // Create minimal fallback structure
        hierarchicalKnowledge = {
          workspace: { decisions: [], patterns: [], sessionHistory: [] },
          librarySpecific: { decisions: [], patterns: [], sessionHistory: [] },
          decisions: [],
          patterns: [],
          inheritanceChain: ['workspace', resolvedLibrary]
        }
      }
      
      // Ensure knowledge structure is valid with comprehensive validation
      const workspaceKnowledge = {
        decisions: Array.isArray(hierarchicalKnowledge.workspace?.decisions) ? hierarchicalKnowledge.workspace.decisions : [],
        patterns: Array.isArray(hierarchicalKnowledge.workspace?.patterns) ? hierarchicalKnowledge.workspace.patterns : [],
        sessionHistory: Array.isArray(hierarchicalKnowledge.workspace?.sessionHistory) ? hierarchicalKnowledge.workspace.sessionHistory : []
      }
      
      const libraryKnowledge = {
        decisions: Array.isArray(hierarchicalKnowledge.librarySpecific?.decisions) ? hierarchicalKnowledge.librarySpecific.decisions : [],
        patterns: Array.isArray(hierarchicalKnowledge.librarySpecific?.patterns) ? hierarchicalKnowledge.librarySpecific.patterns : [],
        sessionHistory: Array.isArray(hierarchicalKnowledge.librarySpecific?.sessionHistory) ? hierarchicalKnowledge.librarySpecific.sessionHistory : []
      }
      
      const workspaceDecisions = workspaceKnowledge.decisions.length
      const libraryDecisions = libraryKnowledge.decisions.length
      const workspacePatterns = workspaceKnowledge.patterns.length
      const libraryPatterns = libraryKnowledge.patterns.length
      
      logger.info(`📚 Loaded hierarchical knowledge:`)
      logger.info(`   Workspace: ${workspaceDecisions} decisions, ${workspacePatterns} patterns`)
      logger.info(`   Library: ${libraryDecisions} decisions, ${libraryPatterns} patterns`)
      
      // Update hierarchical knowledge with validated structure
      hierarchicalKnowledge.workspace = workspaceKnowledge
      hierarchicalKnowledge.librarySpecific = libraryKnowledge

      // Load traditional context components + working memory
      const [claudeFile, dependencies, sharedResources, sessionHistory, patterns, workingMemoryContext] = await Promise.all([
        this.loadClaudeFile(resolvedLibrary),
        this.getNxDependencies(resolvedLibrary),
        this.getSharedResourcesContext(resolvedLibrary),
        this.getCompressedSessionHistory(resolvedLibrary),
        this.getLibraryPatterns(resolvedLibrary),
        this.workingMemoryManager.generateSessionContext(resolvedLibrary)
      ])

      // Enhance context with hierarchical knowledge + working memory
      const enhancedContext: LibraryContext = {
        library: resolvedLibrary,
        primary: claudeFile,
        shared: sharedResources,
        dependencies,
        history: sessionHistory,
        patterns,
        // Add hierarchical knowledge with fallback safety
        hierarchicalKnowledge: {
          workspace: hierarchicalKnowledge.workspace,
          library: hierarchicalKnowledge.librarySpecific,
          merged: {
            decisions: Array.isArray(hierarchicalKnowledge.decisions) ? hierarchicalKnowledge.decisions : [],
            patterns: Array.isArray(hierarchicalKnowledge.patterns) ? hierarchicalKnowledge.patterns : [],
            inheritanceChain: Array.isArray(hierarchicalKnowledge.inheritanceChain) ? hierarchicalKnowledge.inheritanceChain : ['workspace', resolvedLibrary]
          }
        },
        // NEW: Add working memory for session continuity
        workingMemory: workingMemoryContext
      }

      return enhancedContext
      
    } catch (error) {
      logger.error(`Failed to load enhanced context for ${resolvedLibrary}: ${error}`)
      
      // Load traditional context as fallback
      logger.info(`Falling back to traditional context loading for ${resolvedLibrary}`)
      
      const [claudeFile, dependencies, sharedResources, sessionHistory, patterns, workingMemoryContext] = await Promise.all([
        this.loadClaudeFile(resolvedLibrary),
        this.getNxDependencies(resolvedLibrary),
        this.getSharedResourcesContext(resolvedLibrary),
        this.getCompressedSessionHistory(resolvedLibrary),
        this.getLibraryPatterns(resolvedLibrary),
        this.workingMemoryManager.generateSessionContext(resolvedLibrary)
      ])

      // Return basic context without hierarchical knowledge but with working memory
      return {
        library: resolvedLibrary,
        primary: claudeFile,
        shared: sharedResources,
        dependencies,
        history: sessionHistory,
        patterns,
        hierarchicalKnowledge: {
          workspace: { decisions: [], patterns: [], sessionHistory: [] },
          library: { decisions: [], patterns: [], sessionHistory: [] },
          merged: {
            decisions: [],
            patterns: [],
            inheritanceChain: ['workspace', resolvedLibrary]
          }
        },
        workingMemory: workingMemoryContext
      }
    }
  }

  private async loadClaudeFile(library: string): Promise<ClaudeFileContent> {
    const projectConfig = this.projectGraph.nodes[library]
    if (!projectConfig) {
      throw new Error(`Library ${library} not found in project graph`)
    }

    const claudeFilePath = join(projectConfig.data.root, 'claude.md')
    const fullPath = resolve(this.workspaceRoot, claudeFilePath)

    if (!existsSync(fullPath)) {
      logger.warn(`No claude.md found for ${library}, creating default template`)
      return this.createDefaultClaudeFile(library, fullPath)
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const stats = statSync(fullPath)
      
      return {
        path: fullPath,
        content,
        lastModified: stats.mtime
      }
    } catch (error) {
      logger.error(`Failed to read claude.md for ${library}: ${error}`)
      throw new Error(`Could not load context file for ${library}`)
    }
  }

  private createDefaultClaudeFile(library: string, filePath: string): ClaudeFileContent {
    const projectConfig = this.projectGraph.nodes[library]
    const defaultContent = `# ${library} Library Context

## Purpose
[Describe the purpose and responsibilities of this library]

## Architecture
[Describe key architectural patterns and design decisions]

## Dependencies
- Internal: ${this.getNxDependenciesSync(library).filter(dep => this.projectGraph.nodes[dep]).join(', ') || 'None'}
- External: [List external dependencies from package.json]

## Established Patterns
[Document coding conventions and established patterns]

## Integration Points
[Describe how this library integrates with other parts of the system]

## Known Issues & Solutions
[Document common issues and their solutions]

## Testing Strategy
[Describe testing approach and requirements]
    `.trim()

    return {
      path: filePath,
      content: defaultContent,
      lastModified: new Date()
    }
  }

  private getNxDependenciesSync(library: string): string[] {
    const projectConfig = this.projectGraph.nodes[library]
    if (!projectConfig) return []

    return this.projectGraph.dependencies[library]?.map(dep => dep.target) || []
  }

  private async getNxDependencies(library: string): Promise<string[]> {
    return this.getNxDependenciesSync(library)
  }

  private async getSharedResourcesContext(library: string): Promise<SharedResourcesContext> {
    const dependencies = await this.getNxDependencies(library)
    const sharedDeps = dependencies.filter(dep => dep.startsWith('shared-') || dep.includes('shared'))

    const context: SharedResourcesContext = {
      types: {},
      utilities: {},
      configurations: {}
    }

    for (const sharedDep of sharedDeps) {
      try {
        await this.loadSharedResourceContent(sharedDep, context)
      } catch (error) {
        logger.warn(`Could not load shared resource ${sharedDep}: ${error}`)
      }
    }

    return context
  }

  private async loadSharedResourceContent(sharedLib: string, context: SharedResourcesContext): Promise<void> {
    const projectConfig = this.projectGraph.nodes[sharedLib]
    if (!projectConfig) return

    const libRoot = resolve(this.workspaceRoot, projectConfig.data.root)
    
    const indexPath = join(libRoot, 'src', 'index.ts')
    if (existsSync(indexPath)) {
      const indexContent = readFileSync(indexPath, 'utf-8')
      
      if (indexContent.includes('export type') || indexContent.includes('interface')) {
        context.types[sharedLib] = this.extractTypeDefinitions(indexContent)
      }
      
      if (indexContent.includes('export function') || indexContent.includes('export const')) {
        context.utilities[sharedLib] = this.extractUtilityFunctions(indexContent)
      }
    }

    const configPaths = [
      join(libRoot, 'config.ts'),
      join(libRoot, 'src', 'config.ts'),
      join(libRoot, 'constants.ts'),
      join(libRoot, 'src', 'constants.ts')
    ]

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8')
        context.configurations[sharedLib] = this.extractConfigurations(configContent)
        break
      }
    }
  }

  private extractTypeDefinitions(content: string): string {
    const typeRegex = /export (type|interface)\s+\w+[^}]+}/g
    const matches = content.match(typeRegex)
    return matches?.slice(0, 5).join('\n\n') || ''
  }

  private extractUtilityFunctions(content: string): string {
    const functionRegex = /export (function|const)\s+\w+[^}]+}/g
    const matches = content.match(functionRegex)
    return matches?.slice(0, 3).join('\n\n') || ''
  }

  private extractConfigurations(content: string): any {
    try {
      const configRegex = /export const \w+Config\s*=\s*({[^}]+})/g
      const matches = content.match(configRegex)
      return matches?.slice(0, 2).join('\n') || {}
    } catch {
      return {}
    }
  }

  private async getCompressedSessionHistory(library: string): Promise<CompressedSessionHistory> {
    if (this.sessionHistoryCache.has(library)) {
      return this.sessionHistoryCache.get(library)!
    }

    const history = await this.knowledgeManager.loadLibraryKnowledge(library)
    this.sessionHistoryCache.set(library, history)
    return history
  }

  private async getLibraryPatterns(library: string): Promise<LibraryPatterns> {
    const projectConfig = this.projectGraph.nodes[library]
    if (!projectConfig) {
      return this.getDefaultPatterns()
    }

    const libRoot = resolve(this.workspaceRoot, projectConfig.data.root)
    
    return {
      codingConventions: await this.extractCodingConventions(libRoot),
      architecturalPatterns: await this.extractArchitecturalPatterns(libRoot),
      testingApproaches: await this.extractTestingApproaches(libRoot),
      commonDependencies: await this.extractCommonDependencies(library),
      integrationPoints: await this.extractIntegrationPoints(library)
    }
  }

  private async extractCodingConventions(libRoot: string): Promise<string[]> {
    const conventions: string[] = []

    const eslintPath = join(libRoot, '.eslintrc.json')
    if (existsSync(eslintPath)) {
      conventions.push('ESLint configuration present')
    }

    const prettierPath = join(libRoot, '.prettierrc')
    if (existsSync(prettierPath)) {
      conventions.push('Prettier configuration present')
    }

    const srcFiles = this.findSourceFiles(libRoot, 3)
    if (srcFiles.length > 0) {
      const firstFile = readFileSync(srcFiles[0], 'utf-8')
      
      if (firstFile.includes("'use strict'")) {
        conventions.push('Strict mode enabled')
      }
      
      if (firstFile.includes('export interface') || firstFile.includes('export type')) {
        conventions.push('TypeScript types exported')
      }
      
      if (firstFile.includes('/**')) {
        conventions.push('JSDoc documentation used')
      }
    }

    return conventions.length > 0 ? conventions : ['Standard TypeScript conventions']
  }

  private async extractArchitecturalPatterns(libRoot: string): Promise<string[]> {
    const patterns: string[] = []
    const srcFiles = this.findSourceFiles(libRoot, 5)

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8')
      
      if (content.includes('class ') && content.includes('constructor')) {
        patterns.push('Class-based architecture')
      }
      
      if (content.includes('export const') && content.includes('= (')) {
        patterns.push('Functional programming approach')
      }
      
      if (content.includes('interface') && content.includes('Service')) {
        patterns.push('Service layer pattern')
      }
      
      if (content.includes('Observable') || content.includes('Subject')) {
        patterns.push('Reactive programming')
      }
    }

    return patterns.length > 0 ? patterns : ['Standard library structure']
  }

  private async extractTestingApproaches(libRoot: string): Promise<string[]> {
    const approaches: string[] = []

    if (existsSync(join(libRoot, 'jest.config.ts'))) {
      approaches.push('Jest testing framework')
    }

    const testFiles = this.findFiles(libRoot, /\.(test|spec)\.ts$/, 3)
    if (testFiles.length > 0) {
      const testContent = readFileSync(testFiles[0], 'utf-8')
      
      if (testContent.includes('describe(')) {
        approaches.push('BDD-style test organization')
      }
      
      if (testContent.includes('@testing-library')) {
        approaches.push('Testing Library for component tests')
      }
      
      if (testContent.includes('mock')) {
        approaches.push('Mocking for unit tests')
      }
    }

    return approaches.length > 0 ? approaches : ['Standard unit testing']
  }

  private async extractCommonDependencies(library: string): Promise<string[]> {
    const projectConfig = this.projectGraph.nodes[library]
    if (!projectConfig) return []

    const libRoot = resolve(this.workspaceRoot, projectConfig.data.root)
    const packageJsonPath = join(libRoot, 'package.json')

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        return Object.keys(packageJson.dependencies || {}).slice(0, 10)
      } catch {
        return []
      }
    }

    return this.getNxDependenciesSync(library).slice(0, 5)
  }

  private async extractIntegrationPoints(library: string): Promise<string[]> {
    const dependencies = await this.getNxDependencies(library)
    const dependents = Object.keys(this.projectGraph.dependencies)
      .filter(key => this.projectGraph.dependencies[key]?.some(dep => dep.target === library))

    const integrations: string[] = []
    
    if (dependencies.length > 0) {
      integrations.push(`Depends on: ${dependencies.slice(0, 3).join(', ')}`)
    }
    
    if (dependents.length > 0) {
      integrations.push(`Used by: ${dependents.slice(0, 3).join(', ')}`)
    }

    return integrations
  }

  private findSourceFiles(root: string, limit: number = 5): string[] {
    return this.findFiles(root, /\.ts$/, limit).filter(file => !file.includes('.test.') && !file.includes('.spec.'))
  }

  private findFiles(root: string, pattern: RegExp, limit: number = 5): string[] {
    const files: string[] = []
    
    try {
      const srcDir = join(root, 'src')
      if (existsSync(srcDir)) {
        this.walkDirectory(srcDir, pattern, files, limit)
      }
    } catch (error) {
      logger.warn(`Error walking directory ${root}: ${error}`)
    }

    return files
  }

  private walkDirectory(dir: string, pattern: RegExp, files: string[], limit: number): void {
    if (files.length >= limit) return

    try {
      const entries = require('fs').readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (files.length >= limit) break

        const fullPath = join(dir, entry.name)
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          this.walkDirectory(fullPath, pattern, files, limit)
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      logger.warn(`Error reading directory ${dir}: ${error}`)
    }
  }

  private getDefaultPatterns(): LibraryPatterns {
    return {
      codingConventions: ['TypeScript strict mode', 'ESLint configuration', 'Prettier formatting'],
      architecturalPatterns: ['Modular exports', 'Type-safe interfaces', 'Single responsibility'],
      testingApproaches: ['Jest unit tests', 'Test-driven development'],
      commonDependencies: ['@nx/devkit', 'tslib'],
      integrationPoints: ['Standard NX library structure']
    }
  }

  clearCache(): void {
    this.sessionHistoryCache.clear()
    logger.info('Context loader cache cleared')
  }

  /**
   * Access working memory manager for session updates
   */
  getWorkingMemoryManager(): WorkingMemoryManager {
    return this.workingMemoryManager
  }

  /**
   * Resolve library name to handle both short and full names
   * Examples: "editor-core" -> "@manuscript/editor-core", "@manuscript/editor-core" -> "@manuscript/editor-core"
   */
  private resolveLibraryName(library: string): string {
    // If library is already in project graph, use it as-is
    if (this.projectGraph.nodes[library]) {
      return library
    }

    // Try to find library by short name
    const allProjects = Object.keys(this.projectGraph.nodes)
    
    // Look for exact match with scoped names
    const scopedMatch = allProjects.find(proj => 
      proj.includes(`/${library}`) || proj.endsWith(`-${library}`)
    )
    if (scopedMatch) {
      return scopedMatch
    }

    // Look for partial match at end of name
    const partialMatch = allProjects.find(proj => 
      proj.split('/').pop() === library || proj.split('-').pop() === library
    )
    if (partialMatch) {
      return partialMatch
    }

    // Look for fuzzy match
    const fuzzyMatch = allProjects.find(proj => 
      proj.toLowerCase().includes(library.toLowerCase())
    )
    if (fuzzyMatch) {
      logger.warn(`Using fuzzy match for library '${library}': found '${fuzzyMatch}'`)
      return fuzzyMatch
    }

    // If no match found, return original and let downstream handle the error
    logger.warn(`Library '${library}' not found in project graph. Available: ${allProjects.slice(0, 5).join(', ')}...`)
    return library
  }
}