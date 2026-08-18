import { app, BrowserWindow, protocol, net, nativeImage, session, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDb } from './db/schema'
import { closeDb } from './db/connection'
import { backfillEmbeddings } from './db/memory'
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
      supportFetchAPI: true,
      standard: true,
      secure: true,
      corsEnabled: true
    }
  }
])

app.whenReady().then(() => {
  initDb()
  backfillEmbeddings().catch(err => console.error('[Startup Backfill Error]:', err))

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true)
  })
  session.defaultSession.setPermissionCheckHandler(() => {
    return true
  })

  protocol.handle('media', async (request) => {
    try {
      let rawPath = ''
      try {
        const parsedUrl = new URL(request.url)
        rawPath = parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : ''
        if (!rawPath && parsedUrl.hostname) {
          rawPath = parsedUrl.hostname
        }
      } catch {
        rawPath = request.url.replace(/^media:\/\/(app\/)?/, '')
      }
      if (rawPath.startsWith('app/')) {
        rawPath = rawPath.substring(4)
      }
      const decodedPath = path.normalize(decodeURIComponent(rawPath))
      
      if (!fs.existsSync(decodedPath)) {
        return new Response('Not Found', { status: 404 })
      }

      const stat = fs.statSync(decodedPath)
      const fileSize = stat.size

      // Determine MIME type
      const ext = path.extname(decodedPath).toLowerCase()
      let contentType = 'application/octet-stream'
      if (ext === '.mp4') contentType = 'video/mp4'
      else if (ext === '.webm') contentType = 'video/webm'
      else if (ext === '.mkv') contentType = 'video/x-matroska'
      else if (ext === '.mov') contentType = 'video/quicktime'
      else if (ext === '.png') contentType = 'image/png'
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
      else if (ext === '.webp') contentType = 'image/webp'
      else if (ext === '.gif') contentType = 'image/gif'
      else if (ext === '.svg') contentType = 'image/svg+xml'

      const rangeHeader = request.headers.get('range')

      if (rangeHeader) {
        // Parse Range: bytes=start-end
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
          const chunkSize = (end - start) + 1

          const nodeStream = fs.createReadStream(decodedPath, { start, end })
          const webStream = new ReadableStream({
            start(controller) {
              nodeStream.on('data', (chunk) => controller.enqueue(chunk))
              nodeStream.on('end', () => controller.close())
              nodeStream.on('error', (err) => controller.error(err))
            },
            cancel() {
              nodeStream.destroy()
            }
          })

          return new Response(webStream, {
            status: 206,
            statusText: 'Partial Content',
            headers: {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }

      // Full content response
      const nodeStream = fs.createReadStream(decodedPath)
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk))
          nodeStream.on('end', () => controller.close())
          nodeStream.on('error', (err) => controller.error(err))
        },
        cancel() {
          nodeStream.destroy()
        }
      })

      return new Response(webStream, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(fileSize),
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (e) {
      console.error('Media protocol error:', e)
      return new Response('Internal Server Error', { status: 500 })
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

    // Standard native application menu to enable full clipboard and keyboard typing support
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      }
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

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
