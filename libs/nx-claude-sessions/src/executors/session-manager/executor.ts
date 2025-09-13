import { ExecutorContext, logger, createProjectGraphAsync } from '@nx/devkit'
import { SessionManagerExecutorSchema } from './schema'
import { SessionPool } from '../../utils/session-pool'
import { McpIntegration } from '../../utils/mcp-integration'
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
      case 'logs':
        return await handleLogsCommand(context.root, options)
      case 'commits':
        return await handleCommitsCommand(context.root, options)
      case 'stop':
        return await handleStopCommand(context.root, options)
      case 'extract-knowledge':
        return await handleExtractKnowledgeCommand(context.root, options)
      case 'archive':
        return await handleArchiveCommand(context.root, options)
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
  const activeProgress = sessionPool.getActiveProgress()
  const queueStatus = sessionPool.getQueueStatus()
  
  logger.info('📊 Session Status with Progress Tracking')
  logger.info('=========================================')
  
  if (activeProgress.length === 0) {
    logger.info('🔄 No active sessions')
  } else {
    logger.info(`🔄 Active Sessions (${activeProgress.length}):`)
    activeProgress.forEach(progress => {
      const progressBar = createProgressBar(progress.progressPercentage)
      const duration = formatDuration(Date.now() - progress.startTime)
      
      logger.info(``)
      logger.info(`🔹 ${progress.library} (${progress.sessionId})`)
      logger.info(`   ${progressBar} ${Math.round(progress.progressPercentage)}% │ ETA: ${progress.eta}`)
      logger.info(`   Phase: ${progress.currentPhase} (${progress.phaseIndex + 1}/${progress.totalPhases})`)
      logger.info(`   Duration: ${duration} │ Files: ${progress.filesModified.length} │ Commits: ${progress.commits.length}`)
      
      if (options.detailed && progress.filesModified.length > 0) {
        logger.info(`   Recent files: ${progress.filesModified.slice(-3).join(', ')}`)
      }
    })
  }
  
  if (queueStatus.length > 0) {
    logger.info(``)
    logger.info(`⏳ Queued Sessions (${queueStatus.length}):`)
    queueStatus.forEach(task => {
      logger.info(`   • ${task.library} (priority: ${task.priority})`)
    })
  }
  
  const historyCount = await getHistoryCount(join(workspaceRoot, '.nx-claude-sessions'))
  logger.info(`📚 Historical Sessions: ${historyCount}`)
  
  return { success: true, active: activeProgress.length, queued: queueStatus.length, historical: historyCount }
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
  
  logger.info(`🔍 Searching hierarchical knowledge for: "${query}"`)
  logger.info('====================================================')
  
  // Get workspace root from sessionStoragePath  
  const workspaceRoot = sessionStoragePath.replace('/.nx-claude-sessions', '')
  const mcpIntegration = new McpIntegration(workspaceRoot)
  
  // Search workspace-level knowledge
  logger.info('🏢 Workspace-level results:')
  const workspaceDecisions = await mcpIntegration.searchDecisions(query)
  const workspaceResults = workspaceDecisions.filter(d => d.context.scope === 'workspace')
  
  if (workspaceResults.length > 0) {
    workspaceResults.forEach(decision => {
      logger.info(`   📋 Decision: ${decision.title}`)
      logger.info(`      Reasoning: ${decision.reasoning}`)
      logger.info(`      Impact: ${decision.impact}`)
      logger.info(`      When: ${new Date(decision.context.timestamp).toLocaleDateString()}`)
      logger.info('')
    })
  } else {
    logger.info('   No workspace decisions found')
  }
  
  // Search library-level knowledge
  logger.info('📚 Library-level results:')
  const libraryDecisions = await mcpIntegration.searchDecisions(query, options.library)
  const libraryResults = libraryDecisions.filter(d => d.context.scope === 'library')
  
  if (libraryResults.length > 0) {
    // Group by library
    const decisionsByLibrary = libraryResults.reduce((acc: any, decision) => {
      const lib = decision.context.library
      if (!acc[lib]) acc[lib] = []
      acc[lib].push(decision)
      return acc
    }, {})
    
    Object.entries(decisionsByLibrary).forEach(([library, decisions]) => {
      const decisionsArray = decisions as any[]
      logger.info(`   📂 ${library}:`)
      decisionsArray.forEach(decision => {
        logger.info(`      📋 ${decision.title}`)
        logger.info(`         Reasoning: ${decision.reasoning}`)
        logger.info(`         Impact: ${decision.impact}`)
        logger.info(`         When: ${new Date(decision.context.timestamp).toLocaleDateString()}`)
      })
      logger.info('')
    })
  } else {
    logger.info('   No library decisions found')
  }
  
  // Also search session history (legacy)
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
        
      } catch (error) {
        logger.warn(`   Could not search history ${historyFile}: ${error}`)
      }
    }
  }
  
  // Summary
  const totalKnowledgeResults = workspaceResults.length + libraryResults.length
  const totalSessionResults = results.length
  
  logger.info('📊 Search Summary:')
  logger.info(`   Knowledge decisions found: ${totalKnowledgeResults}`)
  logger.info(`   Legacy session matches: ${totalSessionResults}`)
  
  if (totalSessionResults > 0) {
    logger.info('\n🗂️ Matching sessions:')
    results.forEach(result => {
      logger.info(`   • ${result.id} - ${result.library} (${result.taskDescription}, ${result.status})`)
    })
  }
  
  return { 
    success: true, 
    knowledgeResults: totalKnowledgeResults,
    sessionResults: totalSessionResults,
    workspace: workspaceResults,
    library: libraryResults,
    sessions: results 
  }
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

