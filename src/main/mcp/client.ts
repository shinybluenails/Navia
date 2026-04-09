import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import type { OllamaTool } from '../ollama-client'

// ── JSON-RPC 2.0 wire types ───────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: unknown
}

interface RpcResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

// ── MCP tool schema (as returned by tools/list) ───────────────────────────────

export interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, { type: string; description?: string; enum?: string[] }>
    required?: string[]
  }
}

// ── MCP client (one per configured server) ────────────────────────────────────

export class McpClient {
  private proc: ChildProcess | null = null
  private buffer = ''
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private _tools: McpTool[] = []
  public connected = false

  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly command: string,
    private readonly args: string[]
  ) {}

  async connect(): Promise<void> {
    this.proc = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      env: { ...process.env }
    })

    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8')
      this.flushBuffer()
    })

    this.proc.stderr!.on('data', (chunk: Buffer) => {
      console.error(`[mcp:${this.name}]`, chunk.toString('utf8').trim())
    })

    this.proc.on('close', () => {
      this.connected = false
      for (const p of this.pending.values()) {
        p.reject(new Error(`MCP server "${this.name}" disconnected`))
      }
      this.pending.clear()
    })

    // MCP handshake: initialize
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'navia', version: '1.0.0' }
    })

    // Confirm initialization (required by spec before sending further requests)
    this.notify('notifications/initialized')

    // Fetch available tools
    const res = await this.request('tools/list', {}) as { tools?: McpTool[] }
    this._tools = res.tools ?? []
    this.connected = true
  }

  disconnect(): void {
    this.proc?.kill()
    this.proc = null
    this.connected = false
  }

  tools(): McpTool[] {
    return this._tools
  }

  async call(toolName: string, args: Record<string, unknown>): Promise<string> {
    const res = await this.request('tools/call', {
      name: toolName,
      arguments: args
    }) as { content?: Array<{ type: string; text?: string }>; isError?: boolean }

    const text = (res.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')

    return text || JSON.stringify(res)
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private flushBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      let msg: RpcResponse
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      const p = this.pending.get(msg.id)
      if (!p) continue
      this.pending.delete(msg.id)
      if (msg.error) {
        p.reject(new Error(`MCP [${msg.error.code}]: ${msg.error.message}`))
      } else {
        p.resolve(msg.result)
      }
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin) {
        return reject(new Error('MCP process not running'))
      }
      const id = randomUUID()
      this.pending.set(id, { resolve, reject })
      const req: RpcRequest = { jsonrpc: '2.0', id, method, params }
      this.proc.stdin.write(JSON.stringify(req) + '\n')
      setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`MCP timeout: ${method}`))
        }
      }, 30_000)
    })
  }

  private notify(method: string, params?: unknown): void {
    if (!this.proc?.stdin) return
    const notification = { jsonrpc: '2.0', method, ...(params ? { params } : {}) }
    this.proc.stdin.write(JSON.stringify(notification) + '\n')
  }
}

// ── Convert MCP tool schema → Ollama tool format ─────────────────────────────

export function mcpToolToOllama(tool: McpTool): OllamaTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? tool.name,
      parameters: {
        type: 'object',
        properties: (tool.inputSchema.properties ?? {}) as Record<
          string,
          { type: string; description?: string; enum?: string[] }
        >,
        required: tool.inputSchema.required
      }
    }
  }
}
