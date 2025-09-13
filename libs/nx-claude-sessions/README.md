# @nx/claude-sessions

**The first NX-native distributed AI development orchestration system** that enables library-scoped, concurrency-managed Claude Code sessions with intelligent knowledge persistence and cross-session coordination.

## 🚀 Features

- **📚 Library-Scoped Sessions**: Each NX library gets focused Claude sessions with full context
- **🔄 Session Orchestration**: Coordinate multiple sessions across libraries with dependency awareness
- **🧠 Knowledge Persistence**: Accumulated wisdom survives across sessions and developers
- **⚡ Concurrency Management**: Smart session pooling with priority-based queuing (default 5 sessions)
- **🎯 Context Loading**: Automatic loading of library `claude.md` files, dependencies, and patterns
- **🔗 Cross-Library Coordination**: Intelligent handoffs and shared resource awareness
- **🏗️ Hierarchical Knowledge**: Nested knowledge management (workspace + library levels)
- **📝 Decision Tracking**: Scoped architectural decisions with workspace/library inheritance
- **🎨 Pattern Recognition**: Identify and store reusable code patterns across sessions
- **🤖 MCP Integration**: Enhanced intelligence when used with MCP server for cross-session memory

## 📦 Installation

```bash
# Install the plugin
npm install -D nx-claude-sessions

# Or with yarn
yarn add -D nx-claude-sessions

# Or with pnpm  
pnpm add -D nx-claude-sessions
```

**Prerequisites:**
- NX workspace (v21.0.0 or higher)
- Node.js 18+ 
- Claude Code CLI installed and accessible in PATH

### 🛠️ Troubleshooting Installation

#### Common Issues & Solutions

**❌ "Failed to parse npm lockfile" Error**
```bash
# Solution 1: Reset NX cache and regenerate lockfile
npx nx reset
rm package-lock.json
npm install

# Solution 2: Use manual initialization
npx nx-claude-sessions-manual-init

# Solution 3: Downgrade lockfileVersion (if needed)
# Edit package-lock.json: change "lockfileVersion": 3 to "lockfileVersion": 2
```

**❌ "Unable to resolve nx-claude-sessions:init" Error**
```bash
# Verify installation
npm ls nx-claude-sessions
npx nx list | grep claude

# Reinstall if missing
npm uninstall nx-claude-sessions
npm install -D nx-claude-sessions
```

**❌ "Executors not found" Error**
```bash
# Check plugin is registered
cat nx.json | grep claude-sessions

# Re-initialize if needed
npx nx g nx-claude-sessions:init --skipFormat
```

**❌ Node.js/NX Version Compatibility**
```bash
# Check versions
node --version    # Should be 18+
npx nx --version  # Should be 21+

# Update if needed
npm install -g nx@latest
```

#### Compatibility Matrix

| NX Version | nx-claude-sessions | Node.js | Status |
|------------|-------------------|---------|---------|
| 21.x       | 1.3.0+            | 18+     | ✅ Full Support |
| 20.x       | 1.0.x             | 18+     | ⚠️ Limited Support |
| 19.x       | -                 | 16+     | ❌ Not Supported |

#### Manual Fallback Installation

If the generator fails, you can manually set up the intelligence system:

```bash
# Create session directories
mkdir -p .nx-claude-sessions/{history,active,archives,coordination}

# Create library .claude directories
find libs -maxdepth 1 -type d -exec mkdir -p {}/.claude/{sessions,knowledge,context} \;

# Copy configuration templates
curl -o claude-sessions.config.js https://raw.githubusercontent.com/Andrew-henk/nx-conductor/main/tools/manual-setup.js
node claude-sessions.config.js
```

## 🛠️ Quick Start

### 1. Initialize the Plugin

```bash
npx nx g nx-claude-sessions:init
```

This will:
- Add plugin configuration to `nx.json`
- Create session storage directories
- Generate template `claude.md` files for existing libraries

### 2. Start a Library Session

```bash
npx nx start-claude-session auth --task="Implement 2FA authentication"
```

### 3. Add Session Support to New Libraries

```bash
npx nx g nx-claude-sessions:library-session my-new-lib
```

### 4. Start Your First Hierarchical Session

