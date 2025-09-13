# NX Claude Sessions Library Context

## Purpose
Core NX plugin library for distributed AI development orchestration system. Enables library-scoped Claude Code sessions with intelligent coordination and knowledge persistence.

## Key Components

### Generators
- `init`: Workspace setup and intelligence configuration
- `library-session`: Library-specific session configuration
- `feature-session`: Feature orchestration across libraries

### Executors  
- `start-session`: Launch library-scoped Claude sessions
- `orchestrate`: Master session coordination
- `session-manager`: Session lifecycle management

### Core Utilities
- `session-pool.ts`: Concurrency management (default 5 sessions)
- `context-loader.ts`: NX-aware context loading
- `dependency-graph.ts`: NX dependency integration

## Architecture Principles
- Task-bounded sessions (not endless library sessions)
- Knowledge compression and persistence
- NX dependency graph drives work prioritization
- Intelligent context inheritance without conversation baggage

## Integration Points
- **NX MCP Server**: Extends existing workspace tools
- **claude-flow**: Memory system and coordination
- **ccmanager**: Session lifecycle management
- **Claude Code**: Underlying AI development tool

## Development Context
- TypeScript with strict mode
- Follow NX plugin conventions
- Extensive error handling
- Real NX workspace testing