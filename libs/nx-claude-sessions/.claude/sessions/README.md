# Session Management

This directory contains session management files for the nx-claude-sessions intelligence system.

## Files

- `session-registry.json`: Active session tracking and configuration
- `*.session.json`: Individual session metadata and state
- `*.compressed.md`: Compressed knowledge from completed sessions

## Session Lifecycle

1. **Queued**: Session requested, waiting for available slot
2. **Active**: Session running, consuming resources  
3. **Completing**: Session finishing, knowledge extraction in progress
4. **Archived**: Session complete, knowledge compressed and stored

## Cleanup Policy

- Active sessions: Max 2 hours before auto-timeout
- Completed sessions: Compressed after 24 hours
- Archive retention: 30 days for searchability