Your Claude Code sessions now use hierarchical knowledge management:

```bash
# Start a session with workspace + library context
nx start-claude-session auth --task="Implement JWT authentication"

# The session automatically loads:
# 🏢 Workspace decisions: "Use TypeScript strict mode everywhere"
# 📚 Library decisions: "Auth uses JWT with 15min expiry"
# 🎨 Workspace patterns: "Standard error handling utility"
# 🎨 Library patterns: "Auth guard pattern for routes"
```

**Scoped Knowledge Capture** during sessions:
```bash
# In Claude Code - specify scope for decisions:
"WORKSPACE-DECISION: Standardizing on Zod for all validation"
"DECISION: This auth library will use bcrypt for passwords"
"WORKSPACE-PATTERN: Created error response utility"
"PATTERN: JWT refresh token rotation strategy"
```

Manage hierarchical knowledge:
```bash
# Search across both workspace and library levels
nx session-manager --command=search --query="validation patterns"

# Extract knowledge with proper scoping
nx session-manager auth --command=extract-knowledge

# Archive with hierarchical knowledge preservation
nx session-manager --command=archive --maxAge=24h
```

### 5. Explore Advanced Features

See the comprehensive [Usage](#-usage) section below for all available commands and options.

## 📖 Usage

### Basic Commands

#### Initialize Workspace
```bash
# Basic initialization
nx g nx-claude-sessions:init

# Custom configuration
nx g nx-claude-sessions:init \
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

**Project-Specific Commands:**
```bash
# View sessions for a specific library
nx session-manager <library-name> --command=status

# Search session history for a library
nx session-manager <library-name> --command=search --query="authentication"

# Clean up sessions for a library
nx session-manager <library-name> --command=cleanup --maxAge=7d

# Extract knowledge from completed sessions
nx session-manager <library-name> --command=extract-knowledge

# Archive old sessions
nx session-manager <library-name> --command=archive --maxAge=24h
```

**Global (Workspace-Level) Commands:**
```bash
# View all active sessions across workspace
nx run-many -t session-status

# Clean up old sessions across all libraries
nx run-many -t session-cleanup

# Search sessions across workspace
nx run-many -t session-search

# Extract knowledge from all completed sessions
nx session-manager --command=extract-knowledge

# Archive old sessions workspace-wide
nx session-manager --command=archive --maxAge=48h
```

**Knowledge & Intelligence Commands:**
```bash
# View detailed session logs with progress
nx session-manager --command=logs --sessionId=<session-id> --limit=20

# Show recent commits from sessions
nx session-manager --command=commits --limit=10

# Stop a running session gracefully
nx session-manager --command=stop --sessionId=<session-id>

# Terminate session immediately
nx session-manager --command=terminate --sessionId=<session-id>
```

**Add Session Support to New Libraries:**
```bash
# Set up Claude session support for a library created after init
nx g nx-claude-sessions:library-session my-new-lib

# With custom session timeout
nx g nx-claude-sessions:library-session my-lib --sessionTimeout=45m
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

#### `nx g nx-claude-sessions:init`
Initialize workspace for Claude Sessions

**Options:**
- `--maxConcurrency=5`: Maximum concurrent sessions
- `--sessionTimeout=30m`: Session timeout duration
- `--orchestrationStrategy=dependency-aware`: Coordination strategy

#### `nx g nx-claude-sessions:library-session <library-name>` **(New in v1.3.0)**
Set up Claude session support for a specific library (useful for libraries created after workspace init)

**Options:**
- `--sessionTimeout=30m`: Custom session timeout for this library
- `--skipFormat`: Skip formatting files after generation

**Example:**
```bash
# Add session support to a newly created library
nx g @nx/js:lib my-new-feature
nx g nx-claude-sessions:library-session my-new-feature

# With custom timeout
nx g nx-claude-sessions:library-session api-client --sessionTimeout=45m
```

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

#### `nx session-manager <library> --command=<command>`
Manage Claude Code sessions for a specific library

**Commands:**
- `status`: Show session status and history for the library
- `search`: Search session history with optional query
- `cleanup`: Clean up old sessions (default: older than 7 days)
- `list`: List all sessions for the library
- `terminate`: Terminate a specific session by ID

**Options:**
- `--query`: Search query (used with `search` command)
- `--sessionId`: Session ID to terminate (used with `terminate` command)
- `--maxAge`: Maximum age for cleanup, e.g., "7d", "2w" (used with `cleanup` command)
- `--detailed`: Show detailed session information

**Examples:**
```bash
# Check session status for a library
nx session-manager auth --command=status

# Search session history
nx session-manager ui --command=search --query="button styling"

# Clean up old sessions
nx session-manager api --command=cleanup --maxAge=3d

# Terminate a specific session
nx session-manager auth --command=terminate --sessionId=auth-session-123
```

#### Global Session Management **(New in v1.3.0)**
Manage sessions across the entire workspace using run-many

**Available Global Commands:**
```bash
# View status of all active sessions across workspace
nx run-many -t session-status

# Clean up old sessions across all libraries
nx run-many -t session-cleanup

# Search sessions across the entire workspace
nx run-many -t session-search
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

## 🏗️ Hierarchical Knowledge Management

### Two-Level Architecture

nx-claude-sessions creates a powerful **hierarchical knowledge system**:

```
workspace/
├── .claude/                    # 🏢 WORKSPACE-LEVEL KNOWLEDGE
│   ├── decisions.json         # Architecture affecting entire workspace
│   ├── patterns.json          # Cross-library reusable patterns
│   └── session-history.json   # Workspace session insights
├── libs/
│   ├── auth/
│   │   └── .claude/           # 📚 LIBRARY-LEVEL KNOWLEDGE
│   │       ├── decisions.json # Auth-specific decisions
│   │       ├── patterns.json  # Auth patterns & utilities
│   │       └── session-history.json
│   └── ui/
│       └── .claude/           # 📚 LIBRARY-LEVEL KNOWLEDGE
│           └── ...
```

### Knowledge Inheritance & Scoping

**Inheritance Chain:**
1. **Workspace** knowledge applies to all libraries
2. **Library** knowledge applies to specific domain
3. **Library overrides workspace** when conflicts exist

**Session Context Loading:**
```bash
nx start-claude-session auth --task="Add OAuth integration"

# Loads hierarchical context:
# 🏢 Workspace: "TypeScript strict mode standard"
# 🏢 Workspace: "Error handling utility pattern" 
# 📚 Auth: "JWT 15min expiry decision"
# 📚 Auth: "bcrypt password hashing choice"
# 📚 Auth: "Auth guard pattern for routes"
```

**Scoped Knowledge Capture:**

During Claude Code sessions, specify scope for decisions:
- `WORKSPACE-DECISION:` → Saved to `/.claude/decisions.json`  
- `DECISION:` → Saved to `libs/[lib]/.claude/decisions.json`
- `WORKSPACE-PATTERN:` → Available across all libraries
- `PATTERN:` → Library-specific implementation

**Real-Time Hierarchical Intelligence:**
- Context inheritance prevents starting from scratch
- Workspace standards ensure consistency across teams
- Library specialization captures domain expertise
- Automatic scoping based on decision impact

### Knowledge Search Across Hierarchy

```bash
# Search finds knowledge at both levels
nx session-manager --command=search --query="validation"

# Results:
# 🏢 Workspace: "Zod validation standard for all libs"
# 📚 Auth: "Password validation with strength rules"  
# 📚 UI: "Form validation patterns for components"
```

## 🤖 MCP Integration Benefits

### Standalone vs MCP-Enhanced

**Standalone nx-claude-sessions** provides:
- ✅ Hierarchical knowledge management  
- ✅ Real-time decision and pattern capture
- ✅ Local knowledge persistence in `.claude/` directories
- ✅ Context-aware session initialization

**With MCP Server** (`claude-session-intelligence-mcp`) adds:
- 🚀 **Cross-Session Memory**: Knowledge persists across ALL Claude Desktop + Claude Code sessions
- 🔍 **Universal Search**: Query decisions from any Claude session (Desktop, Code, API)
- 🧠 **Enhanced Context Loading**: Richer context with advanced reasoning capabilities
- 🔄 **Bidirectional Sync**: Changes made in Claude Desktop sessions flow to Claude Code sessions
- 📊 **Advanced Analytics**: Pattern recognition across different session types

### MCP Setup for Maximum Benefits

```bash
# 1. Install MCP server globally
npm install -g claude-session-intelligence-mcp@latest

# 2. Configure Claude Desktop
# Add to ~/.config/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "claude-session-intelligence": {
      "command": "npx",
      "args": ["claude-session-intelligence-mcp"],
      "env": {
        "WORKSPACE_ROOT": "/path/to/your/nx-workspace"
      }
    }
  }
}

