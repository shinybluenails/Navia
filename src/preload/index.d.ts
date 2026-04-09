import { ElectronAPI } from '@electron-toolkit/preload'

export interface OllamaModel {
  name: string
  model: string
  size: number
  digest: string
  details: { parameter_size: string; quantization_level: string; family: string }
  modified_at: string
}

export interface PullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}

export type TodoStatus = 'todo' | 'in-progress' | 'done'
export type TodoPriority = 'low' | 'medium' | 'high'

export interface Todo {
  id: string
  title: string
  description?: string
  status: TodoStatus
  priority: TodoPriority
  dueDate?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface MemoryEntry {
  id: string
  key: string
  value: string
  category?: string
  createdAt: number
  updatedAt: number
}

export interface AgentStep {
  type: 'tool-call' | 'tool-result' | 'error'
  toolName: string
  args?: Record<string, unknown>
  result?: string
  message?: string
}

export interface McpServerStatus {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
  connected: boolean
  toolCount: number
}

export interface OllamaAPI {
  list: () => Promise<OllamaModel[]>
  delete: (name: string) => Promise<void>
  pull: (name: string) => Promise<void>
  chat: (
    model: string,
    messages: ChatMessage[],
    options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
  ) => Promise<void>
  agent: (
    model: string,
    messages: ChatMessage[],
    options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
  ) => Promise<void>
  onPullProgress: (cb: (progress: PullProgress) => void) => () => void
  onChatToken: (cb: (token: string) => void) => () => void
  onChatDone: (cb: () => void) => () => void
  onAgentToken: (cb: (token: string) => void) => () => void
  onAgentStep: (cb: (step: AgentStep) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    ollama: OllamaAPI
    todos: {
      list: () => Promise<Todo[]>
      create: (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Todo>
      update: (id: string, changes: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<Todo>
      delete: (id: string) => Promise<void>
      onChanged: (cb: () => void) => () => void
    }
    memory: {
      list: () => Promise<MemoryEntry[]>
      write: (key: string, value: string, category?: string) => Promise<MemoryEntry>
      read: (key: string) => Promise<MemoryEntry | null>
      delete: (key: string) => Promise<void>
    }
    updater: {
      onUpdateAvailable: (cb: (info: unknown) => void) => () => void
      onUpdateDownloaded: (cb: (info: unknown) => void) => () => void
      install: () => void
    }
    mcp: {
      list: () => Promise<McpServerStatus[]>
      add: (data: { name: string; command: string; args: string[]; enabled: boolean }) => Promise<McpServerStatus>
      remove: (id: string) => Promise<void>
      toggle: (id: string, enabled: boolean) => Promise<McpServerStatus>
    }
  }
}
