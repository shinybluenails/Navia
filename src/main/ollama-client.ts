import { OLLAMA_HOST } from './ollama-process'

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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface PullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/tags`)
  if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status}`)
  const data = await res.json()
  return data.models ?? []
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${OLLAMA_HOST}/api/delete`, {
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
  options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, options })
  })
  if (!res.ok) throw new Error(`Ollama /api/chat failed: ${res.status}`)
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
      if (!line.trim()) continue
      const chunk = JSON.parse(line)
      if (chunk.message?.content) yield chunk.message.content as string
    }
  }
}
