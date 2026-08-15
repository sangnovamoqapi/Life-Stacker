import { app, BrowserWindow, protocol, net, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDb } from './db/schema'
import { closeDb } from './db/connection'
import { registerIpcHandlers } from './ipc/handlers'
import { startScheduler, stopScheduler } from './scheduler'
import { createTray, destroyTray } from './tray'
import { get } from './db/settings'

import { pathToFileURL } from 'url'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

app.name = 'LifeStack'
// Disable GPU shader disk cache lock collisions on Windows dev
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// Set Windows AppUserModelId early for Taskbar grouping
if (process.platform === 'win32') {
  app.setAppUserModelId(app.isPackaged ? 'com.lifestack.app' : process.execPath)
}

if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
    })
  }
}

const userDataDir = path.join(app.getPath('appData'), 'lifestack')
app.setPath('userData', userDataDir)

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true
    }
  }
])

app.whenReady().then(() => {
  initDb()

  protocol.handle('media', (request) => {
    try {
      const filePath = request.url.replace(/^media:\/\/(\/)?/, '')
      const decodedPath = path.normalize(decodeURIComponent(filePath))
      const fileUrl = pathToFileURL(decodedPath).toString()
      return net.fetch(fileUrl)
    } catch (e) {
      console.error('Media protocol error:', e)
      return new Response('Not Found', { status: 404 })
    }
  })

  // Windows prefers .ico, macOS/Linux uses .png
  const iconIcoPath = path.join(__dirname, '../../resources/icon.ico')
  const iconPngPath = path.join(__dirname, '../../resources/icon.png')
  const iconPath = process.platform === 'win32' && fs.existsSync(iconIcoPath) ? iconIcoPath : iconPngPath
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.js')
    }
  })

  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

    registerIpcHandlers(mainWindow)
    startScheduler(mainWindow)
    createTray(mainWindow)

    const launchAtLogin = get<boolean>('launch_at_login') ?? true
    app.setLoginItemSettings({
      openAtLogin: launchAtLogin,
      openAsHidden: true
    })

    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (rendererUrl) {
      mainWindow.loadURL(rendererUrl)
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    mainWindow.on('close', (event) => {
      // Prevent default close, hide to tray instead
      if (!isQuitting) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // In theory shouldn't happen with our logic, but just in case
      } else {
        mainWindow?.show()
      }
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('quit', () => {
    stopScheduler()
    destroyTray()
    closeDb()
  })
