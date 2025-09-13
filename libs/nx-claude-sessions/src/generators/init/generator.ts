import {
  Tree,
  formatFiles,
  updateJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  getProjects,
  updateProjectConfiguration,
  logger,
  workspaceRoot
} from '@nx/devkit'
import { InitGeneratorSchema } from './schema'
import { join } from 'path'
import { readFileSync } from 'fs'

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  logger.info('Initializing NX Claude Sessions plugin...')
  
  // Pre-flight compatibility checks
  try {
    await performCompatibilityChecks(tree)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Compatibility check failed: ${errorMessage}`)
    logger.info('')
    logger.info('💡 Troubleshooting:')
    if (errorMessage.includes('lockfile')) {
      logger.info('• Try: npx nx reset && rm package-lock.json && npm install')
      logger.info('• Or use manual init: npx nx-claude-sessions-manual-init')
    }
    logger.info('• Check docs: https://github.com/Andrew-henk/nx-conductor#troubleshooting')
    throw error
  }
  
  const normalizedOptions = normalizeOptions(options)
  
  try {
    await addPluginToNxConfig(tree, normalizedOptions)
    await createSessionStorageDirectories(tree)
    await generateConfigurationFiles(tree, normalizedOptions)
    await generateLibraryClaudeTemplates(tree)
    await addExecutorsToProjects(tree, normalizedOptions)
    await setupIntelligentSessions(tree, normalizedOptions)
    
    if (!options.skipFormat) {
      await formatFiles(tree)
    }
    
    logger.info('✅ NX Claude Sessions plugin initialized successfully!')
    logger.info('')
    logger.info('📋 Available commands:')
    logger.info('')
    logger.info('🏗️  Project-specific:')
    logger.info('• nx start-claude-session <library-name> --task="Your task"')
    logger.info('• nx session-manager <library-name> --command=status')
    logger.info('')
    logger.info('🌍 Global (workspace-level):')
    logger.info('• nx session-status           # View all active sessions')
    logger.info('• nx session-cleanup          # Clean up old sessions') 
    logger.info('• nx session-search --query="search terms"')
    logger.info('• nx orchestrate-feature <feature-name>')
    logger.info('')
    logger.info('➕ Add session support to new libraries:')
    logger.info('• nx g nx-claude-sessions:library-session <library-name>')
    logger.info('')
    logger.info('🧠 Intelligent Claude Code sessions:')
    logger.info('• Real-time decision capture during sessions')
    logger.info('• Automatic pattern recognition and storage') 
    logger.info('• Context-aware session initialization with accumulated knowledge')
    logger.info('')
    logger.info('🔍 Verify installation: nx list nx-claude-sessions')
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Installation failed: ${errorMessage}`)
    logger.info('')
    logger.info('🛠️ Recovery options:')
    logger.info('• Manual setup: npx nx-claude-sessions-manual-init')
    logger.info('• Report issue: https://github.com/Andrew-henk/nx-conductor/issues')
    throw error
  }
}

function normalizeOptions(options: InitGeneratorSchema): Required<InitGeneratorSchema> {
  return {
    maxConcurrency: options.maxConcurrency ?? 5,
    sessionTimeout: options.sessionTimeout ?? '30m',
    knowledgeRetention: options.knowledgeRetention ?? '30d',
    orchestrationStrategy: options.orchestrationStrategy ?? 'dependency-aware',
    autoTransitions: options.autoTransitions ?? true,
    skipFormat: options.skipFormat ?? false,
    skipMcp: options.skipMcp ?? false
  }
}

async function addPluginToNxConfig(tree: Tree, options: Required<InitGeneratorSchema>) {
  updateJson(tree, 'nx.json', (json) => {
    if (!json.plugins) {
      json.plugins = []
    }

    const existingPlugin = json.plugins.find((p: any) => 
      typeof p === 'object' && p.plugin === 'nx-claude-sessions'
    )

    if (!existingPlugin) {
      json.plugins.push({
        plugin: 'nx-claude-sessions',
        options: {
          maxConcurrency: options.maxConcurrency,
          sessionTimeout: options.sessionTimeout,
          knowledgeRetention: options.knowledgeRetention,
          orchestrationStrategy: options.orchestrationStrategy,
          autoTransitions: {
            enabled: options.autoTransitions,
            crossLibraryThreshold: 3,
            topicShiftConfidence: 0.7
          },
          sessionStorage: {
            path: '.nx-claude-sessions',
            compressionInterval: '7d',
            maxHistorySize: 100
          }
        }
      })
    }

    return json
  })
}

