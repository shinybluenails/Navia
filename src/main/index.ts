import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { startOllama, stopOllama } from './ollama-process'
import { listModels, deleteModel, pullModel, chat } from './ollama-client'

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

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
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
  electronApp.setAppUserModelId('com.homemind.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Start Ollama before showing the window
  startOllama().catch((err) => console.error('[ollama] Failed to start:', err))

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
      for await (const token of chat(model, messages as never, options)) {
        event.sender.send('ollama:chat-token', token)
      }
      event.sender.send('ollama:chat-done')
    }
  )

  ipcMain.on('ping', () => console.log('pong'))

  // IPC: install the downloaded update and relaunch
  ipcMain.on('update:install', () => {
    stopOllama()
    autoUpdater.quitAndInstall()
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
