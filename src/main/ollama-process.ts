import { ChildProcess, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const OLLAMA_PORT = 11434
const OLLAMA_HOST = `http://127.0.0.1:${OLLAMA_PORT}`

let ollamaProcess: ChildProcess | null = null

function getOllamaBinaryPath(): string {
  const platform = process.platform
  const binaryName = platform === 'win32' ? 'ollama.exe' : 'ollama'

  // In production the binary is in resources/ next to the app
  const prodPath = join(process.resourcesPath, platform, binaryName)
  if (existsSync(prodPath)) return prodPath

  // In development fall back to the in-repo resources folder
  const devPath = join(app.getAppPath(), 'resources', platform, binaryName)
  if (existsSync(devPath)) return devPath

  throw new Error(`Ollama binary not found for platform "${platform}". Expected at: ${prodPath}`)
}

async function isOllamaRunning(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

export async function startOllama(): Promise<void> {
  // If something is already listening on the port, kill it first so we own
  // the process and can clean it up on exit.
  if (await isOllamaRunning()) {
    console.log('[ollama] Already running on port', OLLAMA_PORT, '— taking ownership')
    // Try to kill whatever is on the port (best-effort on Windows)
    if (process.platform === 'win32') {
      const { exec } = await import('child_process')
      exec(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${OLLAMA_PORT}') do taskkill /F /PID %a`, () => {})
    }
    // Wait briefly for it to die, then fall through to spawn
    await new Promise((r) => setTimeout(r, 1500))
    if (await isOllamaRunning()) {
      // Still up — reuse it but warn we can't stop it on exit
      console.log('[ollama] Could not take ownership; reusing existing process')
      return
    }
  }

  const binaryPath = getOllamaBinaryPath()
  console.log('[ollama] Starting from', binaryPath)

  ollamaProcess = spawn(binaryPath, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${OLLAMA_PORT}`,
      OLLAMA_ORIGINS: 'app://*,http://localhost:*'
    },
    stdio: 'pipe'
  })

  ollamaProcess.stdout?.on('data', (d) => console.log('[ollama]', d.toString().trim()))
  ollamaProcess.stderr?.on('data', (d) => console.log('[ollama]', d.toString().trim()))

  ollamaProcess.on('error', (err) => console.error('[ollama] Process error:', err))
  ollamaProcess.on('exit', (code) => console.log('[ollama] Exited with code', code))

  // Wait up to 10 seconds for Ollama to be ready
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await isOllamaRunning()) {
      console.log('[ollama] Ready')
      return
    }
  }
  throw new Error('[ollama] Did not become ready within 10 seconds')
}

export function stopOllama(): void {
  if (ollamaProcess && !ollamaProcess.killed) {
    console.log('[ollama] Stopping...')
    ollamaProcess.kill()
    ollamaProcess = null
  }
}

export { OLLAMA_HOST }
