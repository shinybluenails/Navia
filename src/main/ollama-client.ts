import { OLLAMA_HOST } from './ollama-process'

// Node.js's built-in fetch uses undici internally with a 10-second default
// headers timeout. Override the global dispatcher to remove that limit so
// slow models (especially with tools on CPU) are never aborted mid-wait.
;((): void => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('node:undici') as {
      setGlobalDispatcher: (a: unknown) => void
      Agent: new (o: unknown) => unknown
    }
    undici.setGlobalDispatcher(new undici.Agent({ headersTimeout: 0, bodyTimeout: 0 }))
  } catch {
    // Best-effort — older Node doesn't expose this API
  }
})()

// Short timeout for quick non-streaming requests (list, delete).
// Not used for chat/pull which stream for an unbounded duration.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

export interface OllamaModel {
  name: string
  model: string
  size: number
  digest: string
  details: {
    parameter_size: string
    quantization_level: string
    family: string
  }
  modified_at: string
}

export interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description?: string; enum?: string[] }>
      required?: string[]
    }
  }
}

export interface OllamaToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: OllamaToolCall[]
}

export type ChatEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_calls'; calls: OllamaToolCall[] }

// Models known to support Ollama tool/function calling
const TOOL_CAPABLE_PREFIXES = [
  'llama3.1',
  'qwen2.5', 'qwen3',
  'phi4', 'phi4-mini',
  'mistral',
  'mixtral',
  'command-r',
  'firefunction',
  'nemotron-mini'
]

export function modelSupportsTools(modelName: string): boolean {
  const lower = modelName.toLowerCase()
  return TOOL_CAPABLE_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export interface PullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetchWithTimeout(`${OLLAMA_HOST}/api/tags`, {})
  if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status}`)
  const data = await res.json()
  return data.models ?? []
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetchWithTimeout(`${OLLAMA_HOST}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!res.ok) throw new Error(`Ollama /api/delete failed: ${res.status}`)
}

export async function* pullModel(
  name: string
): AsyncGenerator<PullProgress> {
  const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true })
  })
  if (!res.ok) throw new Error(`Ollama /api/pull failed: ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as PullProgress
    }
  }
}

export async function* chat(
  model: string,
  messages: ChatMessage[],
  options?: {
    temperature?: number
    num_ctx?: number
    num_gpu?: number
    tools?: OllamaTool[]
  }
): AsyncGenerator<ChatEvent> {
  const { tools, ...ollamaOptions } = options ?? {}
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: ollamaOptions,
      ...(tools && tools.length > 0 ? { tools } : {})
    })
  })
  if (!res.ok) throw new Error(`Ollama /api/chat failed: ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const accumulatedCalls: OllamaToolCall[] = []
  let hasToolCalls = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const chunk = JSON.parse(line)
      const msg = chunk.message
      if (!msg) continue
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        hasToolCalls = true
        accumulatedCalls.push(...(msg.tool_calls as OllamaToolCall[]))
      } else if (msg.content) {
        yield { type: 'token', content: msg.content as string }
      }
    }
  }
  if (hasToolCalls) {
    yield { type: 'tool_calls', calls: accumulatedCalls }
  }
}
