import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { 
  Sector, 
  Item, 
  AppSettings, 
  ViewMode, 
  ModalType, 
  EffortPromptState, 
  ChecklistEffortPromptState,
  ChecklistItem,
  ActionStep,
  ExploreItem,
  NewExploreItem,
  NextItem,
  NewNextItem,
  NextItemStatus,
  ToastMessage,
  NewItem,
  NewSector
} from '../types'
import { parseChecklist, formatChecklist } from '../utils/checklist'

export interface EpicStageInfo {
  hasOpenExplore: boolean
  hasOpenNext: boolean
  label: string
}

interface AppContextType {
  sectors: Sector[]
  items: Item[]
  settings: AppSettings
  searchTerm: string
  viewMode: ViewMode
  selectedItemId: string | null
  selectedSectorId: string | null
  modalType: ModalType
  effortPrompt: EffortPromptState | null
  checklistEffortPrompt: ChecklistEffortPromptState | null
  toasts: ToastMessage[]
  exploreItems: Record<string, ExploreItem[]>
  nextItems: Record<string, NextItem[]>
  actionSteps: Record<string, ActionStep[]> // legacy alias

  refreshAll: () => Promise<void>
  createItem: (data: NewItem) => Promise<Item>
  updateItem: (id: string, changes: Partial<Omit<Item, 'id' | 'created_at'>>) => Promise<Item>
  deleteItem: (id: string) => Promise<void>
  createSector: (data: NewSector) => Promise<Sector>
  updateSector: (id: string, changes: Partial<Omit<Sector, 'id'>>) => Promise<Sector>
  deleteSector: (id: string, moveItemsTo?: string) => Promise<void>
  reorderSectors: (ids: string[]) => Promise<void>
  reorderItem: (itemId: string, newRank: number) => Promise<void>
  setUrgent: (itemId: string) => Promise<void>
  addEffort: (itemId: string, amount: number, unit: 'hours'|'days', note?: string) => Promise<void>
  updateSettings: (key: keyof AppSettings, value: unknown) => Promise<void>
  toggleChecklistItem: (itemId: string, checklistItemId: string, completed?: boolean) => Promise<void>
  
  // Explore items API
  getExploreItems: (epicId: string) => ExploreItem[]
  addExploreItem: (data: NewExploreItem) => Promise<ExploreItem>
  updateExploreItem: (id: string, changes: Partial<Omit<ExploreItem, 'id' | 'epic_id' | 'created_at'>>) => Promise<ExploreItem>
  toggleExploreItemClosed: (id: string) => Promise<ExploreItem>
  deleteExploreItem: (id: string) => Promise<void>

  // Next items API
  getNextItems: (epicId: string) => NextItem[]
  addNextItem: (data: NewNextItem) => Promise<NextItem>
  updateNextItem: (id: string, changes: Partial<Omit<NextItem, 'id' | 'epic_id' | 'created_at'>>) => Promise<NextItem>
  toggleNextItem: (id: string) => Promise<NextItem>
  promoteToToday: (id: string) => Promise<NextItem>
  demoteFromToday: (id: string) => Promise<NextItem>
  deleteNextItem: (id: string) => Promise<void>
  reorderNextItems: (epicId: string, itemIds: string[]) => Promise<void>

  // Computed Stage & Dual Progress
  getResearchProgress: (epicId: string) => number
  getExecutionProgress: (epicId: string) => number
  getEpicStage: (epicId: string) => EpicStageInfo

  // Legacy Action Steps API (for backward compatibility)
  getActionSteps: (itemId: string) => ActionStep[]
  addActionStep: (itemId: string, content: string, options?: { effort_value?: number; effort_unit?: string }) => Promise<ActionStep>
  toggleActionStep: (stepId: string) => Promise<ActionStep>
  deleteActionStep: (stepId: string) => Promise<void>
  updateActionStep: (stepId: string, changes: Partial<{ content: string; is_done: boolean; sort_order: number }>) => Promise<ActionStep>
  reorderActionSteps: (itemId: string, stepIds: string[]) => Promise<void>
  
