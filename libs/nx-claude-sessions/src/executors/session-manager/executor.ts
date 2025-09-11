import { ExecutorContext, logger, createProjectGraphAsync } from '@nx/devkit'
import { SessionManagerExecutorSchema } from './schema'
import { SessionPool } from '../../utils/session-pool'
import { existsSync, readdirSync, readFileSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'

interface SessionRecord {
  id: string
  library: string
  status: string
  startTime: Date
  endTime?: Date
  taskDescription: string
  duration?: number
}

export default async function runExecutor(
  options: SessionManagerExecutorSchema,
  context: ExecutorContext
) {
  logger.info(`🔧 Session Manager: ${options.command || 'status'}`)
  
  try {
    const sessionStoragePath = join(context.root, '.nx-claude-sessions')
    
    switch (options.command) {
      case 'status':
        return await handleStatusCommand(context.root, options)
      case 'cleanup':
        return await handleCleanupCommand(sessionStoragePath, options)
      case 'search':
        return await handleSearchCommand(sessionStoragePath, options)
      case 'terminate':
        return await handleTerminateCommand(context.root, options)
      case 'list':
        return await handleListCommand(sessionStoragePath, options)
      default:
        return await handleStatusCommand(context.root, options)
    }
  } catch (error) {
    logger.error(`❌ Session manager error: ${error}`)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function handleStatusCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  const sessionPool = new SessionPool(5, workspaceRoot)
  const activeStatus = sessionPool.getActiveSessionsStatus()
  const queueStatus = sessionPool.getQueueStatus()
  
  logger.info('📊 Session Status')
  logger.info('================')
  
  if (activeStatus.length === 0) {
    logger.info('🔄 No active sessions')
  } else {
    logger.info(`🔄 Active Sessions (${activeStatus.length}):`)
    activeStatus.forEach(session => {
      const duration = Math.round(session.duration / 1000)
      logger.info(`   • ${session.sessionId} - ${session.library} (${duration}s)`)
    })
  }
  
  if (queueStatus.length > 0) {
    logger.info(`⏳ Queued Sessions (${queueStatus.length}):`)
    queueStatus.forEach(task => {
      logger.info(`   • ${task.library} (priority: ${task.priority})`)
    })
  }
  
  const historyCount = await getHistoryCount(join(workspaceRoot, '.nx-claude-sessions'))
  logger.info(`📚 Historical Sessions: ${historyCount}`)
  
  return { success: true, active: activeStatus.length, queued: queueStatus.length, historical: historyCount }
}

async function handleCleanupCommand(sessionStoragePath: string, options: SessionManagerExecutorSchema) {
  logger.info('🧹 Cleaning up old sessions...')
  
  const maxAge = parseTimespan(options.maxAge || '7d')
  const now = Date.now()
  const cutoffTime = now - maxAge
  
  let cleanedCount = 0
  
  // Clean up old active sessions
  const activePath = join(sessionStoragePath, 'active')
  if (existsSync(activePath)) {
    const activeDirs = readdirSync(activePath)
    for (const sessionDir of activeDirs) {
      const sessionPath = join(activePath, sessionDir)
      try {
        const stats = statSync(sessionPath)
        if (stats.mtime.getTime() < cutoffTime) {
          // Remove old session directory
          require('fs').rmSync(sessionPath, { recursive: true, force: true })
          cleanedCount++
          logger.info(`   Removed old session: ${sessionDir}`)
        }
      } catch (error) {
        logger.warn(`   Could not clean session ${sessionDir}: ${error}`)
      }
    }
  }
  
  // Clean up old history files
  const historyPath = join(sessionStoragePath, 'history')
  if (existsSync(historyPath)) {
    const historyFiles = readdirSync(historyPath).filter(f => f.endsWith('.json'))
    for (const historyFile of historyFiles) {
      const filePath = join(historyPath, historyFile)
      try {
        const history = JSON.parse(readFileSync(filePath, 'utf-8'))
        const filteredSessions = history.recentSessions?.filter((session: any) => 
          new Date(session.date).getTime() > cutoffTime
        ) || []
        
        if (filteredSessions.length !== history.recentSessions?.length) {
          history.recentSessions = filteredSessions
          require('fs').writeFileSync(filePath, JSON.stringify(history, null, 2))
          logger.info(`   Cleaned history for: ${historyFile.replace('.json', '')}`)
        }
      } catch (error) {
        logger.warn(`   Could not clean history ${historyFile}: ${error}`)
      }
    }
  }
  
  logger.info(`✅ Cleanup completed: ${cleanedCount} items removed`)
  return { success: true, cleanedCount }
}

async function handleSearchCommand(sessionStoragePath: string, options: SessionManagerExecutorSchema) {
  const query = options.query?.toLowerCase()
  if (!query) {
    logger.error('❌ Search query required')
    return { success: false, error: 'Search query required' }
  }
  
  logger.info(`🔍 Searching sessions for: "${query}"`)
  logger.info('=====================================')
  
  const results: SessionRecord[] = []
  const historyPath = join(sessionStoragePath, 'history')
  
  if (existsSync(historyPath)) {
    const historyFiles = readdirSync(historyPath).filter(f => f.endsWith('.json'))
    
    for (const historyFile of historyFiles) {
      const library = historyFile.replace('.json', '')
      
      if (options.library && library !== options.library) {
        continue
      }
      
      try {
        const filePath = join(historyPath, historyFile)
        const history = JSON.parse(readFileSync(filePath, 'utf-8'))
        
        const matchingSessions = history.recentSessions?.filter((session: any) => {
          const sessionText = `${session.taskType} ${session.outcome} ${JSON.stringify(session.keyDecisions || [])}`.toLowerCase()
          return sessionText.includes(query)
        }) || []
        
        matchingSessions.forEach((session: any) => {
          results.push({
            id: session.id,
            library,
            status: session.outcome,
            startTime: new Date(session.date),
            taskDescription: session.taskType
          })
        })
        
        // Also search accumulated knowledge
        const knowledge = history.accumulatedKnowledge || {}
        if (knowledge.patterns) {
          knowledge.patterns.forEach((pattern: any) => {
            if (pattern.pattern.toLowerCase().includes(query) || 
                pattern.description.toLowerCase().includes(query)) {
              logger.info(`   📝 Pattern in ${library}: ${pattern.pattern} - ${pattern.description}`)
            }
          })
        }
        
      } catch (error) {
        logger.warn(`   Could not search history ${historyFile}: ${error}`)
      }
    }
  }
  
  if (results.length === 0) {
    logger.info('🔍 No matching sessions found')
  } else {
    logger.info(`🔍 Found ${results.length} matching sessions:`)
    results.forEach(result => {
      logger.info(`   • ${result.id} - ${result.library} (${result.taskDescription}, ${result.status})`)
      if (options.detailed) {
        logger.info(`     Date: ${result.startTime.toISOString()}`)
      }
    })
  }
  
  return { success: true, results: results.length, sessions: results }
}

async function handleTerminateCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  if (!options.sessionId) {
    logger.error('❌ Session ID required for terminate command')
    return { success: false, error: 'Session ID required' }
  }
  
  logger.info(`🛑 Terminating session: ${options.sessionId}`)
  
  const sessionPool = new SessionPool(5, workspaceRoot)
  
  try {
    await sessionPool.terminateSession(options.sessionId)
    logger.info(`✅ Session ${options.sessionId} terminated successfully`)
    return { success: true, terminatedSession: options.sessionId }
  } catch (error) {
    logger.error(`❌ Failed to terminate session: ${error}`)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function handleListCommand(sessionStoragePath: string, options: SessionManagerExecutorSchema) {
  logger.info('📋 Session List')
  logger.info('===============')
  
  const sessions: SessionRecord[] = []
  
  // List active sessions
  if (options.includeActive) {
    const activePath = join(sessionStoragePath, 'active')
    if (existsSync(activePath)) {
      const activeDirs = readdirSync(activePath)
      for (const sessionDir of activeDirs) {
        try {
          const contextPath = join(activePath, sessionDir, 'context.md')
          if (existsSync(contextPath)) {
            const context = readFileSync(contextPath, 'utf-8')
            const libraryMatch = context.match(/\\*\\*Library\\*\\*: (.+)/m)
            const taskMatch = context.match(/\\*\\*Task\\*\\*: (.+)/m)
            
            sessions.push({
              id: sessionDir,
              library: libraryMatch?.[1] || 'unknown',
              status: 'active',
              startTime: statSync(join(activePath, sessionDir)).birthtime,
              taskDescription: taskMatch?.[1] || 'unknown task'
            })
          }
        } catch (error) {
          logger.warn(`   Could not read active session ${sessionDir}: ${error}`)
        }
      }
    }
  }
  
  // List recent historical sessions
  const historyPath = join(sessionStoragePath, 'history')
  if (existsSync(historyPath)) {
    const historyFiles = readdirSync(historyPath).filter(f => f.endsWith('.json'))
    
    for (const historyFile of historyFiles) {
      const library = historyFile.replace('.json', '')
      
      if (options.library && library !== options.library) {
        continue
      }
      
      try {
        const filePath = join(historyPath, historyFile)
        const history = JSON.parse(readFileSync(filePath, 'utf-8'))
        
        const recentSessions = history.recentSessions?.slice(0, 5) || []
        recentSessions.forEach((session: any) => {
          sessions.push({
            id: session.id,
            library,
            status: session.outcome,
            startTime: new Date(session.date),
            taskDescription: session.taskType
          })
        })
      } catch (error) {
        logger.warn(`   Could not read history ${historyFile}: ${error}`)
      }
    }
  }
  
  // Sort by start time (most recent first)
  sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  
  if (sessions.length === 0) {
    logger.info('📋 No sessions found')
  } else {
    logger.info(`📋 Found ${sessions.length} sessions:`)
    sessions.forEach(session => {
      const duration = session.endTime 
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)
        : 'ongoing'
      const timeStr = session.startTime.toISOString().split('T')[0]
      
      logger.info(`   • ${session.status === 'active' ? '🟢' : '⚪'} ${session.id}`)
      logger.info(`     ${session.library} - ${session.taskDescription}`)
      logger.info(`     ${timeStr} (${duration}${typeof duration === 'number' ? 's' : ''})`)
      
      if (options.detailed && session.status !== 'active') {
        logger.info(`     Status: ${session.status}`)
      }
    })
  }
  
  return { success: true, sessions: sessions.length, data: sessions }
}

async function getHistoryCount(sessionStoragePath: string): Promise<number> {
  const historyPath = join(sessionStoragePath, 'history')
  if (!existsSync(historyPath)) return 0
  
  let totalCount = 0
  const historyFiles = readdirSync(historyPath).filter(f => f.endsWith('.json'))
  
  for (const historyFile of historyFiles) {
    try {
      const filePath = join(historyPath, historyFile)
      const history = JSON.parse(readFileSync(filePath, 'utf-8'))
      totalCount += history.totalSessionCount || 0
    } catch {
      // Ignore errors reading history files
    }
  }
  
  return totalCount
}

function parseTimespan(timespan: string): number {
  const match = timespan.match(/^(\\d+)([smhd])$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000 // Default 7 days
  
  const [, value, unit] = match
  const num = parseInt(value, 10)
  
  switch (unit) {
    case 's': return num * 1000
    case 'm': return num * 60 * 1000
    case 'h': return num * 60 * 60 * 1000
    case 'd': return num * 24 * 60 * 60 * 1000
    default: return 7 * 24 * 60 * 60 * 1000
  }
}