# 3. Restart Claude Desktop
```

### Enhanced Workflow with MCP

**In Claude Desktop:**
```
Load context for my auth library
→ Gets hierarchical knowledge from nx-claude-sessions

Record this decision: We're switching from bcrypt to Argon2 for better security
→ Automatically saved to workspace/.claude/ or libs/auth/.claude/

Show me authentication patterns I can reuse
→ Displays patterns from both workspace and library levels
```

**In Claude Code (via nx-claude-sessions):**
```bash
nx start-claude-session auth --task="Implement Argon2 hashing"
# Automatically loads the Argon2 decision made in Claude Desktop
# Session context includes cross-session knowledge
```

**Unified Knowledge Base:**
- Decisions made in Claude Desktop appear in Claude Code sessions
- Patterns created in Claude Code are searchable in Claude Desktop  
- Session history spans both environments
- Knowledge attribution tracks which session/tool created each insight

### MCP-Enhanced Commands

When MCP server is running, enhanced capabilities:

```bash
# Richer context loading with MCP reasoning
nx start-claude-session auth --task="Security audit"
# Loads not just data, but reasoned insights about security decisions

# Advanced pattern matching  
nx session-manager --command=search --query="security patterns"
# MCP provides semantic search, not just text matching

# Cross-session recommendations
nx session-manager auth --command=extract-knowledge  
# MCP suggests related decisions from other sessions/environments
```

## 🚀 Advanced Usage

### Feature Orchestration

For complex features spanning multiple libraries:

```bash
# Analyze feature scope and create orchestration plan
nx orchestrate user-onboarding \
  --libraries=auth,user-profile,notifications \
  --strategy=dependency-aware \
  --maxSessions=4
