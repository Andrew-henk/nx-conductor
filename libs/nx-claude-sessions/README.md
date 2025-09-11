# @nx/claude-sessions

**The first NX-native distributed AI development orchestration system** that enables library-scoped, concurrency-managed Claude Code sessions with intelligent knowledge persistence and cross-session coordination.

## 🚀 Features

- **📚 Library-Scoped Sessions**: Each NX library gets focused Claude sessions with full context
- **🔄 Session Orchestration**: Coordinate multiple sessions across libraries with dependency awareness
- **🧠 Knowledge Persistence**: Accumulated wisdom survives across sessions and developers
- **⚡ Concurrency Management**: Smart session pooling with priority-based queuing (default 5 sessions)
- **🎯 Context Loading**: Automatic loading of library `claude.md` files, dependencies, and patterns
- **🔗 Cross-Library Coordination**: Intelligent handoffs and shared resource awareness

## 📦 Installation

```bash
npm install @nx/claude-sessions
```

## 🛠️ Quick Start

### 1. Initialize the Plugin

```bash
npx nx g @nx/claude-sessions:init
```

This will:
- Add plugin configuration to `nx.json`
- Create session storage directories
- Generate template `claude.md` files for existing libraries

### 2. Start a Library Session

```bash
npx nx start-claude-session auth --task="Implement 2FA authentication"
```

### 3. Explore Advanced Features

