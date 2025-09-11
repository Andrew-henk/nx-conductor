# nx-conductor

## Project Vision
Build the first NX-native distributed AI development orchestration system that enables library-scoped, concurrency-managed Claude Code sessions with intelligent knowledge persistence and cross-session coordination.

## Core Concepts

### Library-Scoped Sessions
- Each NX library gets its own focused Claude sessions
- Sessions inherit library-specific context + shared resource awareness
- Task-bounded sessions (not endless library-long sessions)
- Automatic knowledge distillation and persistence

### Distributed Session Orchestration  
- Master session coordinates worker sessions across libraries
- Respects NX dependency graph for work prioritization
- Concurrency limits (default 5 sessions) like NX task runner
- Intelligent work distribution and session handoffs

### Knowledge Persistence
- Compressed session history survives across sessions
- Library-specific patterns, decisions, and solutions accumulate
- Automatic context inheritance without conversation baggage
- Searchable session archives and decision logs

## Technical Architecture

### NX Plugin Structure
```
libs/nx-claude-sessions/
├── src/
│   ├── generators/
│   │   ├── init/              # Workspace setup
│   │   ├── library-session/   # Library session config  
│   │   └── feature-session/   # Feature orchestration
│   ├── executors/
│   │   ├── start-session/     # Start library session
│   │   ├── orchestrate/       # Master orchestrator
│   │   └── session-manager/   # Lifecycle management
│   └── utils/
│       ├── session-pool.ts    # Concurrency management
│       ├── context-loader.ts  # NX-aware context loading
│       └── dependency-graph.ts # NX integration
```

### Integration Strategy
- **Extend NX MCP Server**: Build on existing nx_workspace, nx_project_details tools
- **Leverage claude-flow**: Use proven memory system and hive-mind coordination
- **Integrate ccmanager**: Session lifecycle management and worktree integration
- **NX Dependency Graph**: Drive work prioritization and cross-library coordination

## Key Technologies
- **@nx/devkit**: Plugin development framework
- **claude-flow**: Memory persistence and coordination
- **ccmanager**: Session management
- **NX MCP Server**: Workspace context and project graph
- **Claude Code**: Underlying AI development tool

## Development Principles

### Session Boundaries
- Task-bounded sessions, not library-long sessions
- Compression triggers session archival and knowledge extraction
- Smart resumption only for recent, active work
- Clear handoffs with accumulated wisdom inheritance

### Concurrency Management  
- Default 5 concurrent sessions (configurable)
- Priority based on NX dependency graph critical path
- Dynamic scaling based on queue pressure
- Session weights for resource management

### Context Loading Strategy
- Library claude.md files for domain-specific context
- Shared resource awareness via NX dependencies  
- Accumulated session knowledge (compressed learnings)
- Real-time cross-session communication for coordination

## Example Workflows

### Feature Development
```bash
# Master session orchestrates feature across libraries
nx orchestrate-feature add-notifications --max-sessions=5

# Spawns focused worker sessions:
# - shared/api: WebSocket endpoints
# - auth: Permission system  
# - notifications: Core logic
# - ui-components: Notification UI
# - web-app: Integration (queued)
```

### Library Development
```bash
# Start focused library session with full context
nx start-claude-session auth

# Loads: library claude.md + shared resources + session history
# Creates: task-bounded session with inherited wisdom
```

### Session Management
```bash
nx session-status        # View active sessions and queue
nx session-cleanup       # Archive completed sessions  
nx session-search        # Search historical sessions
```

## Success Metrics
- **Context Efficiency**: No repeated project explanations
- **Development Speed**: Parallel work across library boundaries
- **Knowledge Retention**: Accumulated library wisdom persists
- **Seamless Handoffs**: Natural transitions between focused sessions

## Implementation Phases
1. **Core Plugin**: Basic session management + NX integration
2. **Orchestration**: Master session coordination + concurrency
3. **Advanced Features**: Intelligent transitions + knowledge distillation
4. **Integration**: claude-flow memory + ccmanager lifecycle

## Coding Standards
- TypeScript with strict mode
- Follow NX plugin conventions
- Comprehensive error handling
- Extensive testing with real NX workspaces
- Clear separation of concerns between orchestration layers

## Dependencies
- Must work with existing Claude Code installations
- Compatible with current NX MCP server
- Graceful fallbacks when external tools unavailable
- Incremental adoption - works standalone or with full orchestration