// New command handlers

async function handleLogsCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  const sessionPool = new SessionPool(5, workspaceRoot)
  const logs = sessionPool.getSessionLogs(options.sessionId)
  
  logger.info('📋 Session Logs')
  logger.info('================')
  
  if (logs.length === 0) {
    logger.info('No logs found')
    return { success: true }
  }
  
  const recentLogs = logs.slice(-(options.limit || 10))
  
  recentLogs.forEach(log => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString()
    const levelEmoji = getLevelEmoji(log.level)
    const sessionShort = log.sessionId.split('-').pop()
    
    logger.info(`[${timestamp}] ${levelEmoji} ${log.level} [${sessionShort}] ${log.message}`)
  })
  
  return { success: true }
}

async function handleCommitsCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  const sessionPool = new SessionPool(5, workspaceRoot)
  const commits = sessionPool.getRecentCommits(options.limit || 10)
  
  logger.info('📦 Recent Session Commits')
  logger.info('=========================')
  
  if (commits.length === 0) {
    logger.info('No commits found')
    return { success: true }
  }
  
  commits.forEach(commit => {
    const date = new Date(commit.timestamp).toLocaleString()
    const shortHash = commit.hash.substring(0, 8)
    const shortSession = commit.sessionId.split('-').pop()
    const shortMessage = commit.message.split('\\n')[0]
    
    logger.info(``)
    logger.info(`📦 ${shortHash} - ${date}`)
    logger.info(`   ${shortMessage}`)
    logger.info(`   Session: ${shortSession} │ Files: ${commit.filesModified}`)
  })
  
  return { success: true }
}

async function handleStopCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  if (!options.sessionId) {
    logger.error('❌ Session ID required for stop command')
    return { success: false, error: 'Session ID required' }
  }
  
  const sessionPool = new SessionPool(5, workspaceRoot)
  
  try {
    await sessionPool.stopSession(options.sessionId)
    logger.info(`⏹️  Stopped session ${options.sessionId}`)
    return { success: true }
  } catch (error) {
    logger.error(`❌ Failed to stop session: ${error}`)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Utility functions

function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled
  return '█'.repeat(filled) + '▒'.repeat(empty)
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

async function handleExtractKnowledgeCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  logger.info('🧠 Extracting knowledge from completed sessions...')
  
  const mcpIntegration = new McpIntegration(workspaceRoot)
  const sessionStoragePath = join(workspaceRoot, '.nx-claude-sessions')
  const activePath = join(sessionStoragePath, 'active')
  
  if (!existsSync(activePath)) {
    logger.warn('⚠️ No active sessions directory found')
    return { success: true, extracted: 0 }
  }

  let extractedCount = 0
  const sessionDirs = readdirSync(activePath)
  
  for (const sessionDir of sessionDirs) {
    const sessionPath = join(activePath, sessionDir)
    
    try {
      // Check if session is completed (has completion marker or old enough)
      const contextPath = join(sessionPath, 'context.md')
      const logPath = join(sessionPath, 'session.log')
      
      if (!existsSync(contextPath)) continue
      
      const stats = statSync(sessionPath)
      const isOldEnoughToArchive = Date.now() - stats.mtime.getTime() > (24 * 60 * 60 * 1000) // 24 hours
      const hasCompletionMarker = existsSync(join(sessionPath, 'completed.flag'))
      
      if (!isOldEnoughToArchive && !hasCompletionMarker) continue
      
      logger.info(`   📝 Processing session: ${sessionDir}`)
      
      // Extract learnings from the session
      const learnings = await mcpIntegration.extractSessionLearnings(sessionDir, sessionPath)
      
      if (learnings) {
        // Record any decisions found
        for (const decision of learnings.keyDecisions) {
          await mcpIntegration.recordDecision({
            title: decision,
            description: `Decision made during session ${sessionDir}`,
            reasoning: 'Extracted from session content',
            impact: 'Unknown - requires review',
            alternatives: [],
            context: {
              library: learnings.library,
              session: sessionDir,
              timestamp: new Date().toISOString(),
              author: 'system',
              scope: 'library' as const
            },
            tags: ['extracted', 'auto-generated']
          })
        }
        
        // Record any patterns found
        for (const pattern of learnings.patternsCreated) {
          await mcpIntegration.recordPattern({
            name: pattern,
            description: `Pattern created during session ${sessionDir}`,
            code: '// Code would need to be extracted from session files',
            language: 'typescript',
            context: {
              library: learnings.library,
              useCase: learnings.taskType,
              complexity: 'moderate' as const,
              scope: 'library' as const
            },
            tags: ['extracted', 'auto-generated'],
            relatedPatterns: []
          })
        }
        
        // Update session history
        await updateSessionHistory(workspaceRoot, learnings)
        
        extractedCount++
        logger.info(`   ✅ Extracted knowledge from ${sessionDir}`)
      }
      
    } catch (error) {
      logger.warn(`   ⚠️ Failed to extract knowledge from ${sessionDir}: ${error}`)
    }
  }
  
  logger.info(`🧠 Knowledge extraction completed: ${extractedCount} sessions processed`)
  return { success: true, extracted: extractedCount }
}

