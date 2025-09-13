#!/usr/bin/env node

/**
 * Manual Setup Script for nx-claude-sessions
 * 
 * This script provides a fallback installation method when the NX generator fails
 * due to lockfile parsing issues or other compatibility problems.
 */

const fs = require('fs');
const path = require('path');

// Console colors for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${colors.cyan}=== ${title} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function createDirectoryIfNotExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logSuccess(`Created directory: ${dirPath}`);
  } else {
    log(`Directory already exists: ${dirPath}`);
  }
}

function writeFileIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    logSuccess(`Created file: ${filePath}`);
  } else {
    log(`File already exists: ${filePath}`);
  }
}

function setupWorkspaceDirectories() {
  logSection('Setting Up Workspace Directories');
  
  const directories = [
    '.nx-claude-sessions',
    '.nx-claude-sessions/history',
    '.nx-claude-sessions/active', 
    '.nx-claude-sessions/archives',
    '.nx-claude-sessions/coordination'
  ];

  directories.forEach(dir => {
    createDirectoryIfNotExists(dir);
    // Add .gitkeep to empty directories
    writeFileIfNotExists(path.join(dir, '.gitkeep'), '');
  });

  // Update .gitignore
  const gitignorePath = '.gitignore';
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const sessionIgnores = `
# NX Claude Sessions
.nx-claude-sessions/active
.nx-claude-sessions/coordination
`;

    if (!gitignoreContent.includes('.nx-claude-sessions/active')) {
      fs.appendFileSync(gitignorePath, sessionIgnores);
      logSuccess('Updated .gitignore with session directories');
    } else {
      log('.gitignore already contains session ignore rules');
    }
  }
}

function setupLibraryDirectories() {
  logSection('Setting Up Library Intelligence Directories');

  const libsDir = 'libs';
  if (!fs.existsSync(libsDir)) {
    logWarning('No libs directory found. Skipping library setup.');
    return;
  }

  const libraries = fs.readdirSync(libsDir).filter(item => {
    const libPath = path.join(libsDir, item);
    return fs.statSync(libPath).isDirectory();
  });

  libraries.forEach(libName => {
    const libPath = path.join(libsDir, libName);
    const claudeDir = path.join(libPath, '.claude');

    // Create .claude subdirectories
    ['sessions', 'knowledge', 'context'].forEach(subDir => {
      createDirectoryIfNotExists(path.join(claudeDir, subDir));
    });

    // Create library claude.md if it doesn't exist
    const claudeMdPath = path.join(libPath, 'claude.md');
    const claudeMdContent = generateLibraryClaudeTemplate(libName);
    writeFileIfNotExists(claudeMdPath, claudeMdContent);
    
    // Create intelligence config
    const configPath = path.join(claudeDir, 'config.yaml');
    const configContent = generateLibraryConfig(libName);
    writeFileIfNotExists(configPath, configContent);

    logSuccess(`Set up intelligence system for ${libName}`);
  });
}

function updateNxConfig() {
  logSection('Updating NX Configuration');

  const nxJsonPath = 'nx.json';
  if (!fs.existsSync(nxJsonPath)) {
    logError('nx.json not found. Are you in an NX workspace?');
    return;
  }

  const nxConfig = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));

  // Add plugins array if it doesn't exist
  if (!nxConfig.plugins) {
    nxConfig.plugins = [];
  }

  // Check if plugin is already registered
  const pluginExists = nxConfig.plugins.some(plugin => {
    if (typeof plugin === 'string') {
      return plugin === 'nx-claude-sessions';
    }
    return plugin.plugin === 'nx-claude-sessions';
  });

  if (!pluginExists) {
    nxConfig.plugins.push({
      plugin: 'nx-claude-sessions',
      options: {
        maxConcurrency: 5,
        sessionTimeout: '30m',
        knowledgeRetention: '30d',
        orchestrationStrategy: 'dependency-aware',
        autoTransitions: {
          enabled: true,
          crossLibraryThreshold: 3,
          topicShiftConfidence: 0.7
        },
        sessionStorage: {
          path: '.nx-claude-sessions',
          compressionInterval: '7d',
          maxHistorySize: 100
        }
      }
    });

    fs.writeFileSync(nxJsonPath, JSON.stringify(nxConfig, null, 2));
    logSuccess('Added nx-claude-sessions plugin to nx.json');
  } else {
    log('Plugin already registered in nx.json');
  }
}

function generateLibraryClaudeTemplate(libraryName) {
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
`;
}

function generateLibraryConfig(libraryName) {
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
  context_file: "context/library-context.md"
`;
}

function performCompatibilityChecks() {
  logSection('Performing Compatibility Checks');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorNodeVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorNodeVersion >= 18) {
    logSuccess(`Node.js ${nodeVersion} is compatible`);
  } else {
    logError(`Node.js ${nodeVersion} is not supported. Requires Node 18+`);
    process.exit(1);
  }

  // Check if we're in an NX workspace
  if (!fs.existsSync('nx.json') && !fs.existsSync('angular.json')) {
    logError('Not an NX workspace. Please run this script in an NX workspace root.');
    process.exit(1);
  }
  logSuccess('NX workspace detected');

  // Check package.json for nx-claude-sessions
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const hasPlugin = packageJson.dependencies?.['nx-claude-sessions'] || 
                     packageJson.devDependencies?.['nx-claude-sessions'];
    
    if (hasPlugin) {
      logSuccess('nx-claude-sessions package is installed');
    } else {
      logWarning('nx-claude-sessions package not found in package.json');
      log('Install with: npm install -D nx-claude-sessions');
    }
  }
}

function main() {
  log(`${colors.blue}
╔════════════════════════════════════════════╗
║     NX Claude Sessions Manual Setup        ║
║     Fallback Installation Script           ║
╚════════════════════════════════════════════╝
${colors.reset}`);

  performCompatibilityChecks();
  setupWorkspaceDirectories();
  setupLibraryDirectories();
  updateNxConfig();

  logSection('Installation Complete');
  logSuccess('nx-claude-sessions has been manually configured!');
  log('');
  log(`${colors.cyan}Next steps:${colors.reset}`);
  log('1. Verify installation: npx nx list | grep claude');
  log('2. Test a command: npx nx session-manager --command=status');
  log('3. Start your first session: npx nx start-claude-session <library-name>');
  log('');
  log(`${colors.yellow}If you encounter issues:${colors.reset}`);
  log('• Check the troubleshooting guide: https://github.com/Andrew-henk/nx-conductor#troubleshooting');
  log('• Report bugs: https://github.com/Andrew-henk/nx-conductor/issues');
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = {
  setupWorkspaceDirectories,
  setupLibraryDirectories,
  updateNxConfig,
  performCompatibilityChecks
};