import { ipcMain, BrowserWindow, dialog, app, Notification } from 'electron'
import * as sectorsDb from '../db/sectors'
import * as itemsDb from '../db/items'
import * as actionLogDb from '../db/action-log'
import * as effortLogDb from '../db/effort-log'
import * as settingsDb from '../db/settings'
import { exportSnapshot } from '../db/export'
import path from 'path'
import fs from 'fs'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('items:list', (_, filters) => itemsDb.listItems(filters))
  ipcMain.handle('items:create', (_, data) => itemsDb.createItem(data))
  ipcMain.handle('items:update', (_, id, changes) => itemsDb.updateItem(id, changes))
  ipcMain.handle('items:delete', (_, id) => itemsDb.deleteItem(id))
  ipcMain.handle('items:reorder', (_, itemId, newRank) => itemsDb.reorderItem(itemId, newRank))
  ipcMain.handle('items:setUrgent', (_, itemId) => itemsDb.setUrgent(itemId))

  ipcMain.handle('sectors:list', () => sectorsDb.listSectors())
  ipcMain.handle('sectors:create', (_, data) => sectorsDb.createSector(data))
  ipcMain.handle('sectors:update', (_, id, changes) => sectorsDb.updateSector(id, changes))
  ipcMain.handle('sectors:delete', (_, id, moveItemsTo) => sectorsDb.deleteSector(id, moveItemsTo))
  ipcMain.handle('sectors:reorder', (_, ids) => sectorsDb.reorderSectors(ids))

  ipcMain.handle('effortLog:add', (_, itemId, amount, unit, note) => effortLogDb.addEffort(itemId, amount, unit, note))
  ipcMain.handle('effortLog:listForItem', (_, itemId) => effortLogDb.listForItem(itemId))
  ipcMain.handle('effortLog:getTotals', (_, itemId) => effortLogDb.getTotals(itemId))

  ipcMain.handle('actionLog:listForItem', (_, itemId) => actionLogDb.listForItem(itemId))

  ipcMain.handle('settings:get', (_, key) => settingsDb.get(key))
  ipcMain.handle('settings:set', (_, key, value) => settingsDb.set(key, value))

  ipcMain.handle('data:exportSnapshot', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Data Snapshot',
      defaultPath: path.join(app.getPath('downloads'), `lifestack_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })

    if (!canceled && filePath) {
      const data = exportSnapshot()
      fs.writeFileSync(filePath, data, 'utf-8')
      return data
    }
    return null
  })

  ipcMain.handle('notifications:test', (_, sectorId) => {
    const sector = sectorsDb.listSectors().find(s => s.id === sectorId)
    if (sector) {
      const notif = new Notification({
        title: `Test: ${sector.name}`,
        body: 'This is a test notification.'
      })
      notif.show()
    }
  })

  ipcMain.handle('app:setLoginItem', (_, enabled) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true
    })
  })

  ipcMain.handle('app:pickBackground', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Background',
      properties: ['openFile'],
      filters: [
        { name: 'Media', extensions: ['jpg', 'png', 'jpeg', 'webp', 'mp4', 'webm'] }
      ]
    })
    
    if (!canceled && filePaths.length > 0) {
      const sourcePath = filePaths[0]
      const ext = path.extname(sourcePath).toLowerCase()
      const isVideo = ['.mp4', '.webm'].includes(ext)
      
      const backgroundsDir = path.join(app.getPath('userData'), 'backgrounds')
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true })
      }
      
      const destPath = path.join(backgroundsDir, `bg_${Date.now()}${ext}`)
      await fs.promises.copyFile(sourcePath, destPath)
      
      return {
        type: isVideo ? 'video' : 'image',
        value: destPath
      }
    }
    return null
  })
}
