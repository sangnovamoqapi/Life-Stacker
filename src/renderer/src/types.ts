import type {
  Sector,
  NewSector,
  Item,
  NewItem,
  ItemStatus,
  ChecklistItem,
  ItemFilters,
  ActionLogEntry,
  EffortUnit,
  EffortEntry,
  EffortTotal,
  AppSettings,
  LifeStackAPI,
} from '../../preload/types'

export type {
  Sector,
  NewSector,
  Item,
  NewItem,
  ItemStatus,
  ChecklistItem,
  ItemFilters,
  ActionLogEntry,
  EffortUnit,
  EffortEntry,
  EffortTotal,
  AppSettings,
  LifeStackAPI,
}

export type ViewMode = 'lanes' | 'overview' | 'settings' | 'stats'
export type ModalType = 'item' | 'sector' | null
export type TabType = 'details' | 'history' | 'effort'

export interface EffortPromptState {
  itemId: string
  oldProgress: number
  newProgress: number
}

export interface ChecklistEffortPromptState {
  itemId: string
  checklistItem: ChecklistItem
}

export interface ToastMessage {
  id: string
  text: string
  type: 'success' | 'info' | 'warning'
}