async function handleArchiveCommand(workspaceRoot: string, options: SessionManagerExecutorSchema) {
  logger.info('📦 Archiving completed sessions...')
  
  const sessionStoragePath = join(workspaceRoot, '.nx-claude-sessions')
  const activePath = join(sessionStoragePath, 'active')
  const archivesPath = join(sessionStoragePath, 'archives')
  
  // Ensure archives directory exists
  require('fs').mkdirSync(archivesPath, { recursive: true })
  
  if (!existsSync(activePath)) {
    logger.warn('⚠️ No active sessions directory found')
    return { success: true, archived: 0 }
  }

  let archivedCount = 0
  const sessionDirs = readdirSync(activePath)
  const maxAge = parseTimespan(options.maxAge || '24h')
  const cutoffTime = Date.now() - maxAge
  
  for (const sessionDir of sessionDirs) {
    const sessionPath = join(activePath, sessionDir)
    
    try {
      const stats = statSync(sessionPath)
      const isOldEnough = stats.mtime.getTime() < cutoffTime
      const hasCompletionMarker = existsSync(join(sessionPath, 'completed.flag'))
      
      if (!isOldEnough && !hasCompletionMarker) continue
      
      // Move to archives
      const archivePath = join(archivesPath, sessionDir)
      
      // Create archive entry with metadata
      const archiveEntry = {
        sessionId: sessionDir,
        originalPath: sessionPath,
        archivedAt: new Date().toISOString(),
        reason: hasCompletionMarker ? 'completed' : 'aged_out',
        size: getDirectorySize(sessionPath)
      }
      
      // Move directory to archives
      require('fs').renameSync(sessionPath, archivePath)
      
      // Create archive index entry
      const archiveIndexPath = join(archivesPath, 'archive-index.json')
      let archiveIndex: any[] = []
      
      if (existsSync(archiveIndexPath)) {
        archiveIndex = JSON.parse(readFileSync(archiveIndexPath, 'utf-8'))
      }
      
      archiveIndex.push(archiveEntry)
      require('fs').writeFileSync(archiveIndexPath, JSON.stringify(archiveIndex, null, 2))
      
      archivedCount++
      logger.info(`   📦 Archived session: ${sessionDir}`)
      
    } catch (error) {
      logger.warn(`   ⚠️ Failed to archive ${sessionDir}: ${error}`)
    }
  }
  
  logger.info(`📦 Archiving completed: ${archivedCount} sessions archived`)
  return { success: true, archived: archivedCount }
}

async function updateSessionHistory(workspaceRoot: string, learnings: any) {
  try {
    const historyPath = join(workspaceRoot, 'libs', learnings.library, '.claude', 'session-history.json')
    let history: any = { sessions: [], totalSessions: 0 }
    
    if (existsSync(historyPath)) {
      history = JSON.parse(readFileSync(historyPath, 'utf-8'))
    }
    
    history.sessions = history.sessions || []
    history.sessions.push({
      sessionId: learnings.sessionId,
      date: new Date().toISOString(),
      taskType: learnings.taskType,
      outcome: learnings.outcome,
      duration: learnings.duration,
      keyDecisions: learnings.keyDecisions,
      patternsCreated: learnings.patternsCreated,
      lessonsLearned: learnings.lessonsLearned,
      recommendations: learnings.recommendations
    })
    
    history.totalSessions = (history.totalSessions || 0) + 1
    
    // Keep only the last 20 sessions to avoid bloat
    if (history.sessions.length > 20) {
      history.sessions = history.sessions.slice(-20)
    }
    
    require('fs').mkdirSync(require('path').dirname(historyPath), { recursive: true })
    require('fs').writeFileSync(historyPath, JSON.stringify(history, null, 2))
    
  } catch (error) {
    logger.warn(`⚠️ Failed to update session history: ${error}`)
  }
}

function getDirectorySize(dirPath: string): number {
  let totalSize = 0
  
  try {
    const files = readdirSync(dirPath)
    
    for (const file of files) {
      const filePath = join(dirPath, file)
      const stats = statSync(filePath)
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath)
      } else {
        totalSize += stats.size
      }
    }
  } catch {
    // Ignore errors
  }
  
  return totalSize
}

function getLevelEmoji(level: string): string {
  const emojis = {
    INFO: '💡',
    SUCCESS: '✅',
    ERROR: '❌', 
    WARNING: '⚠️',
    PROGRESS: '📊'
  }
  return emojis[level as keyof typeof emojis] || '📝'
}