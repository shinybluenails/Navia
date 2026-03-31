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
  }
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
  window.updater = updaterAPI
}
