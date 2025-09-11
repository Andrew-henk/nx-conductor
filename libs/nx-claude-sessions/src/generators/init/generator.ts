import {
  Tree,
  formatFiles,
  updateJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  logger,
  workspaceRoot
} from '@nx/devkit'
import { InitGeneratorSchema } from './schema'
import { join } from 'path'

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  logger.info('Initializing NX Claude Sessions plugin...')
  
  const normalizedOptions = normalizeOptions(options)
  
  await addPluginToNxConfig(tree, normalizedOptions)
  await createSessionStorageDirectories(tree)
  await generateConfigurationFiles(tree, normalizedOptions)
  await generateLibraryClaudeTemplates(tree)
  
  if (!options.skipFormat) {
    await formatFiles(tree)
  }
  
  logger.info('✅ NX Claude Sessions plugin initialized successfully!')
  logger.info('')
  logger.info('Next steps:')
  logger.info('1. Create library-specific claude.md files in your libs')
  logger.info('2. Run: nx start-claude-session <library-name>')
  logger.info('3. Run: nx orchestrate-feature <feature-name>')
  logger.info('')
}

function normalizeOptions(options: InitGeneratorSchema): Required<InitGeneratorSchema> {
  return {
    maxConcurrency: options.maxConcurrency ?? 5,
    sessionTimeout: options.sessionTimeout ?? '30m',
    knowledgeRetention: options.knowledgeRetention ?? '30d',
    orchestrationStrategy: options.orchestrationStrategy ?? 'dependency-aware',
    autoTransitions: options.autoTransitions ?? true,
    skipFormat: options.skipFormat ?? false
  }
}

async function addPluginToNxConfig(tree: Tree, options: Required<InitGeneratorSchema>) {
  updateJson(tree, 'nx.json', (json) => {
    if (!json.plugins) {
      json.plugins = []
    }

    const existingPlugin = json.plugins.find((p: any) => 
      typeof p === 'object' && p.plugin === '@nx/claude-sessions'
    )

    if (!existingPlugin) {
      json.plugins.push({
        plugin: '@nx/claude-sessions',
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

export default initGenerator