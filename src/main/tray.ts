import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  if (tray) return

  const iconPath = path.join(__dirname, '../../resources/icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty()
  
  tray = new Tray(icon)
  tray.setToolTip('Life Stack')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Life Stack',
      click: () => {
        mainWindow.show()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow.show()
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
