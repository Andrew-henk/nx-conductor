import { ExecutorContext, logger, createProjectGraphAsync } from '@nx/devkit'
import { PassthroughExecutorSchema } from './schema'
import { InputValidator } from '../../utils/validation'
import { spawn } from 'child_process'
import { resolve, join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

export default async function runExecutor(
  options: PassthroughExecutorSchema,
  context: ExecutorContext
) {
  // Validate all input options first
  const validation = InputValidator.validateExecutorOptions(options, context.root)
  if (!validation.isValid) {
    const errorMsg = `Invalid options: ${validation.errors.join(', ')}`
    logger.error(errorMsg)
    return { success: false, error: errorMsg }
  }
  
  // Use sanitized options
  const sanitizedOptions = { ...options, ...validation.sanitizedValue }
  logger.info('🔗 Claude Code Passthrough Mode')
  logger.info('===============================')
  
  if (options.dangerouslySkipPermissions) {
    logger.warn('⚠️  DANGEROUS MODE ENABLED!')
    logger.warn('⚠️  All permission checks disabled!')
    logger.warn('')
  }
  
  try {
    const claudePath = sanitizedOptions.customClaudePath || await findClaudeCodeBinary()
    
    if (!claudePath && !sanitizedOptions.dangerouslySkipPermissions) {
      logger.error('❌ Claude Code not found')
      logger.info('💡 Use --customClaudePath to specify location')
      logger.info('💡 Use --dangerouslySkipPermissions to bypass this check')
      return { success: false, error: 'Claude Code binary not found' }
    }
    
    // Validate working directory if provided
    let workingDir = context.root
    if (sanitizedOptions.workingDirectory) {
      const workingDirValidation = InputValidator.validateFilePath(sanitizedOptions.workingDirectory, context.root)
      if (!workingDirValidation.isValid) {
        logger.error(`Invalid working directory: ${workingDirValidation.errors.join(', ')}`)
        return { success: false, error: 'Invalid working directory' }
      }
      workingDir = workingDirValidation.sanitizedValue!
    }
    
    const args = sanitizedOptions.passthroughArgs || []
    
    // Add context if requested
    if (sanitizedOptions.includeContext && sanitizedOptions.library) {
      logger.info(`📚 Loading context for library: ${sanitizedOptions.library}`)
      
      try {
        const projectGraph = await createProjectGraphAsync()
        const LibraryContextLoader = (await import('../../utils/context-loader')).LibraryContextLoader
        const contextLoader = new LibraryContextLoader(context.root, projectGraph)
        const libraryContext = await contextLoader.loadContext(sanitizedOptions.library)
        
        // Write temporary context file with safe path construction (library already validated)
        const sanitizedLibrary = sanitizedOptions.library!.replace(/[^a-zA-Z0-9-_]/g, '_')
        const contextFile = join(context.root, '.nx-claude-sessions', 'temp', `${sanitizedLibrary}-context.md`)
        
        // Validate the resulting path to prevent directory traversal
        const pathValidation = InputValidator.validateFilePath(contextFile, context.root)
        if (!pathValidation.isValid) {
          throw new Error(`Invalid context file path: ${pathValidation.errors.join(', ')}`)
        }
        
        mkdirSync(require('path').dirname(contextFile), { recursive: true })
        writeFileSync(contextFile, `# ${sanitizedOptions.library} Context\n\n${libraryContext.primary.content}`)
        
        args.unshift('--context-file', contextFile)
        logger.info(`📄 Context file: ${contextFile}`)
      } catch (error) {
        logger.warn(`⚠️  Could not load library context: ${error}`)
        if (!sanitizedOptions.dangerouslySkipPermissions) {
          return { success: false, error: 'Failed to load library context' }
        }
      }
    }
    
    logger.info('🚀 Executing Claude Code...')
    logger.info(`   Binary: ${claudePath || 'claude-code'}`)
    logger.info(`   Working Directory: ${workingDir}`)
    logger.info(`   Arguments: ${args.join(' ')}`)
    logger.info('')
    
    return await executeClaudeCode(claudePath || 'claude-code', args, workingDir, sanitizedOptions)
    
  } catch (error) {
    logger.error(`❌ Passthrough execution failed: ${error}`)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

async function findClaudeCodeBinary(): Promise<string | null> {
  const { join } = require('path')
  const possiblePaths = [
    'claude-code',
    '/usr/local/bin/claude-code',
    join(process.env['HOME'] || '', '.local/bin/claude-code'),
    join(process.env['HOME'] || '', 'bin/claude-code'),
  ]

  for (const path of possiblePaths) {
    try {
      const { spawn } = require('child_process')
      const testProcess = spawn(path, ['--version'], { 
        stdio: 'ignore',
        timeout: 1000
      })
      
      const exitCode = await new Promise((resolve) => {
        testProcess.on('exit', resolve)
        testProcess.on('error', () => resolve(null))
      })

      if (exitCode === 0) {
        return path
      }
    } catch {
      continue
    }
  }

  return null
}

async function executeClaudeCode(
  claudePath: string, 
  args: string[], 
  workingDir: string, 
  options: PassthroughExecutorSchema
): Promise<{ success: boolean; exitCode?: number; duration?: number }> {
  
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    const claudeProcess = spawn(claudePath, args, {
      cwd: workingDir,
      stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NX_CLAUDE_PASSTHROUGH: 'true',
        NX_CLAUDE_DANGEROUS_MODE: options.dangerouslySkipPermissions ? 'true' : 'false'
      }
    })
    
    if (!options.interactive) {
      claudeProcess.stdout?.on('data', (data) => {
        process.stdout.write(data)
      })
      
      claudeProcess.stderr?.on('data', (data) => {
        process.stderr.write(data)
      })
    }
    
    claudeProcess.on('exit', (code) => {
      const duration = Date.now() - startTime
      
      if (code === 0) {
        logger.info(`✅ Claude Code completed successfully (${Math.round(duration / 1000)}s)`)
      } else {
        logger.error(`❌ Claude Code exited with code ${code} (${Math.round(duration / 1000)}s)`)
      }
      
      resolve({
        success: code === 0,
        exitCode: code || 0,
        duration
      })
    })
    
    claudeProcess.on('error', (error) => {
      logger.error(`❌ Claude Code process error: ${error.message}`)
      resolve({
        success: false,
        exitCode: 1,
        duration: Date.now() - startTime
      })
    })
    
    // Handle timeout
    if (options.timeout) {
      const timeoutMs = parseTimeout(options.timeout)
      setTimeout(() => {
        if (!claudeProcess.killed) {
          logger.warn('⏰ Timeout reached, terminating Claude Code process...')
          claudeProcess.kill('SIGTERM')
          
          setTimeout(() => {
            if (!claudeProcess.killed) {
              claudeProcess.kill('SIGKILL')
            }
          }, 5000)
        }
      }, timeoutMs)
    }
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      logger.info('🛑 Terminating Claude Code process...')
      claudeProcess.kill('SIGTERM')
    })
  })
}

function parseTimeout(timeoutStr: string): number {
  const match = timeoutStr.match(/^(\\d+)([smhd])$/)
  if (!match) return 10 * 60 * 1000 // Default 10 minutes

  const [, value, unit] = match
  const num = parseInt(value, 10)
  
  switch (unit) {
    case 's': return num * 1000
    case 'm': return num * 60 * 1000
    case 'h': return num * 60 * 60 * 1000
    case 'd': return num * 24 * 60 * 60 * 1000
    default: return 10 * 60 * 1000
  }
}