```

### Session Management

```bash
# View active sessions
nx session-manager --command=status

# Search session history  
nx session-manager --command=search --query="authentication patterns"

# Archive completed sessions
nx session-manager --command=cleanup
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

## 🔧 Troubleshooting

### Common Issues

#### **Claude Code not found**
```
❌ Claude Code not found
💡 Use --customClaudePath to specify location
💡 Use --dangerouslySkipPermissions to bypass this check
```

**Solutions:**
1. **Install Claude Code CLI**: Ensure Claude Code is installed and in your PATH
2. **Specify custom path**: Use `--customClaudePath="/path/to/claude-code"`
3. **Check installation**: Run `claude-code --version` to verify installation

#### **Library not found**
```
❌ Library 'my-lib' not found in workspace
```

**Solutions:**
1. **Verify library exists**: Run `nx show projects` to list all libraries
2. **Check library name**: Ensure you're using the exact project name from NX
3. **Library path issues**: Make sure the library has a valid `project.json`

#### **Session fails to start**
```
❌ Session failed to start: Permission denied
```

**Solutions:**
1. **Check permissions**: Ensure write access to `.nx-claude-sessions` directory
2. **Workspace validation**: Verify you're in the root of an NX workspace
3. **Process limits**: Check if you've hit the session concurrency limit (default 5)

#### **Context loading fails**
```
⚠️  Could not load library context: ENOENT: no such file or directory
```

**Solutions:**
1. **Create claude.md**: Add a `claude.md` file to your library root
2. **Check file permissions**: Ensure `claude.md` is readable
3. **Bypass context**: Use `--includeContext=false` to skip context loading

#### **Session hangs or doesn't respond**
```
Session auth-123 active... (no activity for 10 minutes)
```

**Solutions:**
1. **Check session status**: Run `nx session-manager --command=status`
2. **Terminate hanging session**: Use `nx session-manager --command=terminate --sessionId=auth-123`
3. **Restart session pool**: Exit and restart your development environment

