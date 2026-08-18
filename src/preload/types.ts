// ──────────────────────────── Core Models ────────────────────────────

export type ItemStatus = 'active' | 'paused' | 'blocked' | 'done' | 'queued'

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  effortValue?: number
  effortUnit?: 'minutes' | 'hours' | 'days' | 'mins'
  actualEffortValue?: number
  actualEffortUnit?: 'minutes' | 'hours' | 'days' | 'mins'
}

export interface Item {
  id: string
  sector_id: string
  title: string
  status: ItemStatus
  progress: number // 0-100
  notes: string | null
  priority_rank: number
  next_action: string | null
  created_at: string
  updated_at: string
}

export interface NewItem {
  sector_id: string
  title: string
  status?: ItemStatus
  progress?: number
  notes?: string | null
  next_action?: string | null
}

export type NotificationCadence = 'daily' | 'weekdays' | 'weekly' | 'every_n_days'

export interface Sector {
  id: string
  name: string
  icon: string | null
  color: string // 'sector-0' through 'sector-7'
  notif_enabled: boolean | number
  notif_cadence: NotificationCadence
  notif_interval_days: number | null
  notif_weekdays: number[] | string | null // [0,1,2,3,4,5,6], 0=Sun or JSON string
  notif_time: string // 'HH:MM'
  sort_order: number
}

export interface NewSector {
  name: string
  icon?: string | null
  color: string
  notif_enabled?: boolean | number
  notif_cadence: NotificationCadence
  notif_interval_days?: number | null
  notif_weekdays?: number[] | string | null
  notif_time: string
  sort_order?: number
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
  field: 'status' | 'progress' | 'notes' | 'sector_id' | 'title' | 'next_action'
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

// ──────────────────────────── Graph Edges ────────────────────────────

export type RelationType = 'depends_on' | 'supports' | 'contradicts' | 'relates_to' | string

export interface Edge {
  id: string
  from_item_id: string
  to_item_id: string
  relation_type: string
  note: string | null
  created_at: string
}

export interface NewEdge {
  from_item_id: string
  to_item_id: string
  relation_type: string
  note?: string | null
}

export interface EdgeWithDetails extends Edge {
  target_item_title?: string
  target_item_status?: ItemStatus
  source_item_title?: string
  source_item_status?: ItemStatus
}

export interface EdgeLogEntry {
  id: string
  edge_id: string
  action: 'created' | 'deleted' | 'retyped'
  old_relation_type: string | null
  new_relation_type: string | null
  changed_at: string
}

// ──────────────────────────── Vector Memory ────────────────────────────

export interface MemoryChunk {
  id: string
  vec_rowid: number
  source_type: string
  source_id: string
  content: string
  created_at: string
}

export interface MemorySearchResult {
  chunk_id: string
  source_type: string
  source_id: string
  content: string
  item_title: string | null
  item_status: ItemStatus | null
  item_rank: number | null
  distance: number
}

// ──────────────────────────── Settings ────────────────────────────

export interface BackgroundConfig {
  type: 'color' | 'gradient' | 'image' | 'video' | 'camera'
  value: string // hex code, gradient string, absolute file path, or camera deviceId
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

export interface ActionStep {
  id: string
  item_id: string
  content: string
  is_done: boolean
  sort_order: number
  effort_value?: number | null
  effort_unit?: string | null
  actual_effort_value?: number | null
  actual_effort_unit?: string | null
  created_at: string
  completed_at: string | null
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
  actionSteps: {
    list(itemId: string): Promise<ActionStep[]>
    listAll(): Promise<ActionStep[]>
    create(itemId: string, content: string, options?: { effort_value?: number; effort_unit?: string }): Promise<ActionStep>
    update(id: string, changes: Partial<{ content: string; is_done: boolean; sort_order: number; effort_value?: number | null; effort_unit?: string | null; actual_effort_value?: number | null; actual_effort_unit?: string | null }>): Promise<ActionStep>
    toggle(id: string): Promise<ActionStep>
    delete(id: string): Promise<void>
    reorder(itemId: string, stepIds: string[]): Promise<void>
  }
  sectors: {
    list(): Promise<Sector[]>
    create(data: NewSector): Promise<Sector>
    update(id: string, changes: Partial<Omit<Sector, 'id'>>): Promise<Sector>
    delete(id: string, moveItemsTo?: string): Promise<void>
    reorder(ids: string[]): Promise<void>
  }
  edges: {
    create(data: NewEdge): Promise<Edge>
    list(itemId: string): Promise<{ outgoing: EdgeWithDetails[]; incoming: EdgeWithDetails[] }>
    delete(edgeId: string): Promise<boolean>
    retype(edgeId: string, newRelationType: string): Promise<Edge>
  }
  memory: {
    search(queryText: string, topK?: number): Promise<MemorySearchResult[]>
  }
  ai: {
    checkStatus(): Promise<boolean>
    getLastError(): Promise<string | null>
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
  debug?: {
    runQuery(sql: string): Promise<any[]>
  }
  on(channel: string, callback: (...args: unknown[]) => void): () => void
}

// Augment the Window interface for the renderer
declare global {
  interface Window {
    api: LifeStackAPI
  }
}
