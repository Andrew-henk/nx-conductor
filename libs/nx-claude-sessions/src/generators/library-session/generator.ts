import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
  updateProjectConfiguration,
  getProjects,
  logger
} from '@nx/devkit'
import { LibrarySessionGeneratorSchema } from './schema'
import { join } from 'path'

export async function librarySessionGenerator(tree: Tree, options: LibrarySessionGeneratorSchema) {
  logger.info(`Setting up Claude sessions for library: ${options.name}`)
  
  const projects = getProjects(tree)
  const project = projects.get(options.name)
  
  if (!project) {
    throw new Error(`Project "${options.name}" not found`)
  }
  
  if (project.projectType !== 'library') {
    logger.warn(`Project "${options.name}" is not a library. Session targets work best with libraries.`)
  }

  // Add session targets to the project
  if (!project.targets) {
    project.targets = {}
  }

  // Add start-claude-session target
  project.targets['start-claude-session'] = {
    executor: 'nx-claude-sessions:start-session',
    options: {
      library: options.name,
      sessionTimeout: options.sessionTimeout || '30m',
      maxConcurrency: 1
    }
  }

  // Add session-manager target
  project.targets['session-manager'] = {
    executor: 'nx-claude-sessions:session-manager',
    options: {
      library: options.name
    }
  }

  updateProjectConfiguration(tree, options.name, project)

  // Create library-specific .claude directory structure
  const libraryRoot = project.root
  const claudeDir = joinPathFragments(libraryRoot, '.claude')

  const directories = ['sessions', 'knowledge', 'context']
  directories.forEach(dir => {
    const dirPath = joinPathFragments(claudeDir, dir)
    if (!tree.exists(dirPath)) {
      tree.write(joinPathFragments(dirPath, '.gitkeep'), '')
    }
  })

  // Create library claude.md if it doesn't exist
  const claudeMdPath = joinPathFragments(libraryRoot, 'claude.md')
  if (!tree.exists(claudeMdPath)) {
    const templateContent = generateLibraryClaudeTemplate(options.name, project)
    tree.write(claudeMdPath, templateContent)
    logger.info(`Created claude.md for ${options.name}`)
  }

  // Create intelligence config
  const configPath = joinPathFragments(claudeDir, 'config.yaml')
  if (!tree.exists(configPath)) {
    const configContent = generateLibraryConfig(options.name)
    tree.write(configPath, configContent)
    logger.info(`Created intelligence config for ${options.name}`)
  }

  if (!options.skipFormat) {
    await formatFiles(tree)
  }

  logger.info(`✅ Successfully set up Claude sessions for ${options.name}`)
  logger.info('')
  logger.info('Available commands:')
  logger.info(`• nx start-claude-session ${options.name} --task="Your task description"`)
  logger.info(`• nx session-manager ${options.name} --command=status`)
}

function generateLibraryClaudeTemplate(libraryName: string, project: any): string {
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

function generateLibraryConfig(libraryName: string): string {
  return `name: "${libraryName}"
type: "library"
intelligence:
  enabled: true
  session_limit: 3
  knowledge_retention: true
  context_inheritance: true
  
orchestration:
  master_session: false
  worker_sessions: true
  concurrency_limit: 1
  
nx_integration:
  project_name: "${libraryName}" 
  dependency_aware: true
  shared_resources: true
  
knowledge:
  patterns_file: "knowledge/patterns.md"
  decisions_file: "knowledge/decisions.md"
  context_file: "context/library-context.md"`
}

export default librarySessionGenerator