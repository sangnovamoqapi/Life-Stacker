import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  if (tray) return

  // Simple stack icon data URL (SVG to PNG approximation via nativeImage if we had real SVG)
  // For simplicity using a 16x16 transparent image with some shapes could work,
  // but using a generic pixel buffer to create a simple icon:
  const iconSize = 16
  const iconBuffer = Buffer.alloc(iconSize * iconSize * 4, 0)
  // Draw 3 horizontal lines
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      if ((y >= 2 && y <= 4) || (y >= 7 && y <= 9) || (y >= 12 && y <= 14)) {
        if (x >= 2 && x <= 13) {
          const offset = (y * iconSize + x) * 4
          iconBuffer[offset] = 255     // R
          iconBuffer[offset + 1] = 255 // G
          iconBuffer[offset + 2] = 255 // B
          iconBuffer[offset + 3] = 255 // A
        }
      }
    }
  }
  const icon = nativeImage.createFromBuffer(iconBuffer, { width: iconSize, height: iconSize })
  
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
