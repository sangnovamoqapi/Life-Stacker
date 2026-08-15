import { app, BrowserWindow, protocol, net } from 'electron'
import path from 'path'
import { initDb } from './db/schema'
import { closeDb } from './db/connection'
import { registerIpcHandlers } from './ipc/handlers'
import { startScheduler, stopScheduler } from './scheduler'
import { createTray, destroyTray } from './tray'
import { get } from './db/settings'

import { pathToFileURL } from 'url'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

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

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: path.join(__dirname, '../preload/index.js')
      }
    })

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
}
