# Development Patterns

## NX Plugin Development
- Use `@nx/devkit` for plugin structure
- Follow NX naming conventions (kebab-case for generators/executors)
- Implement proper schema validation
- Provide comprehensive error handling

## Session Management
- Task-bounded sessions prevent context bloat
- Compression triggers knowledge extraction
- Smart resumption for active work only
- Clear handoffs with wisdom inheritance

## Concurrency Patterns
- Default 5 concurrent sessions (configurable)
- Priority queue based on NX dependency graph
- Dynamic scaling based on queue pressure
- Session weights for resource allocation

## Context Loading Strategy
- Library claude.md files for domain context
- NX dependency awareness for shared resources
- Compressed session history for accumulated knowledge
- Real-time cross-session coordination channels

## Error Handling
- Graceful fallbacks when external tools unavailable
- Incremental adoption - works standalone or orchestrated
- Clear error messages with actionable guidance
- Automatic cleanup on session failures