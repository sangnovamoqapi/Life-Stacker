// Shared type definitions used by preload bridge and renderer.
// These types define the shape of data flowing across the IPC boundary.

// ──────────────────────────── Sector ────────────────────────────

export interface Sector {
  id: string
  name: string
  icon?: string | null
  color: string // 'sector-0' .. 'sector-7'
  notif_enabled: number // 0 | 1
  notif_cadence: 'daily' | 'every_n_days' | 'weekdays'
  notif_interval_days: number | null
  notif_weekdays: string | null // JSON array of ints 0-6
  notif_time: string // 'HH:MM' 24h local time
  sort_order: number
}

export interface NewSector {
  name: string
  icon?: string | null
  color: string
  notif_enabled?: number
  notif_cadence?: 'daily' | 'every_n_days' | 'weekdays'
  notif_interval_days?: number | null
  notif_weekdays?: string | null
  notif_time?: string
}

// ──────────────────────────── Item ────────────────────────────

export type ItemStatus = 'active' | 'paused' | 'blocked' | 'queued' | 'done'

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  effortValue?: number
  effortUnit?: 'mins' | 'hours' | 'days'
  actualEffortValue?: number
  actualEffortUnit?: 'mins' | 'hours' | 'days'
}

export interface Item {
  id: string
  sector_id: string
  title: string
  status: ItemStatus
  progress: number
  notes: string | null
  priority_rank: number
  next_action: string | null
  created_at: string
  updated_at: string
}

export interface NewItem {
  title: string
  sector_id: string
  status?: ItemStatus
  progress?: number
  notes?: string
  next_action?: string
}

export interface ItemFilters {
  sector_id?: string
  status?: ItemStatus
  search?: string
}

// ──────────────────────────── Action Log ────────────────────────────

export interface ActionLogEntry {
  id: string
  item_id: string
  field: 'status' | 'progress' | 'notes' | 'sector_id' | 'title'
  old_value: string | null
  new_value: string | null
  changed_at: string
}

// ──────────────────────────── Effort Log ────────────────────────────

export type EffortUnit = 'hours' | 'days'

export interface EffortEntry {
  id: string
  item_id: string
  logged_at: string
  amount: number
  unit: EffortUnit
  note: string | null
  source: string // 'manual' | future: 'subboard'
}

export interface EffortTotal {
  item_id: string
  sector_id?: string
  sector_name?: string
  item_title?: string
  total_hours: number // sum of hours + days×8, for bar-width computation only
  entries_hours: number // sum of entries where unit='hours'
  entries_days: number // sum of entries where unit='days'
}

// ──────────────────────────── Settings ────────────────────────────

export interface BackgroundConfig {
  type: 'color' | 'gradient' | 'image' | 'video'
  value: string // hex code, gradient string, or absolute file path
}

export interface AppSettings {
  focus_limit: number
  stale_threshold_days: number
  launch_at_login: boolean
  glass_intensity: number
  stack_review_enabled: boolean
  stack_review_day: number
  stack_review_time: string
  background_config: BackgroundConfig
}

// ──────────────────────────── IPC API surface ────────────────────────────

export interface LifeStackAPI {
  items: {
    list(filters?: ItemFilters): Promise<Item[]>
    create(data: NewItem): Promise<Item>
    update(id: string, changes: Partial<Omit<Item, 'id' | 'created_at'>>): Promise<Item>
    delete(id: string): Promise<void>
    reorder(itemId: string, newRank: number): Promise<void>
    setUrgent(itemId: string): Promise<void>
  }
  sectors: {
    list(): Promise<Sector[]>
    create(data: NewSector): Promise<Sector>
    update(id: string, changes: Partial<Omit<Sector, 'id'>>): Promise<Sector>
    delete(id: string, moveItemsTo?: string): Promise<void>
    reorder(ids: string[]): Promise<void>
  }
  effortLog: {
    add(itemId: string, amount: number, unit: EffortUnit, note?: string): Promise<EffortEntry>
    listForItem(itemId: string): Promise<EffortEntry[]>
    getTotals(itemId?: string): Promise<EffortTotal[]>
  }
  actionLog: {
    listForItem(itemId: string): Promise<ActionLogEntry[]>
  }
  settings: {
    get<T = unknown>(key: string): Promise<T | null>
    set(key: string, value: unknown): Promise<void>
  }
  data: {
    exportSnapshot(): Promise<string | null>
  }
  notifications: {
    test(sectorId: string): Promise<void>
  }
  app: {
    setLoginItem(enabled: boolean): Promise<void>
    pickBackground(): Promise<BackgroundConfig | null>
  }
  on(channel: string, callback: (...args: unknown[]) => void): () => void
}

// Augment the Window interface for the renderer
declare global {
  interface Window {
    api: LifeStackAPI
  }
}
