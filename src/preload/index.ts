import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const ollamaAPI = {
  list: () => ipcRenderer.invoke('ollama:list'),
  delete: (name: string) => ipcRenderer.invoke('ollama:delete', name),
  pull: (name: string) => ipcRenderer.invoke('ollama:pull', name),
  chat: (
    model: string,
    messages: { role: string; content: string }[],
    options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
  ) => ipcRenderer.invoke('ollama:chat', model, messages, options),
  agent: (
    model: string,
    messages: { role: string; content: string; tool_calls?: unknown[] }[],
    options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
  ) => ipcRenderer.invoke('ollama:agent', model, messages, options),
  onPullProgress: (cb: (progress: unknown) => void) => {
    ipcRenderer.on('ollama:pull-progress', (_e, p) => cb(p))
    return () => ipcRenderer.removeAllListeners('ollama:pull-progress')
  },
  onChatToken: (cb: (token: string) => void) => {
    ipcRenderer.on('ollama:chat-token', (_e, t) => cb(t))
    return () => ipcRenderer.removeAllListeners('ollama:chat-token')
  },
  onChatDone: (cb: () => void) => {
    ipcRenderer.once('ollama:chat-done', () => cb())
    return () => ipcRenderer.removeAllListeners('ollama:chat-done')
  },
  onAgentToken: (cb: (token: string) => void) => {
    ipcRenderer.on('ollama:agent-token', (_e, t) => cb(t))
    return () => ipcRenderer.removeAllListeners('ollama:agent-token')
  },
  onAgentStep: (cb: (step: unknown) => void) => {
    ipcRenderer.on('ollama:agent-step', (_e, step) => cb(step))
    return () => ipcRenderer.removeAllListeners('ollama:agent-step')
  }
}

const todosAPI = {
  list: () => ipcRenderer.invoke('todo:list'),
  create: (data: unknown) => ipcRenderer.invoke('todo:create', data),
  update: (id: string, changes: unknown) => ipcRenderer.invoke('todo:update', id, changes),
  delete: (id: string) => ipcRenderer.invoke('todo:delete', id),
  onChanged: (cb: () => void) => {
    ipcRenderer.on('todos:changed', cb)
    return () => ipcRenderer.removeListener('todos:changed', cb)
  }
}

const memoryAPI = {
  list: () => ipcRenderer.invoke('memory:list'),
  write: (key: string, value: string, category?: string) =>
    ipcRenderer.invoke('memory:write', key, value, category),
  read: (key: string) => ipcRenderer.invoke('memory:read', key),
  delete: (key: string) => ipcRenderer.invoke('memory:delete', key)
}

const mcpAPI = {
  list: () => ipcRenderer.invoke('mcp:list'),
  add: (data: { name: string; command: string; args: string[]; enabled: boolean }) =>
    ipcRenderer.invoke('mcp:add', data),
  remove: (id: string) => ipcRenderer.invoke('mcp:remove', id),
  toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('mcp:toggle', id, enabled)
}

const updaterAPI = {
  onUpdateAvailable: (cb: (info: unknown) => void) => {
    ipcRenderer.on('update:available', (_e, info) => cb(info))
    return () => ipcRenderer.removeAllListeners('update:available')
  },
  onUpdateDownloaded: (cb: (info: unknown) => void) => {
    ipcRenderer.on('update:downloaded', (_e, info) => cb(info))
    return () => ipcRenderer.removeAllListeners('update:downloaded')
  },
  install: () => ipcRenderer.send('update:install')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('ollama', ollamaAPI)
    contextBridge.exposeInMainWorld('todos', todosAPI)
    contextBridge.exposeInMainWorld('memory', memoryAPI)
    contextBridge.exposeInMainWorld('mcp', mcpAPI)
    contextBridge.exposeInMainWorld('updater', updaterAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.ollama = ollamaAPI
  // @ts-ignore (define in dts)
  window.todos = todosAPI
  // @ts-ignore (define in dts)
  window.memory = memoryAPI
  // @ts-ignore (define in dts)
  window.mcp = mcpAPI
  // @ts-ignore (define in dts)
  window.updater = updaterAPI
}