#### **Memory or performance issues**
```
Session pool using excessive memory (>1GB)
```

**Solutions:**
1. **Reduce concurrency**: Lower `maxConcurrency` in plugin configuration
2. **Clean up sessions**: Run `nx session-manager --command=cleanup`
3. **Check for leaks**: Look for sessions that haven't properly terminated

### Advanced Debugging

#### **Enable Debug Logging**
```bash
# Add debug flags to see detailed process information
nx start-claude-session my-lib \
  --task="Debug issue" \
  --passthroughArgs="--verbose,--debug"
```

#### **Inspect Session Files**
```bash
# Check session storage for debugging
ls -la .nx-claude-sessions/active/
ls -la .nx-claude-sessions/history/
```

#### **Process Monitoring**
```bash
# Monitor active Claude Code processes
ps aux | grep claude-code

# Check session resource usage
nx session-manager --command=status --detailed=true
```

### Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `ENOENT` | File or directory not found | Check paths and permissions |
| `EACCES` | Permission denied | Fix file/directory permissions |
| `EMFILE` | Too many open files | Reduce session concurrency |
| `ENOTDIR` | Not a directory | Verify workspace structure |
| `TIMEOUT` | Operation timed out | Check Claude Code responsiveness |

### Getting Help

1. **Check session logs**: Look in `.nx-claude-sessions/active/{session-id}/` for detailed logs
2. **Search session history**: Use `nx session-manager --command=search --query="your error"`
3. **Validate configuration**: Ensure your `nx.json` plugin configuration is correct
4. **Reset plugin state**: Delete `.nx-claude-sessions` directory to start fresh

### Performance Optimization

#### **Reduce Session Overhead**
```bash
# Use raw mode for minimal context
nx start-claude-session my-lib \
  --task="Quick fix" \
  --rawMode=true
```

#### **Optimize Context Loading**
```bash
# Skip context for simple tasks
nx passthrough \
  --args="--help" \
  --includeContext=false
```

#### **Batch Operations**
```bash
# Use orchestration for related tasks
nx orchestrate "batch updates" \
  --libraries=lib1,lib2,lib3 \
  --strategy=sequential
```

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
nx g nx-claude-sessions:init
nx start-claude-session <library> --task="test task"
```

## 📋 Changelog

### v1.3.0 (2025-09-12) - Production Ready Release

**🚀 Major Features:**
- ✅ **New Generator**: Added `library-session` generator for adding session support to libraries created after init
- ✅ **Global Session Management**: Added `global-session-manager` executor with workspace-level commands
- ✅ **Enhanced User Experience**: Improved command output with clear project-specific vs global command distinction

**🔧 Bug Fixes:**
- ✅ Fixed plugin name inconsistency in generator (now correctly uses `nx-claude-sessions`)
- ✅ Resolved executor registration issues for fresh workspace installations
- ✅ Fixed TypeScript compilation errors and missing schema files

**📚 Documentation:**
- ✅ Updated compatibility matrix to v1.3.0+
- ✅ Added comprehensive usage examples for new features
- ✅ Improved troubleshooting guide with tested solutions

**⚡ Performance:**
- ✅ Optimized build process with proper asset inclusion
- ✅ Streamlined package structure for better npm distribution

### v1.2.2 (2025-09-12)
- 🔧 Fixed missing template files in published package
- 🔧 Corrected executor/generator path references

### v1.2.1 (2025-09-12)
- 🔧 Fixed generator factory paths for proper execution

### v1.2.0 (2025-09-12)
- ✅ Added comprehensive error handling and diagnostics
- ✅ Implemented version compatibility checks
- ✅ Added manual fallback installation system

### v1.1.1 (2025-09-11)
- 🔧 Fixed ES module imports and schema file references

### v1.1.0 (2025-09-11)
- ✅ Added real-time progress tracking
- ✅ Implemented auto-commit functionality  
- ✅ Enhanced session management capabilities

### v1.0.0 (2025-09-10)
- 🎉 Initial release with core session orchestration features

## 📄 License

MIT - See LICENSE file for details

---

**🧠 Revolutionizing monorepo development with AI orchestration**

Built for the future of collaborative AI development in complex codebases.