  setSearchTerm: (term: string) => void
  setViewMode: (mode: ViewMode) => void
  openItemModal: (id: string) => void
  openNewItemModal: (sectorId?: string) => void
  openSectorModal: (id: string | null) => void
  closeModal: () => void
  showToast: (text: string, type?: 'success' | 'info' | 'warning') => void
  dismissToast: (id: string) => void
  setEffortPrompt: (state: EffortPromptState | null) => void
  setChecklistEffortPrompt: (state: ChecklistEffortPromptState | null) => void

  getItemById: (id: string) => Item | undefined
  getSectorById: (id: string) => Sector | undefined
  getItemsForSector: (sectorId: string) => Item[]
}

const defaultSettings: AppSettings = {
  active_epic_cap: 5,
  focus_limit: 5,
  today_cap: 3,
  weekly_personal_hours: null,
  burn_tracking_enabled: true,
  stale_threshold_days: 14,
  launch_at_login: true,
  glass_intensity: 65,
  stack_review_enabled: true,
  stack_review_day: 0,
  stack_review_time: '18:00',
  background_config: { type: 'gradient', value: 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' }
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null)
  const [modalType, setModalType] = useState<ModalType>(null)
  const [effortPrompt, setEffortPrompt] = useState<EffortPromptState | null>(null)
  const [checklistEffortPrompt, setChecklistEffortPrompt] = useState<ChecklistEffortPromptState | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [exploreItems, setExploreItems] = useState<Record<string, ExploreItem[]>>({})
  const [nextItems, setNextItems] = useState<Record<string, NextItem[]>>({})

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const refreshAll = useCallback(async () => {
    try {
      const [fetchedSectors, fetchedItems, fetchedNext, fetchedExplore] = await Promise.all([
        window.api.sectors.list(),
        window.api.items.list(),
        window.api.nextItems ? window.api.nextItems.list() : window.api.actionSteps.listAll(),
        window.api.exploreItems ? window.api.exploreItems.list() : Promise.resolve([])
      ])
      setSectors(fetchedSectors)
      setItems(fetchedItems)

      // Map Next Items by epic_id
      const nextMap: Record<string, NextItem[]> = {}
      fetchedNext.forEach(n => {
        const epicId = n.epic_id || (n as any).item_id
        if (!nextMap[epicId]) nextMap[epicId] = []
        nextMap[epicId].push(n)
      })
      Object.keys(nextMap).forEach(k => {
        nextMap[k].sort((a, b) => a.sort_order - b.sort_order)
      })
      setNextItems(nextMap)

      // Map Explore Items by epic_id
      const exploreMap: Record<string, ExploreItem[]> = {}
      fetchedExplore.forEach(e => {
        if (!exploreMap[e.epic_id]) exploreMap[e.epic_id] = []
        exploreMap[e.epic_id].push(e)
      })
      Object.keys(exploreMap).forEach(k => {
        exploreMap[k].sort((a, b) => new Date(a.last_touched_at).getTime() - new Date(b.last_touched_at).getTime())
      })
      setExploreItems(exploreMap)

      // Settings
      const active_epic_cap = (await window.api.settings.get<number>('active_epic_cap')) ?? (await window.api.settings.get<number>('focus_limit')) ?? 5
      const today_cap = (await window.api.settings.get<number>('today_cap')) ?? 3
      const weekly_personal_hours = await window.api.settings.get<number | null>('weekly_personal_hours')
      const burn_tracking_enabled = (await window.api.settings.get<boolean>('burn_tracking_enabled')) ?? true
      const stale_threshold_days = (await window.api.settings.get<number>('stale_threshold_days')) ?? 14
      const launch_at_login = (await window.api.settings.get<boolean>('launch_at_login')) ?? true
      const glass_intensity = (await window.api.settings.get<number>('glass_intensity')) ?? 65
      const stack_review_enabled = (await window.api.settings.get<boolean>('stack_review_enabled')) ?? true
      const stack_review_day = (await window.api.settings.get<number>('stack_review_day')) ?? 0
      const stack_review_time = (await window.api.settings.get<string>('stack_review_time')) ?? '18:00'
      const background_config = (await window.api.settings.get<{type: 'color'|'gradient'|'image'|'video', value: string}>('background_config')) ?? { type: 'gradient', value: 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' }
      
      setSettings({
        active_epic_cap,
        focus_limit: active_epic_cap, // keep focus_limit synchronized
        today_cap,
        weekly_personal_hours,
        burn_tracking_enabled,
        stale_threshold_days,
        launch_at_login,
        glass_intensity,
        stack_review_enabled,
        stack_review_day,
        stack_review_time,
        background_config
      })
    } catch (err) {
      console.error(err)
      showToast('Failed to load data', 'warning')
    }
  }, [showToast])

  useEffect(() => {
    refreshAll()

    const cleanup = window.api.on('navigate-to-sector', (sectorId) => {
      if (typeof sectorId === 'string') {
        setViewMode('lanes')
        setSearchTerm('')
      }
    })
    return cleanup
  }, [refreshAll])

  const createItem = async (data: NewItem) => {
    const newItem = await window.api.items.create(data)
    setItems(prev => [...prev, newItem])
    return newItem
  }

  const updateItem = async (id: string, changes: Partial<Omit<Item, 'id' | 'created_at'>>) => {
    try {
      const updated = await window.api.items.update(id, changes)
      setItems(prev => prev.map(item => item.id === id ? updated : item))
      return updated
    } catch (err: any) {
      showToast(err?.message || 'Failed to update item', 'warning')
      throw err
    }
  }

  const deleteItem = async (id: string) => {
    await window.api.items.delete(id)
    setItems(prev => prev.filter(item => item.id !== id))
    setNextItems(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    setExploreItems(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const createSector = async (data: NewSector) => {
    const newSector = await window.api.sectors.create(data)
    setSectors(prev => [...prev, newSector])
    return newSector
  }

  const updateSector = async (id: string, changes: Partial<Omit<Sector, 'id'>>) => {
    const updated = await window.api.sectors.update(id, changes)
    setSectors(prev => prev.map(sec => sec.id === id ? updated : sec))
    return updated
  }

  const deleteSector = async (id: string, moveItemsTo?: string) => {
    await window.api.sectors.delete(id, moveItemsTo)
    await refreshAll()
  }

  const reorderSectors = async (ids: string[]) => {
    await window.api.sectors.reorder(ids)
    setSectors(prev => {
      const map = new Map(prev.map(s => [s.id, s]))
      return ids.map(id => map.get(id)!).filter(Boolean)
    })
  }

  const reorderItem = async (itemId: string, newRank: number) => {
    await window.api.items.reorder(itemId, newRank)
    await refreshAll()
  }

  const setUrgent = async (itemId: string) => {
    await window.api.items.setUrgent(itemId)
    await refreshAll()
  }

  const addEffort = async (itemId: string, amount: number, unit: 'hours'|'days', note?: string) => {
    await window.api.effortLog.add(itemId, amount, unit, note)
    showToast('Effort logged', 'success')
  }

  const updateSettings = async (key: keyof AppSettings, value: unknown) => {
    await window.api.settings.set(key as string, value)
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'active_epic_cap') next.focus_limit = Number(value)
      if (key === 'focus_limit') next.active_epic_cap = Number(value)
      return next
    })
  }

  const toggleChecklistItem = async (itemId: string, checklistItemId: string, completedOverride?: boolean) => {
    const item = getItemById(itemId)
    if (!item) return
    const list = parseChecklist(item.next_action)
    const target = list.find(c => c.id === checklistItemId)
    if (!target) return

    const newCompleted = completedOverride !== undefined ? completedOverride : !target.completed
    target.completed = newCompleted

    const updatedNextAction = formatChecklist(list)
    await updateItem(itemId, { next_action: updatedNextAction })

    if (newCompleted) {
      setChecklistEffortPrompt({ itemId, checklistItem: { ...target } })
    }
  }

  // ─── Explore Items API ───
  const getExploreItems = useCallback((epicId: string) => {
    return exploreItems[epicId] || []
  }, [exploreItems])

  const addExploreItem = async (data: NewExploreItem) => {
    const item = await window.api.exploreItems.create(data)
    setExploreItems(prev => {
      const list = prev[data.epic_id] ? [...prev[data.epic_id], item] : [item]
      return { ...prev, [data.epic_id]: list }
    })
    return item
  }

  const updateExploreItem = async (id: string, changes: Partial<Omit<ExploreItem, 'id' | 'epic_id' | 'created_at'>>) => {
    const updated = await window.api.exploreItems.update(id, changes)
    setExploreItems(prev => {
      const epicId = updated.epic_id
      const currentList = prev[epicId] || []
      const newList = currentList.map(e => e.id === id ? updated : e)
      return { ...prev, [epicId]: newList }
    })
    return updated
  }

  const toggleExploreItemClosed = async (id: string) => {
    const updated = await window.api.exploreItems.toggleClosed(id)
    setExploreItems(prev => {
      const epicId = updated.epic_id
      const currentList = prev[epicId] || []
      const newList = currentList.map(e => e.id === id ? updated : e)
      return { ...prev, [epicId]: newList }
    })
    return updated
  }

  const deleteExploreItem = async (id: string) => {
    try {
      await window.api.exploreItems.delete(id)
      setExploreItems(prev => {
        const nextMap = { ...prev }
        for (const k in nextMap) {
          nextMap[k] = nextMap[k].filter(e => e.id !== id)
        }
        return nextMap
      })
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete Explore item', 'warning')
      throw err
    }
  }

  // ─── Next Items API ───
  const getNextItems = useCallback((epicId: string) => {
    return nextItems[epicId] || []
  }, [nextItems])

  const addNextItem = async (data: NewNextItem) => {
    const item = await window.api.nextItems.create(data)
    setNextItems(prev => {
      const list = prev[data.epic_id] ? [...prev[data.epic_id], item] : [item]
      return { ...prev, [data.epic_id]: list }
    })
    return item
  }

  const updateNextItem = async (id: string, changes: Partial<Omit<NextItem, 'id' | 'epic_id' | 'created_at'>>) => {
    const updated = await window.api.nextItems.update(id, changes)
    setNextItems(prev => {
      const epicId = updated.epic_id
      const currentList = prev[epicId] || []
      const newList = currentList.map(n => n.id === id ? updated : n)
      return { ...prev, [epicId]: newList }
    })
    return updated
  }

  const toggleNextItem = async (id: string) => {
    const updated = await window.api.nextItems.toggle(id)
    setNextItems(prev => {
      const epicId = updated.epic_id
      const currentList = prev[epicId] || []
      const newList = currentList.map(n => n.id === id ? updated : n)
      return { ...prev, [epicId]: newList }
    })
    return updated
  }

  const promoteToToday = async (id: string) => {
    const updated = await window.api.nextItems.promoteToToday(id)
    setNextItems(prev => {
      const epicId = updated.epic_id
      const currentList = prev[epicId] || []
      const newList = currentList.map(n => n.id === id ? updated : n)
      return { ...prev, [epicId]: newList }
    })
    return updated
  }

  const demoteFromToday = async (id: string) => {
    const updated = await window.api.nextItems.update(id, { status: 'next' })
    setNextItems(prev => {
      const epicId = updated.epic_id
      const currentList = prev[epicId] || []
      const newList = currentList.map(n => n.id === id ? updated : n)
      return { ...prev, [epicId]: newList }
    })
    return updated
  }

  const deleteNextItem = async (id: string) => {
    await window.api.nextItems.delete(id)
    setNextItems(prev => {
      const nextMap = { ...prev }
      for (const k in nextMap) {
        nextMap[k] = nextMap[k].filter(n => n.id !== id)
      }
      return nextMap
    })
  }

  const reorderNextItems = async (epicId: string, itemIds: string[]) => {
    await window.api.nextItems.reorder(epicId, itemIds)
    setNextItems(prev => {
      const currentList = prev[epicId] || []
      const orderMap = new Map(itemIds.map((id, idx) => [id, idx]))
      const newList = [...currentList].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
      return { ...prev, [epicId]: newList }
    })
  }

  // ─── Dual Progress & Computed Stage ───
  const getResearchProgress = useCallback((epicId: string): number => {
    const exploreList = exploreItems[epicId] || []
    if (exploreList.length === 0) return 0
    const completedCount = exploreList.filter(e => e.closed).length
    return Math.round((completedCount / exploreList.length) * 100)
  }, [exploreItems])

  const getExecutionProgress = useCallback((epicId: string): number => {
    const nextList = nextItems[epicId] || []
    if (nextList.length === 0) return 0
    const completedCount = nextList.filter(n => n.status === 'done').length
    return Math.round((completedCount / nextList.length) * 100)
  }, [nextItems])

  const getEpicStage = useCallback((epicId: string): EpicStageInfo => {
    const exploreList = exploreItems[epicId] || []
    const nextList = nextItems[epicId] || []

    const hasOpenExplore = exploreList.some(e => !e.closed)
    const hasOpenNext = nextList.some(n => n.status === 'next' || n.status === 'today')

    let label = 'Planning'
    if (hasOpenExplore && hasOpenNext) {
      label = 'Explore & Next'
    } else if (hasOpenExplore) {
      label = 'Explore'
    } else if (hasOpenNext) {
      label = 'Next'
    } else if (nextList.length > 0 || exploreList.length > 0) {
      label = 'Complete'
    }

    return { hasOpenExplore, hasOpenNext, label }
  }, [exploreItems, nextItems])

  // ─── Backward compatibility Action Steps API ───
  const actionSteps = React.useMemo(() => {
    const map: Record<string, ActionStep[]> = {}
    Object.keys(nextItems).forEach(epicId => {
      map[epicId] = nextItems[epicId].map(n => ({
        id: n.id,
        item_id: n.epic_id,
        content: n.title,
        is_done: n.status === 'done',
        sort_order: n.sort_order,
        effort_value: n.time_estimate_value,
        effort_unit: n.time_estimate_unit,
        actual_effort_value: n.actual_effort_value,
        actual_effort_unit: n.actual_effort_unit,
        created_at: n.created_at,
        completed_at: n.completed_at
      }))
    })
    return map
  }, [nextItems])

  const getActionSteps = useCallback((itemId: string): ActionStep[] => {
    return actionSteps[itemId] || []
  }, [actionSteps])

  const addActionStep = async (itemId: string, content: string, options?: { effort_value?: number; effort_unit?: string }): Promise<ActionStep> => {
    const n = await addNextItem({
      epic_id: itemId,
      title: content,
      time_estimate_value: options?.effort_value,
      time_estimate_unit: options?.effort_unit
    })
    return {
      id: n.id,
      item_id: n.epic_id,
      content: n.title,
      is_done: n.status === 'done',
      sort_order: n.sort_order,
      effort_value: n.time_estimate_value,
      effort_unit: n.time_estimate_unit,
      actual_effort_value: n.actual_effort_value,
      actual_effort_unit: n.actual_effort_unit,
      created_at: n.created_at,
      completed_at: n.completed_at
    }
  }

  const toggleActionStep = async (stepId: string): Promise<ActionStep> => {
    const n = await toggleNextItem(stepId)
    return {
      id: n.id,
      item_id: n.epic_id,
      content: n.title,
      is_done: n.status === 'done',
      sort_order: n.sort_order,
      effort_value: n.time_estimate_value,
      effort_unit: n.time_estimate_unit,
      actual_effort_value: n.actual_effort_value,
      actual_effort_unit: n.actual_effort_unit,
      created_at: n.created_at,
      completed_at: n.completed_at
    }
  }

  const deleteActionStep = deleteNextItem

  const updateActionStep = async (stepId: string, changes: Partial<{ content: string; is_done: boolean; sort_order: number }>): Promise<ActionStep> => {
    const n = await updateNextItem(stepId, {
      title: changes.content,
      status: changes.is_done !== undefined ? (changes.is_done ? 'done' : 'next') : undefined,
      sort_order: changes.sort_order
    })
    return {
      id: n.id,
      item_id: n.epic_id,
      content: n.title,
      is_done: n.status === 'done',
      sort_order: n.sort_order,
      effort_value: n.time_estimate_value,
      effort_unit: n.time_estimate_unit,
      actual_effort_value: n.actual_effort_value,
      actual_effort_unit: n.actual_effort_unit,
      created_at: n.created_at,
      completed_at: n.completed_at
    }
  }

  const reorderActionSteps = reorderNextItems

  const openItemModal = (id: string) => {
    setSelectedItemId(id)
    setModalType('item')
  }
  
  const openNewItemModal = (sectorId?: string) => {
    setSelectedItemId(null)
    if (sectorId) setSelectedSectorId(sectorId)
    setModalType('item')
  }

  const openSectorModal = (id: string | null) => {
    setSelectedSectorId(id)
    setModalType('sector')
  }

  const closeModal = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setModalType(null)
    setSelectedItemId(null)
    setSelectedSectorId(null)
  }

  const getItemById = (id: string) => items.find(i => i.id === id)
  const getSectorById = (id: string) => sectors.find(s => s.id === id)

  const getItemsForSector = useCallback((sectorId: string) => {
    const sectorItems = items.filter(i => i.sector_id === sectorId)
    
    // active: updated DESC, blocked: updated DESC, paused: updated ASC, queued: created ASC, done: updated DESC, parked: updated DESC
    sectorItems.sort((a, b) => {
      const order: Record<string, number> = { active: 1, blocked: 2, paused: 3, queued: 4, parked: 5, done: 6 }
      const aOrder = order[a.status] || 99
      const bOrder = order[b.status] || 99
      if (aOrder !== bOrder) return aOrder - bOrder
      
      if (a.status === 'paused') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      if (a.status === 'queued') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    
    return sectorItems
  }, [items])

  return (
    <AppContext.Provider value={{
      sectors, items, settings, searchTerm, viewMode, selectedItemId, selectedSectorId, modalType, effortPrompt, checklistEffortPrompt, toasts,
      exploreItems, nextItems, actionSteps,
      refreshAll, createItem, updateItem, deleteItem, createSector, updateSector, deleteSector, reorderSectors, reorderItem, setUrgent, addEffort, updateSettings,
      toggleChecklistItem, getExploreItems, addExploreItem, updateExploreItem, toggleExploreItemClosed, deleteExploreItem,
      getNextItems, addNextItem, updateNextItem, toggleNextItem, promoteToToday, demoteFromToday, deleteNextItem, reorderNextItems,
      getResearchProgress, getExecutionProgress, getEpicStage,
      getActionSteps, addActionStep, toggleActionStep, deleteActionStep, updateActionStep, reorderActionSteps,
      setSearchTerm, setViewMode, openItemModal, openNewItemModal, openSectorModal, closeModal, showToast, dismissToast, setEffortPrompt, setChecklistEffortPrompt,
      getItemById, getSectorById, getItemsForSector
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppContext must be used within AppProvider")
  return ctx
}