See the comprehensive [Usage](#-usage) section below for all available commands and options.

## 📖 Usage

### Basic Commands

#### Initialize Workspace
```bash
# Basic initialization
nx g @nx/claude-sessions:init

# Custom configuration
nx g @nx/claude-sessions:init \
  --maxConcurrency=3 \
  --sessionTimeout=45m \
  --orchestrationStrategy=parallel
```

#### Start Library Session
```bash
# Standard session
nx start-claude-session auth \
  --task="Implement user authentication" \
  --taskType=feature \
  --complexity=medium

# Quick bug fix session
nx start-claude-session ui \
  --task="Fix button alignment" \
  --taskType=bug-fix \
  --priority=80
```

#### Session Management
```bash
# View active sessions
nx session-manager --command=status

# Search session history
nx session-manager --command=search --query="authentication"

# Clean up old sessions
nx session-manager --command=cleanup --maxAge=7d

# Terminate specific session
nx session-manager --command=terminate --sessionId=auth-123

# List all sessions
nx session-manager --command=list --detailed=true
```

#### Feature Orchestration
```bash
# Basic orchestration
nx orchestrate "user profile feature" \
  --libraries=auth,ui,api

# Advanced orchestration
nx orchestrate "notification system" \
  --libraries=auth,ui,api,notifications \
  --strategy=dependency-aware \
  --maxSessions=4 \
  --includeTests=true

# Dry run (plan only)
nx orchestrate "complex feature" \
  --libraries=auth,ui,api \
  --dryRun=true
```

### Advanced Commands

#### Custom Session Options

```bash
# Raw mode with minimal context
nx start-claude-session api \
  --task="Direct API development" \
  --rawMode=true \
  --passthroughArgs="--verbose,--debug"

# Custom Claude Code binary
nx start-claude-session core \
  --task="Core development" \
  --customClaudePath="/opt/claude-enterprise/claude-code" \
  --passthroughArgs="--experimental"

# Context refresh
nx start-claude-session auth \
  --task="Update with latest patterns" \
  --contextRefresh=true
```

#### Direct Passthrough
```bash
# Get Claude Code help
nx passthrough --args="--help"

# Interactive session with library context
nx passthrough \
  --library=auth \
  --args="--interactive,--workspace=/path/to/workspace" \
  --interactive=true

# Batch processing
nx passthrough \
  --args="--batch,--input=./tasks.json" \
  --workingDirectory="./libs/api" \
  --timeout=30m \
  --interactive=false

# Custom working directory
nx passthrough \
  --args="--analyze,./src" \
  --workingDirectory="./libs/ui" \
  --includeContext=false
```

#### Orchestration with Advanced Options
```bash
# Enterprise orchestration
nx orchestrate "microservices architecture" \
  --libraries=auth,api,gateway,notifications \
  --strategy=dependency-aware \
  --maxSessions=5 \
  --passthroughArgs="--enterprise,--compliance" \
  --coordinationMode=manual

# Testing-focused orchestration
nx orchestrate "comprehensive testing" \
  --libraries=auth,api,ui \
  --includeTests=true \
  --strategy=parallel \
  --rawMode=true
```

### Emergency Commands

#### ⚠️ Dangerous Mode (Use with Extreme Caution)
```bash
# Production hotfix
nx start-claude-session critical-service \
  --task="Fix memory leak in production" \
  --dangerouslySkipPermissions=true \
  --customClaudePath="/emergency/claude-build" \
  --priority=100

# Emergency orchestration
nx orchestrate "critical security fix" \
  --libraries=auth,api,security \
  --dangerouslySkipPermissions=true \
  --maxSessions=3 \
  --strategy=sequential

# Direct emergency command
nx passthrough \
  --args="--emergency-mode,--bypass-checks" \
  --dangerouslySkipPermissions=true \
  --timeout=60m \
  --interactive=false
```

### Common Workflows

#### Development Workflow
```bash
# 1. Start focused development session
nx start-claude-session user-management \
  --task="Implement user roles" \
  --taskType=feature

# 2. Check session status
nx session-manager --command=status

# 3. Search for related patterns
nx session-manager --command=search --query="user roles"
```

#### Cross-Library Feature Workflow
```bash
# 1. Analyze feature scope
nx orchestrate "payment integration" \
  --dryRun=true

# 2. Execute orchestrated development
nx orchestrate "payment integration" \
  --libraries=auth,api,payments,ui \
  --strategy=dependency-aware \
  --maxSessions=3

# 3. Monitor progress
nx session-manager --command=status

# 4. Clean up when done
nx session-manager --command=cleanup
```

#### Debugging Workflow
```bash
# 1. Start debug session with verbose output
nx start-claude-session problematic-lib \
  --task="Debug performance issue" \
  --passthroughArgs="--verbose,--profile,--debug" \
  --rawMode=true

# 2. Use passthrough for direct investigation
nx passthrough \
  --library=problematic-lib \
  --args="--analyze-performance,--output=report.json" \
  --workingDirectory="./libs/problematic-lib"
```

#### Enterprise Integration Workflow
```bash
# 1. Custom binary with enterprise features
nx start-claude-session enterprise-module \
  --task="Integrate with enterprise systems" \
  --customClaudePath="/opt/claude-enterprise/bin/claude-code" \
  --passthroughArgs="--enterprise,--compliance,--audit"

# 2. Orchestrate across enterprise modules
nx orchestrate "enterprise integration" \
  --libraries=auth,audit,compliance,reporting \
  --customClaudePath="/opt/claude-enterprise/bin/claude-code" \
  --coordinationMode=manual \
  --maxSessions=2
```


## 🏗️ Architecture

### Session Types

1. **Library Sessions**: Focused development within a single library
2. **Feature Orchestration**: Coordinated development across multiple libraries  
3. **Master Coordination**: High-level planning and dependency management

### Context Loading Strategy

Each session automatically loads:

```typescript
interface LibraryContext {
  primary: ClaudeFileContent        // libs/{library}/claude.md
  dependencies: string[]            // NX dependency graph
  shared: SharedResourcesContext    // Shared types, utilities, configs
  history: CompressedSessionHistory // Previous session learnings
  patterns: LibraryPatterns        // Code conventions & approaches
}
```

### Session Pool Management

- **Concurrency Limit**: Default 5 concurrent sessions (configurable)
- **Priority Queuing**: Dependency-aware task prioritization
- **Automatic Transitions**: Smart handoffs between libraries
- **Resource Management**: Session lifecycle and cleanup

## 📋 Commands

### Generators

#### `nx g @nx/claude-sessions:init`
Initialize workspace for Claude Sessions

**Options:**
- `--maxConcurrency=5`: Maximum concurrent sessions
- `--sessionTimeout=30m`: Session timeout duration
- `--orchestrationStrategy=dependency-aware`: Coordination strategy

### Executors

#### `nx start-claude-session <library>`
Start a focused session for a specific library

**Basic Options:**
- `--task`: Task description (required)
- `--taskType`: `feature|bug-fix|refactor|test|documentation`
- `--priority`: Task priority (1-100, default 50)
- `--complexity`: `low|medium|high` (default medium)
- `--scope`: Additional libraries that might be affected

**Advanced Options:**
- `--passthroughArgs`: Array of arguments to pass to Claude Code
- `--customClaudePath`: Custom Claude Code binary path
- `--rawMode`: Skip NX context processing
- `--dangerouslySkipPermissions`: ⚠️ Skip all safety checks
- `--contextRefresh`: Force reload of library context

**Examples:**
```bash
# Standard session
nx start-claude-session shared-auth \
  --task="Add OAuth provider support" \
  --taskType=feature \
  --complexity=high \
  --scope=web-app,mobile-app

# Advanced session with custom options
nx start-claude-session api \
  --task="Debug performance issue" \
  --passthroughArgs="--verbose,--profile" \
  --customClaudePath="/opt/claude-code" \
  --rawMode=true

# Emergency session (⚠️ use with caution)
nx start-claude-session critical-lib \
  --task="Hotfix production issue" \
  --dangerouslySkipPermissions=true
```

#### `nx passthrough`
Direct passthrough to Claude Code with optional NX context

**Options:**
- `--args`: Array of arguments to pass to Claude Code
- `--library`: Optional library context to load
- `--includeContext`: Include NX workspace context (default true)
- `--customClaudePath`: Custom Claude Code binary path
- `--workingDirectory`: Working directory for execution
- `--timeout`: Execution timeout (default 10m)
- `--interactive`: Run in interactive mode (default true)
- `--dangerouslySkipPermissions`: ⚠️ Skip all safety checks

**Examples:**
```bash
# Get Claude Code help
nx passthrough --args="--help"

# Run with library context
nx passthrough \
  --library=auth \
  --args="--check-dependencies" \
  --includeContext=true

# Custom working directory
nx passthrough \
  --args="--analyze,./src" \
  --workingDirectory="./libs/ui"

# Emergency command (⚠️ dangerous)
nx passthrough \
  --args="--force-rebuild" \
  --dangerouslySkipPermissions=true \
  --timeout=30m
```

## 📁 Library Configuration

Create a `claude.md` file in each library to provide context:

```markdown
# auth Library Context

## Purpose
Handles authentication and authorization for the application

## Architecture  
- JWT tokens with refresh mechanism
- Role-based permission system
- OAuth provider integration

## Dependencies
- `@shared/types` for AuthUser interface
- `@shared/database` for user persistence
- `redis` for session storage

## Established Patterns
- Always use `AppError` for auth failures
- JWT stored in httpOnly cookies
- Refresh tokens in Redis with TTL

## Integration Points
- Provides AuthContext for React components  
- Emits auth events for audit logging
- Validates permissions for protected resources

## Known Issues & Solutions
- Next.js 15 cookies issue: Use `await cookies()` pattern
- Token refresh race condition: Implement request deduplication

## Testing Strategy
- Unit tests with JWT mocking
- Integration tests with real Redis
- E2E tests for full auth flows
```

## 🔧 Configuration

### Workspace Configuration (nx.json)

```json
{
  "plugins": [
    {
      "plugin": "@nx/claude-sessions",
      "options": {
        "maxConcurrency": 5,
        "sessionTimeout": "30m",
        "orchestrationStrategy": "dependency-aware",
        "autoTransitions": {
          "enabled": true,
          "crossLibraryThreshold": 3,
          "topicShiftConfidence": 0.7
        }
      }
    }
  ]
}
```

### Session Storage Structure

```
.nx-claude-sessions/
├── history/          # Compressed session history per library
├── active/           # Current session state (gitignored)
├── archives/         # Long-term session archives  
└── coordination/     # Cross-session communication (gitignored)
```

## 🧠 Knowledge Management

### Session History Compression

Sessions automatically compress to retain key insights:

- **Patterns**: Code conventions and architectural decisions
- **Solutions**: Reusable problem-solving approaches  
- **Pitfalls**: Known issues and their solutions
- **Decisions**: Architectural choices with rationale
- **Cross-Library Learnings**: Integration insights

### Context Inheritance

New sessions inherit:
1. Library-specific `claude.md` documentation
2. Dependency context from related libraries
3. Compressed wisdom from previous sessions
4. Established patterns and conventions

## 🚀 Advanced Usage

### Feature Orchestration

For complex features spanning multiple libraries:

```bash
# Analyze feature scope and create orchestration plan
nx orchestrate-feature user-onboarding \
  --libraries=auth,user-profile,notifications \
  --strategy=dependency-aware \
  --max-sessions=4
```

### Session Management

```bash
# View active sessions
nx session-status

# Search session history  
nx session-search "authentication patterns"

# Archive completed sessions
nx session-cleanup
```

### Custom Task Descriptors

```typescript
interface TaskDescriptor {
  type: 'feature' | 'bug-fix' | 'refactor' | 'test' | 'documentation'
  description: string
  scope: string[]                    // Affected libraries
  priority: number                   // 1-100
  estimatedComplexity: 'low' | 'medium' | 'high'
  crossLibraryDependencies?: string[] // Coordination required
}
```

## 🔄 Integration with Existing Tools

### Claude Flow Memory System

Leverages `claude-flow` for advanced memory management:
- Persistent knowledge graphs
- Cross-session pattern recognition  
- Automatic context compression

### ccmanager Session Lifecycle

Uses `ccmanager` for robust session management:
- Session isolation and cleanup
- Process lifecycle management
- Error recovery and retry logic

### NX MCP Server Extension

Extends the existing NX MCP server with:
- Session-aware project graph navigation
- Library context loading
- Dependency-aware orchestration

## 📊 Performance & Limits

- **Session Pool**: 5 concurrent sessions (configurable 1-10)
- **Context Size**: ~50% compression of original session content  
- **History Retention**: 30 days default (configurable)
- **Startup Time**: <10 seconds with full context loading
- **Memory Usage**: ~100MB per active session

## ⚠️ Safety Considerations

### Dangerous Mode (`--dangerouslySkipPermissions`)

The `--dangerouslySkipPermissions` flag is provided for emergency situations and advanced users. **Use with extreme caution!**

**What it bypasses:**
- Claude Code binary validation
- Library context validation  
- Permission checks
- Safety validations
- Workspace integrity checks

**When to use:**
- ✅ Emergency production fixes
- ✅ Advanced development with custom Claude Code builds
- ✅ Testing and development environments
- ✅ When you know exactly what you're doing

**When NOT to use:**
- ❌ Regular development workflows
- ❌ Production environments without expert oversight
- ❌ When unsure about the consequences
- ❌ Shared development environments

**Example safe usage:**
```bash
# Emergency hotfix with full awareness of risks
nx start-claude-session critical-service \
  --task="Fix memory leak in production" \
  --dangerouslySkipPermissions=true \
  --customClaudePath="/emergency/claude-build" \
  # Only after: backup, team notification, rollback plan ready
```

### Raw Mode (`--rawMode`)

Raw mode provides minimal NX context processing for advanced use cases:

- Skips automatic workspace context loading
- Reduces session overhead
- Allows direct Claude Code argument passing
- Suitable for custom integrations

## 🤝 Contributing

This is an experimental plugin pushing the boundaries of AI-assisted development. Contributions welcome!

### Development Setup

```bash
git clone <repo>
cd nx-conductor
npm install
nx test nx-claude-sessions
```

### Testing

```bash
# Run TypeScript checks
npx tsc --project libs/nx-claude-sessions/tsconfig.lib.json --noEmit

# Run validation tests
node test-plugin.js

# Test with real NX workspace
nx g @nx/claude-sessions:init
nx start-claude-session <library> --task="test task"
```

## 📄 License

MIT - See LICENSE file for details

---

**🧠 Revolutionizing monorepo development with AI orchestration**

Built for the future of collaborative AI development in complex codebases.