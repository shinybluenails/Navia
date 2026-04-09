import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { startOllama, stopOllama } from './ollama-process'
import { listModels, deleteModel, pullModel, chat, ChatMessage, OllamaToolCall, modelSupportsTools } from './ollama-client'
import { getTools, hasTool, executeTool } from './tools/registry'
import { McpClient, mcpToolToOllama } from './mcp/client'
import {
  listTodos, createTodo, updateTodo, deleteTodo,
  listMemory, writeMemory, readMemory, deleteMemory,
  listMcpServers, addMcpServer, updateMcpServer, removeMcpServer,
  type Todo, type McpServer
} from './store'

// ── MCP client lifecycle ──────────────────────────────────────────────────────

const mcpClients = new Map<string, McpClient>()

async function connectMcpServer(server: McpServer): Promise<void> {
  try {
    const client = new McpClient(server.id, server.name, server.command, server.args)
    await client.connect()
    mcpClients.set(server.id, client)
    console.log(`[mcp] Connected "${server.name}" — ${client.tools().length} tools`)
  } catch (err) {
    console.error(`[mcp] Failed to connect "${server.name}":`, err)
  }
}

function disconnectMcpServer(id: string): void {
  const client = mcpClients.get(id)
  if (client) {
    client.disconnect()
    mcpClients.delete(id)
  }
}

function mcpServerStatus(server: McpServer) {
  const client = mcpClients.get(server.id)
  return {
    ...server,
    connected: client?.connected ?? false,
    toolCount: client?.tools().length ?? 0
  }
}

async function executeMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  for (const client of mcpClients.values()) {
    if (client.connected && client.tools().some((t) => t.name === name)) {
      return client.call(name, args)
    }
  }
  throw new Error(`Unknown tool: ${name}`)
}

function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Don't check for updates in development
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update:downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message)
  })

  // Check once on startup, then every 4 hours
  autoUpdater.checkForUpdates().catch((err) => console.error('[updater]', err))
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => console.error('[updater]', err))
  }, 4 * 60 * 60 * 1000)
}

function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    ...(process.platform !== 'darwin' ? { icon } : {})
  })

  // Write splash HTML to a temp file so loadFile can serve the base64 image
  // without hitting Chromium's data: URL size limit
  const iconBase64 = readFileSync(icon).toString('base64')
  const tmpPath = join(app.getPath('temp'), 'navia-splash.html')
  writeFileSync(tmpPath, `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 300px; height: 300px;
    display: flex; align-items: center; justify-content: center;
    background: transparent;
    -webkit-app-region: drag;
  }
  img { width: 200px; height: 200px; border-radius: 32px; }
</style></head>
<body><img src="data:image/png;base64,${iconBase64}" /></body>
</html>`)
  splash.loadFile(tmpPath)

  return splash
}

