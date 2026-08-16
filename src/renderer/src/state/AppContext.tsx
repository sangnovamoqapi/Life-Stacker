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
  ToastMessage,
  NewItem,
  NewSector
} from '../types'
import { parseChecklist, formatChecklist } from '../utils/checklist'

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
  focus_limit: 5,
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
  const [viewMode, setViewMode] = useState<ViewMode>('overview') // Default home page to Life Stack
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null)
  const [modalType, setModalType] = useState<ModalType>(null)
  const [effortPrompt, setEffortPrompt] = useState<EffortPromptState | null>(null)
  const [checklistEffortPrompt, setChecklistEffortPrompt] = useState<ChecklistEffortPromptState | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

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
      const [fetchedSectors, fetchedItems] = await Promise.all([
        window.api.sectors.list(),
        window.api.items.list()
      ])
      setSectors(fetchedSectors)
      setItems(fetchedItems)

      // Settings
      const focus_limit = (await window.api.settings.get<number>('focus_limit')) ?? 5
      const stale_threshold_days = (await window.api.settings.get<number>('stale_threshold_days')) ?? 14
      const launch_at_login = (await window.api.settings.get<boolean>('launch_at_login')) ?? true
      const glass_intensity = (await window.api.settings.get<number>('glass_intensity')) ?? 65
      const stack_review_enabled = (await window.api.settings.get<boolean>('stack_review_enabled')) ?? true
      const stack_review_day = (await window.api.settings.get<number>('stack_review_day')) ?? 0
      const stack_review_time = (await window.api.settings.get<string>('stack_review_time')) ?? '18:00'
      const background_config = (await window.api.settings.get<{type: 'color'|'gradient'|'image'|'video', value: string}>('background_config')) ?? { type: 'gradient', value: 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' }
      
      setSettings({ focus_limit, stale_threshold_days, launch_at_login, glass_intensity, stack_review_enabled, stack_review_day, stack_review_time, background_config })
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
        // TODO: Could scroll to lane
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
    const updated = await window.api.items.update(id, changes)
    setItems(prev => prev.map(item => item.id === id ? updated : item))
    return updated
  }

  const deleteItem = async (id: string) => {
    await window.api.items.delete(id)
    setItems(prev => prev.filter(item => item.id !== id))
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
    await refreshAll() // Easier to just reload as items might have moved
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
    setSettings(prev => ({ ...prev, [key]: value }))
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
    setModalType(null)
    setSelectedItemId(null)
    setSelectedSectorId(null)
  }

  const getItemById = (id: string) => items.find(i => i.id === id)
  const getSectorById = (id: string) => sectors.find(s => s.id === id)

  const getItemsForSector = useCallback((sectorId: string) => {
    const sectorItems = items.filter(i => i.sector_id === sectorId)
    
    // active: updated DESC, blocked: updated DESC, paused: updated ASC, queued: created ASC, done: updated DESC
    sectorItems.sort((a, b) => {
      const order = { active: 1, blocked: 2, paused: 3, queued: 4, done: 5 }
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      
      if (a.status === 'paused') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      if (a.status === 'queued') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    
    return sectorItems
  }, [items])

  return (
    <AppContext.Provider value={{
      sectors, items, settings, searchTerm, viewMode, selectedItemId, selectedSectorId, modalType, effortPrompt, checklistEffortPrompt, toasts,
      refreshAll, createItem, updateItem, deleteItem, createSector, updateSector, deleteSector, reorderSectors, reorderItem, setUrgent, addEffort, updateSettings,
      toggleChecklistItem, setSearchTerm, setViewMode, openItemModal, openNewItemModal, openSectorModal, closeModal, showToast, dismissToast, setEffortPrompt, setChecklistEffortPrompt,
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
