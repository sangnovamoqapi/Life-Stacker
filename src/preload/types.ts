// ──────────────────────────── Core Models ────────────────────────────

export type ItemStatus = 'active' | 'paused' | 'blocked' | 'done' | 'queued' | 'parked'

export interface TimeBudget {
  value: number
  unit: 'months' | 'quarters' | 'years'
}

export interface TimeEstimate {
  value: number
  unit: 'hours' | 'days'
}

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
  progress: number // 0-100 (legacy stored progress, retained for backward compat)
  time_budget?: TimeBudget | null
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
  time_budget?: TimeBudget | null
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

// ──────────────────────────── Explore Items ────────────────────────────

export interface ExploreItem {
  id: string
  epic_id: string
  title: string
  notes: string
  time_estimate_value?: number | null
  time_estimate_unit?: 'mins' | 'hours' | 'days' | string | null
  closed: boolean
  last_touched_at: string
  created_at: string
}

export interface NewExploreItem {
  epic_id: string
  title?: string
  notes: string
  time_estimate_value?: number | null
  time_estimate_unit?: 'mins' | 'hours' | 'days' | string | null
  closed?: boolean
}

// ──────────────────────────── Next Items ────────────────────────────

export type NextItemStatus = 'next' | 'today' | 'done'

export interface NextItem {
  id: string
  epic_id: string
  parent_explore_id?: string | null
  title: string
  notes?: string | null
  status: NextItemStatus
  time_estimate_value?: number | null
  time_estimate_unit?: 'hours' | 'days' | 'minutes' | 'mins' | string | null
  actual_effort_value?: number | null
  actual_effort_unit?: 'hours' | 'days' | 'minutes' | 'mins' | string | null
  due_date?: string | null
  sort_order: number
  created_at: string
  completed_at?: string | null
}

export interface NewNextItem {
  epic_id: string
  parent_explore_id?: string | null
  title: string
  notes?: string | null
  status?: NextItemStatus
  time_estimate_value?: number | null
  time_estimate_unit?: string | null
  due_date?: string | null
  sort_order?: number
}

// Legacy ActionStep interface for backward compatibility
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
  completed_at?: string | null
}

// ──────────────────────────── Action Log ────────────────────────────

export interface ActionLogEntry {
  id: string
  item_id: string
  field: 'status' | 'progress' | 'notes' | 'sector_id' | 'title' | 'next_action' | 'time_budget'
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
  active_epic_cap: number
  focus_limit: number // backward-compatible alias to active_epic_cap
  today_cap: number
  weekly_personal_hours: number | null
  burn_tracking_enabled: boolean
  stale_threshold_days: number
  launch_at_login: boolean
  glass_intensity: number
  stack_review_enabled: boolean
  stack_review_day: number
  stack_review_time: string
  background_config: BackgroundConfig
}

// ──────────────────────────── Chat & Pending Actions ────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'tool' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  tool_calls?: string | null
  created_at: string
}

export type PendingActionStatus = 'pending' | 'accepted' | 'rejected'

export interface PendingAction {
  id: string
  message_id: string
  tool_name: string
  arguments: string
  status: PendingActionStatus
  resolved_at?: string | null
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
  exploreItems: {
    list(epicId?: string): Promise<ExploreItem[]>
    create(data: NewExploreItem): Promise<ExploreItem>
    update(id: string, changes: Partial<Omit<ExploreItem, 'id' | 'epic_id' | 'created_at'>>): Promise<ExploreItem>
    toggleClosed(id: string): Promise<ExploreItem>
    delete(id: string): Promise<void>
  }
  nextItems: {
    list(filters?: { epic_id?: string; status?: NextItemStatus; parent_explore_id?: string }): Promise<NextItem[]>
    create(data: NewNextItem): Promise<NextItem>
    update(id: string, changes: Partial<Omit<NextItem, 'id' | 'epic_id' | 'created_at'>>): Promise<NextItem>
    toggle(id: string): Promise<NextItem>
    promoteToToday(id: string): Promise<NextItem>
    delete(id: string): Promise<void>
    reorder(epicId: string, itemIds: string[]): Promise<void>
    reorderToday(itemIds: string[]): Promise<void>
  }
  actionSteps: {
    list(itemId: string): Promise<NextItem[]>
    listAll(): Promise<NextItem[]>
    create(itemId: string, content: string, options?: { effort_value?: number; effort_unit?: string }): Promise<NextItem>
    update(id: string, changes: Partial<{ content: string; is_done: boolean; sort_order: number; effort_value?: number | null; effort_unit?: string | null; actual_effort_value?: number | null; actual_effort_unit?: string | null }>): Promise<NextItem>
    toggle(id: string): Promise<NextItem>
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
    reindexAll(): Promise<{ indexedEpics: number; totalChunks: number }>
  }
  ai: {
    checkStatus(): Promise<boolean>
    getLastError(): Promise<string | null>
  }
  chat: {
    send(message: string): Promise<{ assistantMessage: ChatMessage; pendingActions: PendingAction[]; error?: string }>
    listMessages(): Promise<ChatMessage[]>
    listPendingActions(): Promise<PendingAction[]>
    acceptAction(actionId: string, overrides?: Record<string, any>): Promise<{ success: boolean; error?: string }>
    rejectAction(actionId: string): Promise<{ success: boolean }>
    clearHistory(): Promise<void>
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