function createWindow(): void {
  const splash = createSplash()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    splash.close()
    try { unlinkSync(join(app.getPath('temp'), 'navia-splash.html')) } catch { /* ignore */ }
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.navia.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Start Ollama before showing the window
  startOllama().catch((err) => console.error('[ollama] Failed to start:', err))

  // Connect enabled MCP servers
  for (const server of listMcpServers().filter((s) => s.enabled)) {
    connectMcpServer(server).catch(console.error)
  }

  // IPC: list installed models
  ipcMain.handle('ollama:list', () => listModels())

  // IPC: delete a model
  ipcMain.handle('ollama:delete', (_event, name: string) => deleteModel(name))

  // IPC: pull (download) a model — streams progress back to the renderer
  ipcMain.handle('ollama:pull', async (event, name: string) => {
    for await (const progress of pullModel(name)) {
      event.sender.send('ollama:pull-progress', progress)
    }
  })

  // IPC: chat — streams tokens back to the renderer
  ipcMain.handle(
    'ollama:chat',
    async (
      event,
      model: string,
      messages: { role: string; content: string }[],
      options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
    ) => {
      for await (const chatEvent of chat(model, messages as never, options)) {
        if (chatEvent.type === 'token') {
          event.sender.send('ollama:chat-token', chatEvent.content)
        }
      }
      event.sender.send('ollama:chat-done')
    }
  )

  // IPC: agent — runs a full multi-turn tool-calling loop
  ipcMain.handle(
    'ollama:agent',
    async (
      event,
      model: string,
      messages: ChatMessage[],
      options?: { temperature?: number; num_ctx?: number; num_gpu?: number }
    ) => {
      // Gather static tools + any active MCP server tools
      const mcpTools = [...mcpClients.values()]
        .filter((c) => c.connected)
        .flatMap((c) => c.tools().map(mcpToolToOllama))
      const tools = modelSupportsTools(model) ? [...getTools(), ...mcpTools] : []
      const MAX_ITERATIONS = 10

      // Inject stored memories and open todos into the system prompt
      const memories = listMemory()
      const openTodos = listTodos().filter((t) => t.status !== 'done')
      const runMessages: ChatMessage[] = messages.map((msg) => {
        if (msg.role !== 'system') return msg
        let extra = ''
        if (memories.length > 0) {
          extra += '\n\n---\nWhat you know about the user:\n' +
            memories.map((e) => `- ${e.key}: ${e.value}`).join('\n')
        }
        if (openTodos.length > 0) {
          extra += '\n\n---\nUser\'s open tasks:\n' +
            openTodos
              .map((t) => `- [${t.id.slice(0, 8)}] (${t.priority}) ${t.title}${t.dueDate ? ` — due ${t.dueDate}` : ''}`)
              .join('\n')
        }
        return extra ? { ...msg, content: msg.content + extra } : msg
      })

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        let toolCallsFromTurn: OllamaToolCall[] | null = null

        for await (const chatEvent of chat(model, runMessages, { ...options, tools })) {
          if (chatEvent.type === 'token') {
            event.sender.send('ollama:agent-token', chatEvent.content)
          } else if (chatEvent.type === 'tool_calls') {
            toolCallsFromTurn = chatEvent.calls
          }
        }

        // No tool calls — model produced a final response; we're done
        if (!toolCallsFromTurn || toolCallsFromTurn.length === 0) {
          return
        }

        // Append the assistant's tool-calling message to history
        runMessages.push({ role: 'assistant', content: '', tool_calls: toolCallsFromTurn })

        // Execute each tool call
        for (const call of toolCallsFromTurn) {
          const toolName = call.function.name
          const toolArgs = call.function.arguments

          event.sender.send('ollama:agent-step', { type: 'tool-call', toolName, args: toolArgs })

          let result: string
          try {
            result = hasTool(toolName)
              ? await executeTool(toolName, toolArgs)
              : await executeMcpTool(toolName, toolArgs)
          } catch (err) {
            result = `Error: ${String(err)}`
          }

          event.sender.send('ollama:agent-step', { type: 'tool-result', toolName, result })

          // Append the tool result to history
          runMessages.push({ role: 'tool', content: result })
        }
      }

      // Reached max iterations
      event.sender.send('ollama:agent-step', {
        type: 'error',
        toolName: '',
        message: 'Maximum tool iterations reached'
      })
    }
  )

  ipcMain.on('ping', () => console.log('pong'))

  // IPC: install the downloaded update and relaunch
  ipcMain.on('update:install', () => {
    stopOllama()
    autoUpdater.quitAndInstall()
  })

  // IPC: todos — broadcast todos:changed after every mutation so the renderer stays in sync
  ipcMain.handle('todo:list', () => listTodos())
  ipcMain.handle('todo:create', async (event, data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => {
    const todo = createTodo(data)
    event.sender.send('todos:changed')
    return todo
  })
  ipcMain.handle('todo:update', async (event, id: string, changes: Partial<Omit<Todo, 'id' | 'createdAt'>>) => {
    const todo = updateTodo(id, changes)
    event.sender.send('todos:changed')
    return todo
  })
  ipcMain.handle('todo:delete', async (event, id: string) => {
    deleteTodo(id)
    event.sender.send('todos:changed')
  })

  // IPC: memory
  ipcMain.handle('memory:list', () => listMemory())
  ipcMain.handle('memory:write', (_e, key: string, value: string, category?: string) => writeMemory(key, value, category))
  ipcMain.handle('memory:read', (_e, key: string) => readMemory(key))
  ipcMain.handle('memory:delete', (_e, key: string) => deleteMemory(key))

  // IPC: MCP server management
  ipcMain.handle('mcp:list', () => listMcpServers().map(mcpServerStatus))

  ipcMain.handle('mcp:add', async (_e, data: Omit<McpServer, 'id'>) => {
    const server = addMcpServer(data)
    if (server.enabled) await connectMcpServer(server)
    return mcpServerStatus(server)
  })

  ipcMain.handle('mcp:remove', (_e, id: string) => {
    disconnectMcpServer(id)
    removeMcpServer(id)
  })

  ipcMain.handle('mcp:toggle', async (_e, id: string, enabled: boolean) => {
    const server = updateMcpServer(id, { enabled })
    if (enabled) {
      await connectMcpServer(server)
    } else {
      disconnectMcpServer(id)
    }
    return mcpServerStatus(server)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Set up auto-updater after window exists so it can send IPC events
  const win = BrowserWindow.getAllWindows()[0]
  if (win) setupAutoUpdater(win)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopOllama()
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
