import { contextBridge, ipcRenderer } from 'electron'
import type { LifeStackAPI, ItemFilters, NewItem, NewSector, EffortUnit } from './types'

const api: LifeStackAPI = {
  items: {
    list: (filters?: ItemFilters) => ipcRenderer.invoke('items:list', filters),
    create: (data: NewItem) => ipcRenderer.invoke('items:create', data),
    update: (id: string, changes: any) => ipcRenderer.invoke('items:update', id, changes),
    delete: (id: string) => ipcRenderer.invoke('items:delete', id),
    reorder: (itemId: string, newRank: number) => ipcRenderer.invoke('items:reorder', itemId, newRank),
    setUrgent: (itemId: string) => ipcRenderer.invoke('items:setUrgent', itemId)
  },
  sectors: {
    list: () => ipcRenderer.invoke('sectors:list'),
    create: (data: NewSector) => ipcRenderer.invoke('sectors:create', data),
    update: (id: string, changes: any) => ipcRenderer.invoke('sectors:update', id, changes),
    delete: (id: string, moveItemsTo?: string) => ipcRenderer.invoke('sectors:delete', id, moveItemsTo),
    reorder: (ids: string[]) => ipcRenderer.invoke('sectors:reorder', ids)
  },
  effortLog: {
    add: (itemId: string, amount: number, unit: EffortUnit, note?: string) => ipcRenderer.invoke('effortLog:add', itemId, amount, unit, note),
    listForItem: (itemId: string) => ipcRenderer.invoke('effortLog:listForItem', itemId),
    getTotals: (itemId?: string) => ipcRenderer.invoke('effortLog:getTotals', itemId)
  },
  actionLog: {
    listForItem: (itemId: string) => ipcRenderer.invoke('actionLog:listForItem', itemId)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value)
  },
  data: {
    exportSnapshot: () => ipcRenderer.invoke('data:exportSnapshot')
  },
  notifications: {
    test: (sectorId: string) => ipcRenderer.invoke('notifications:test', sectorId)
  },
  app: {
    setLoginItem: (enabled: boolean) => ipcRenderer.invoke('app:setLoginItem', enabled),
    pickBackground: () => ipcRenderer.invoke('app:pickBackground')
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('api', api)
