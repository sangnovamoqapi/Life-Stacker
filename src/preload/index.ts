import { contextBridge, ipcRenderer } from 'electron'
import type { LifeStackAPI, ItemFilters, NewItem, NewSector, EffortUnit, NewEdge, NewExploreItem, NewNextItem, NextItemStatus } from './types'

const api: LifeStackAPI = {
  items: {
    list: (filters?: ItemFilters) => ipcRenderer.invoke('items:list', filters),
    create: (data: NewItem) => ipcRenderer.invoke('items:create', data),
    update: (id: string, changes: any) => ipcRenderer.invoke('items:update', id, changes),
    delete: (id: string) => ipcRenderer.invoke('items:delete', id),
    reorder: (itemId: string, newRank: number) => ipcRenderer.invoke('items:reorder', itemId, newRank),
    setUrgent: (itemId: string) => ipcRenderer.invoke('items:setUrgent', itemId)
  },
  exploreItems: {
    list: (epicId?: string) => ipcRenderer.invoke('exploreItems:list', epicId),
    create: (data: NewExploreItem) => ipcRenderer.invoke('exploreItems:create', data),
    update: (id: string, changes: any) => ipcRenderer.invoke('exploreItems:update', id, changes),
    toggleClosed: (id: string) => ipcRenderer.invoke('exploreItems:toggleClosed', id),
    delete: (id: string) => ipcRenderer.invoke('exploreItems:delete', id)
  },
  nextItems: {
    list: (filters?: { epic_id?: string; status?: NextItemStatus; parent_explore_id?: string }) => ipcRenderer.invoke('nextItems:list', filters),
    create: (data: NewNextItem) => ipcRenderer.invoke('nextItems:create', data),
    createBatch: (items: NewNextItem[]) => ipcRenderer.invoke('nextItems:createBatch', items),
    update: (id: string, changes: any) => ipcRenderer.invoke('nextItems:update', id, changes),
    toggle: (id: string) => ipcRenderer.invoke('nextItems:toggle', id),
    promoteToToday: (id: string) => ipcRenderer.invoke('nextItems:promoteToToday', id),
    delete: (id: string) => ipcRenderer.invoke('nextItems:delete', id),
    reorder: (epicId: string, itemIds: string[]) => ipcRenderer.invoke('nextItems:reorder', epicId, itemIds),
    reorderToday: (itemIds: string[]) => ipcRenderer.invoke('nextItems:reorderToday', itemIds)
  },
  actionSteps: {
    list: (itemId: string) => ipcRenderer.invoke('actionSteps:list', itemId),
    listAll: () => ipcRenderer.invoke('actionSteps:listAll'),
    create: (itemId: string, content: string, options?: any) => ipcRenderer.invoke('actionSteps:create', itemId, content, options),
    update: (id: string, changes: any) => ipcRenderer.invoke('actionSteps:update', id, changes),
    toggle: (id: string) => ipcRenderer.invoke('actionSteps:toggle', id),
    delete: (id: string) => ipcRenderer.invoke('actionSteps:delete', id),
    reorder: (itemId: string, stepIds: string[]) => ipcRenderer.invoke('actionSteps:reorder', itemId, stepIds)
  },
  sectors: {
    list: () => ipcRenderer.invoke('sectors:list'),
    create: (data: NewSector) => ipcRenderer.invoke('sectors:create', data),
    update: (id: string, changes: any) => ipcRenderer.invoke('sectors:update', id, changes),
    delete: (id: string, moveItemsTo?: string) => ipcRenderer.invoke('sectors:delete', id, moveItemsTo),
    reorder: (ids: string[]) => ipcRenderer.invoke('sectors:reorder', ids)
  },
  edges: {
    create: (data: NewEdge) => ipcRenderer.invoke('edges:create', data),
    list: (itemId: string) => ipcRenderer.invoke('edges:list', itemId),
    delete: (edgeId: string) => ipcRenderer.invoke('edges:delete', edgeId),
    retype: (edgeId: string, newRelationType: string) => ipcRenderer.invoke('edges:retype', edgeId, newRelationType)
  },
  memory: {
    search: (queryText: string, topK?: number) => ipcRenderer.invoke('memory:search', queryText, topK),
    reindexAll: () => ipcRenderer.invoke('memory:reindexAll')
  },
  ai: {
    checkStatus: () => ipcRenderer.invoke('ai:checkStatus'),
    getLastError: () => ipcRenderer.invoke('ai:getLastError'),
    generateNextFromExplore: (title: string, notes: string) => ipcRenderer.invoke('ai:generateNextFromExplore', title, notes)
  },
  chat: {
    send: (message: string) => ipcRenderer.invoke('chat:send', message),
    listMessages: () => ipcRenderer.invoke('chat:listMessages'),
    listPendingActions: () => ipcRenderer.invoke('chat:listPendingActions'),
    acceptAction: (actionId: string, overrides?: Record<string, any>) => ipcRenderer.invoke('chat:acceptAction', actionId, overrides),
    rejectAction: (actionId: string) => ipcRenderer.invoke('chat:rejectAction', actionId),
    clearHistory: () => ipcRenderer.invoke('chat:clearHistory')
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
  debug: {
    runQuery: (sql: string) => ipcRenderer.invoke('debug:runQuery', sql)
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('api', api)
