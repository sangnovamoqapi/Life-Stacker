import { ipcMain, BrowserWindow, dialog, app, Notification } from 'electron'
import * as sectorsDb from '../db/sectors'
import * as itemsDb from '../db/items'
import * as exploreItemsDb from '../db/explore-items'
import * as nextItemsDb from '../db/next-items'
import * as actionLogDb from '../db/action-log'
import * as effortLogDb from '../db/effort-log'
import * as settingsDb from '../db/settings'
import * as edgesDb from '../db/edges'
import * as memoryDb from '../db/memory'
import * as ollamaClient from '../ai/ollama-client'
import * as chatEngine from '../ai/chat'
import { getDb } from '../db/connection'
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

  // Explore Items IPC
  ipcMain.handle('exploreItems:list', (_, epicId) => exploreItemsDb.listExploreItems(epicId))
  ipcMain.handle('exploreItems:create', (_, data) => exploreItemsDb.createExploreItem(data))
  ipcMain.handle('exploreItems:update', (_, id, changes) => exploreItemsDb.updateExploreItem(id, changes))
  ipcMain.handle('exploreItems:toggleClosed', (_, id) => exploreItemsDb.toggleExploreItemClosed(id))
  ipcMain.handle('exploreItems:delete', (_, id) => exploreItemsDb.deleteExploreItem(id))

  // Next Items IPC
  ipcMain.handle('nextItems:list', (_, filters) => nextItemsDb.listNextItems(filters))
  ipcMain.handle('nextItems:create', (_, data) => nextItemsDb.createNextItem(data))
  ipcMain.handle('nextItems:update', (_, id, changes) => nextItemsDb.updateNextItem(id, changes))
  ipcMain.handle('nextItems:toggle', (_, id) => nextItemsDb.toggleNextItem(id))
  ipcMain.handle('nextItems:promoteToToday', (_, id) => nextItemsDb.promoteToToday(id))
  ipcMain.handle('nextItems:delete', (_, id) => nextItemsDb.deleteNextItem(id))
  ipcMain.handle('nextItems:reorder', (_, epicId, itemIds) => nextItemsDb.reorderNextItems(epicId, itemIds))

  // Backward-compatible Action Steps IPC (delegates to next_items)
  ipcMain.handle('actionSteps:list', (_, itemId) => nextItemsDb.listNextItems({ epic_id: itemId }))
  ipcMain.handle('actionSteps:listAll', () => nextItemsDb.listNextItems())
  ipcMain.handle('actionSteps:create', (_, itemId, content, options) => {
    return nextItemsDb.createNextItem({
      epic_id: itemId,
      title: content,
      time_estimate_value: options?.effort_value,
      time_estimate_unit: options?.effort_unit
    })
  })
  ipcMain.handle('actionSteps:update', (_, id, changes) => {
    return nextItemsDb.updateNextItem(id, {
      title: changes.content,
      status: changes.is_done !== undefined ? (changes.is_done ? 'done' : 'next') : undefined,
      sort_order: changes.sort_order,
      time_estimate_value: changes.effort_value,
      time_estimate_unit: changes.effort_unit,
      actual_effort_value: changes.actual_effort_value,
      actual_effort_unit: changes.actual_effort_unit
    })
  })
  ipcMain.handle('actionSteps:toggle', (_, id) => nextItemsDb.toggleNextItem(id))
  ipcMain.handle('actionSteps:delete', (_, id) => nextItemsDb.deleteNextItem(id))
  ipcMain.handle('actionSteps:reorder', (_, itemId, stepIds) => nextItemsDb.reorderNextItems(itemId, stepIds))

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

  // Graph Edges IPC
  ipcMain.handle('edges:create', (_, data) => edgesDb.createEdge(data))
  ipcMain.handle('edges:list', (_, itemId) => edgesDb.listEdgesForItem(itemId))
  ipcMain.handle('edges:delete', (_, edgeId) => edgesDb.deleteEdge(edgeId))
  ipcMain.handle('edges:retype', (_, edgeId, newRelationType) => edgesDb.retypeEdge(edgeId, newRelationType))

  // Vector Memory & AI status IPC
  ipcMain.handle('memory:search', (_, queryText, topK) => memoryDb.search(queryText, topK))
  ipcMain.handle('memory:reindexAll', () => memoryDb.reindexAllVectorMemory())
  ipcMain.handle('ai:checkStatus', () => ollamaClient.checkStatus())
  ipcMain.handle('ai:getLastError', () => ollamaClient.getLastError())

  // Conversational AI & Pending Actions IPC
  ipcMain.handle('chat:send', (_, message: string) => chatEngine.sendMessage(message))
  ipcMain.handle('chat:listMessages', () => chatEngine.listMessages())
  ipcMain.handle('chat:listPendingActions', () => chatEngine.listPendingActions())
  ipcMain.handle('chat:acceptAction', (_, actionId: string, overrides?: Record<string, any>) => chatEngine.acceptAction(actionId, overrides))
  ipcMain.handle('chat:rejectAction', (_, actionId: string) => chatEngine.rejectAction(actionId))
  ipcMain.handle('chat:clearHistory', () => chatEngine.clearHistory())

  // Dev-only debug query channel
  ipcMain.handle('debug:runQuery', (_, sql: string) => {
    if (app.isPackaged) return []
    const db = getDb()
    try {
      const stmt = db.prepare(sql)
      if (stmt.reader) {
        return stmt.all()
      } else {
        const info = stmt.run()
        return [info]
      }
    } catch (err: any) {
      console.error('[Debug Query Error]:', err)
      return [{ error: err?.message || String(err) }]
    }
  })

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