async function createSessionStorageDirectories(tree: Tree) {
  const directories = [
    '.nx-claude-sessions',
    '.nx-claude-sessions/history',
    '.nx-claude-sessions/active',
    '.nx-claude-sessions/archives',
    '.nx-claude-sessions/coordination'
  ]

  directories.forEach(dir => {
    if (!tree.exists(dir)) {
      tree.write(joinPathFragments(dir, '.gitkeep'), '')
    }
  })

  const gitignorePath = '.gitignore'
  if (tree.exists(gitignorePath)) {
    const gitignoreContent = tree.read(gitignorePath, 'utf-8') || ''
    if (!gitignoreContent.includes('.nx-claude-sessions/active')) {
      const updatedContent = gitignoreContent + '\n# NX Claude Sessions\n.nx-claude-sessions/active\n.nx-claude-sessions/coordination\n'
      tree.write(gitignorePath, updatedContent)
    }
  }
}

async function generateConfigurationFiles(tree: Tree, options: Required<InitGeneratorSchema>) {
  const templateOptions = {
    ...options,
    template: ''
  }

  generateFiles(tree, join(__dirname, 'files'), '.', templateOptions)
}

async function generateLibraryClaudeTemplates(tree: Tree) {
  const existingLibraries = getExistingLibraries(tree)
  
  for (const lib of existingLibraries) {
    const claudeFilePath = joinPathFragments(lib.root, 'claude.md')
    
    if (!tree.exists(claudeFilePath)) {
      const templateContent = generateLibraryClaudeTemplate(lib.name, lib)
      tree.write(claudeFilePath, templateContent)
      logger.info(`Created claude.md for ${lib.name}`)
    }
  }
}

function getExistingLibraries(tree: Tree): Array<{ name: string; root: string; type?: string }> {
  const libraries: Array<{ name: string; root: string; type?: string }> = []
  
  try {
    if (!tree.exists('workspace.json') && !tree.exists('angular.json') && !tree.exists('project.json')) {
      const libsDir = 'libs'
      if (tree.exists(libsDir)) {
        tree.children(libsDir).forEach(libName => {
          const libPath = joinPathFragments(libsDir, libName)
          if (tree.isFile(libPath)) return
          
          const projectJsonPath = joinPathFragments(libPath, 'project.json')
          if (tree.exists(projectJsonPath)) {
            libraries.push({
              name: libName,
              root: libPath,
              type: 'library'
            })
          }
        })
      }
    }
  } catch (error) {
    logger.warn(`Could not detect existing libraries: ${error}`)
  }
  
  return libraries
}

function generateLibraryClaudeTemplate(libraryName: string, config: { name: string; root: string; type?: string }): string {
  return `# ${libraryName} Library Context

## Purpose
[Describe the purpose and responsibilities of this library]

## Architecture
[Describe key architectural patterns and design decisions]

## Dependencies
- Internal: [List internal NX library dependencies]
- External: [List external dependencies from package.json]

## Established Patterns
- [Document coding conventions specific to this library]
- [Architectural patterns used]
- [Error handling approaches]
- [State management patterns if applicable]

## Integration Points
- [How this library integrates with other parts of the system]
- [Public APIs and interfaces]
- [Event emissions or subscriptions]

## Known Issues & Solutions
- [Document common issues and their solutions]
- [Performance considerations]
- [Browser compatibility notes if applicable]

## Testing Strategy
- [Unit testing approach]
- [Integration testing requirements]
- [Mock strategies for dependencies]

## Development Notes
- [Local development setup specifics]
- [Build considerations]
- [Deployment notes if applicable]

---
*This file provides context for Claude Code sessions. Keep it updated as the library evolves.*
`.trim()
}

