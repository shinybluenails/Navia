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
  role: 'user' | 'assistant' | 'system'
  content: string
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
  onPullProgress: (cb: (progress: PullProgress) => void) => () => void
  onChatToken: (cb: (token: string) => void) => () => void
  onChatDone: (cb: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    ollama: OllamaAPI
    updater: {
      onUpdateAvailable: (cb: (info: unknown) => void) => () => void
      onUpdateDownloaded: (cb: (info: unknown) => void) => () => void
      install: () => void
    }
  }
}