async function performCompatibilityChecks(tree: Tree): Promise<void> {
  // Check NX version compatibility
  const packageJsonPath = join(workspaceRoot, 'package.json')
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const nxVersion = packageJson.devDependencies?.nx || packageJson.dependencies?.nx
    
    if (nxVersion) {
      const majorVersion = parseInt(nxVersion.replace(/[^\d]/g, ''))
      if (majorVersion < 21) {
        throw new Error(`NX version ${nxVersion} not supported. Requires NX 21+`)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.warn(`Could not verify NX version: ${errorMessage}`)
  }

  // Check lockfile compatibility
  const lockfilePath = join(workspaceRoot, 'package-lock.json')
  try {
    if (tree.exists('package-lock.json')) {
      const lockfileContent = tree.read('package-lock.json', 'utf-8')
      if (lockfileContent) {
        const lockfile = JSON.parse(lockfileContent)
        
        if (lockfile.lockfileVersion === 3) {
          logger.warn('⚠️ LockfileVersion 3 detected - this may cause parsing issues')
          logger.info('Consider downgrading to lockfileVersion 2 if you encounter problems')
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Lockfile validation failed: ${errorMessage}`)
  }

  // Check Node.js version
  const nodeVersion = process.version
  const majorNodeVersion = parseInt(nodeVersion.slice(1).split('.')[0])
  if (majorNodeVersion < 18) {
    throw new Error(`Node.js version ${nodeVersion} not supported. Requires Node 18+`)
  }

  logger.info('✅ Compatibility checks passed')
}

async function setupIntelligentSessions(tree: Tree, options: Required<InitGeneratorSchema>): Promise<void> {
  logger.info('🧠 Setting up hierarchical intelligent session features...')
  
  // Create workspace-level .claude directory (root)
  const workspaceClaudeDir = '.claude'
  const workspaceDirectories = [
    '',
    'decisions', 
    'patterns',
    'sessions'
  ]
  
  workspaceDirectories.forEach(subDir => {
    const dirPath = subDir ? joinPathFragments(workspaceClaudeDir, subDir) : workspaceClaudeDir
    if (!tree.exists(dirPath)) {
      tree.write(joinPathFragments(dirPath, '.gitkeep'), '')
    }
  })
  
  // Initialize workspace knowledge files
  const workspaceKnowledgeFiles = [
    { path: 'decisions.json', content: '[]' },
    { path: 'patterns.json', content: '[]' },
    { path: 'session-history.json', content: '{ "sessions": [], "totalSessions": 0 }' }
  ]
  
  workspaceKnowledgeFiles.forEach(file => {
    const filePath = joinPathFragments(workspaceClaudeDir, file.path)
    if (!tree.exists(filePath)) {
      tree.write(filePath, file.content)
    }
  })
  
  logger.info(`🏢 Created workspace-level knowledge management`)
  
  // Enhanced .claude directories for each library
  const existingLibraries = getExistingLibraries(tree)
  
  for (const lib of existingLibraries) {
    const claudeDir = joinPathFragments(lib.root, '.claude')
    
    // Create enhanced directory structure
    const directories = [
      '',
      'decisions',
      'patterns',
      'sessions'
    ]
    
    directories.forEach(subDir => {
      const dirPath = subDir ? joinPathFragments(claudeDir, subDir) : claudeDir
      if (!tree.exists(dirPath)) {
        tree.write(joinPathFragments(dirPath, '.gitkeep'), '')
      }
    })
    
    // Initialize empty knowledge files
    const knowledgeFiles = [
      { path: 'decisions.json', content: '[]' },
      { path: 'patterns.json', content: '[]' },
      { path: 'session-history.json', content: '{ "sessions": [], "totalSessions": 0 }' }
    ]
    
    knowledgeFiles.forEach(file => {
      const filePath = joinPathFragments(claudeDir, file.path)
      if (!tree.exists(filePath)) {
        tree.write(filePath, file.content)
      }
    })
    
    logger.info(`📚 Enhanced ${lib.name} with library-level knowledge management`)
  }
  
  logger.info('✅ Hierarchical intelligent session features configured!')
  logger.info('')
  logger.info('🎯 What\'s enabled:')
  logger.info('• Workspace-level knowledge management (.claude/ at root)')
  logger.info('• Library-level knowledge management (.claude/ per library)')
  logger.info('• Knowledge inheritance from workspace to libraries')
  logger.info('• Scoped decision and pattern capture (workspace vs library)')
  logger.info('• Real-time hierarchical knowledge capture during sessions')
  logger.info('')
}

async function addExecutorsToProjects(tree: Tree, options: Required<InitGeneratorSchema>): Promise<void> {
  const projects = getProjects(tree)
  
  projects.forEach((projectConfig, projectName) => {
    if (projectConfig.projectType === 'library') {
      // Add claude session targets to library projects
      if (!projectConfig.targets) {
        projectConfig.targets = {}
      }

      // Add start-claude-session target
      projectConfig.targets['start-claude-session'] = {
        executor: 'nx-claude-sessions:start-session',
        options: {
          library: projectName,
          sessionTimeout: options.sessionTimeout,
          maxConcurrency: 1
        }
      }

      // Add session-manager target
      projectConfig.targets['session-manager'] = {
        executor: 'nx-claude-sessions:session-manager',
        options: {
          library: projectName
        }
      }

      updateProjectConfiguration(tree, projectName, projectConfig)
      logger.info(`Added Claude session targets to ${projectName}`)
    }
  })

  // Add workspace-level orchestration targets
  updateJson(tree, 'nx.json', (json) => {
    if (!json.targetDefaults) {
      json.targetDefaults = {}
    }

    // Add orchestrate target default
    json.targetDefaults['orchestrate-feature'] = {
      executor: 'nx-claude-sessions:orchestrate',
      options: {
        maxSessions: options.maxConcurrency,
        strategy: options.orchestrationStrategy
      }
    }

    // Add global session management targets
    json.targetDefaults['session-status'] = {
      executor: 'nx-claude-sessions:global-session-manager',
      options: {
        command: 'status'
      }
    }

    json.targetDefaults['session-cleanup'] = {
      executor: 'nx-claude-sessions:global-session-manager',
      options: {
        command: 'cleanup'
      }
    }

    json.targetDefaults['session-search'] = {
      executor: 'nx-claude-sessions:global-session-manager',
      options: {
        command: 'search'
      }
    }

    return json
  })

  logger.info('✅ Added executors to project configurations')
}

export default initGenerator