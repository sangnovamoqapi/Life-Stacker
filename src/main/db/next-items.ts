import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { NextItem, NewNextItem, NextItemStatus } from '../../preload/types'
import { upsertChunksForItem } from './memory'

interface NextItemRow {
  id: string
  epic_id: string
  parent_explore_id: string | null
  title: string
  notes: string | null
  status: NextItemStatus
  time_estimate_value: number | null
  time_estimate_unit: string | null
  actual_effort_value: number | null
  actual_effort_unit: string | null
  due_date: string | null
  sort_order: number
  created_at: string
  completed_at: string | null
}

function mapRow(row: NextItemRow): NextItem {
  return {
    id: row.id,
    epic_id: row.epic_id,
    parent_explore_id: row.parent_explore_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    time_estimate_value: row.time_estimate_value,
    time_estimate_unit: row.time_estimate_unit,
    actual_effort_value: row.actual_effort_value,
    actual_effort_unit: row.actual_effort_unit,
    due_date: row.due_date,
    sort_order: row.sort_order,
    created_at: row.created_at,
    completed_at: row.completed_at
  }
}

export function listNextItems(filters?: {
  epic_id?: string
  status?: NextItemStatus
  parent_explore_id?: string
}): NextItem[] {
  const db = getDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.epic_id) {
    conditions.push('epic_id = ?')
    params.push(filters.epic_id)
  }
  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }
  if (filters?.parent_explore_id) {
    conditions.push('parent_explore_id = ?')
    params.push(filters.parent_explore_id)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const query = `
    SELECT * FROM next_items 
    ${where}
    ORDER BY sort_order ASC, created_at ASC
  `
  const rows = db.prepare(query).all(...params) as NextItemRow[]
  return rows.map(mapRow)
}

export function getNextItemById(id: string): NextItem | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM next_items WHERE id = ?').get(id) as NextItemRow | undefined
  return row ? mapRow(row) : undefined
}

export function createNextItem(data: NewNextItem): NextItem {
  const db = getDb()
  const now = new Date().toISOString()
  const id = uuid()

  let sortOrder = data.sort_order
  if (sortOrder === undefined || sortOrder === null) {
    const maxOrderRow = db.prepare('SELECT MAX(sort_order) as max_order FROM next_items WHERE epic_id = ?').get(data.epic_id) as { max_order: number | null }
    sortOrder = (maxOrderRow?.max_order ?? -1) + 1
  }

  const status: NextItemStatus = data.status || 'next'
  const completedAt = status === 'done' ? now : null

  const insert = db.prepare(`
    INSERT INTO next_items (
      id, epic_id, parent_explore_id, title, notes, status,
      time_estimate_value, time_estimate_unit, actual_effort_value, actual_effort_unit,
      due_date, sort_order, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insert.run(
    id,
    data.epic_id,
    data.parent_explore_id || null,
    data.title,
    data.notes || null,
    status,
    data.time_estimate_value ?? null,
    data.time_estimate_unit ?? null,
    null,
    null,
    data.due_date || null,
    sortOrder,
    now,
    completedAt
  )

  upsertChunksForItem(data.epic_id).catch(() => {})

  const created = getNextItemById(id)
  if (!created) throw new Error('Failed to retrieve created next item')
  return created
}

export function updateNextItem(
  id: string,
  changes: Partial<Omit<NextItem, 'id' | 'epic_id' | 'created_at'>>
): NextItem {
  const db = getDb()
  const existing = getNextItemById(id)
  if (!existing) throw new Error(`Next item ${id} not found`)

  const sets: string[] = []
  const values: any[] = []
  const now = new Date().toISOString()

  if (changes.title !== undefined) {
    sets.push('title = ?')
    values.push(changes.title)
  }
  if (changes.notes !== undefined) {
    sets.push('notes = ?')
    values.push(changes.notes)
  }
  if (changes.parent_explore_id !== undefined) {
    sets.push('parent_explore_id = ?')
    values.push(changes.parent_explore_id || null)
  }
  if (changes.status !== undefined) {
    sets.push('status = ?')
    values.push(changes.status)
    if (changes.status === 'done') {
      sets.push('completed_at = ?')
      values.push(now)
    } else {
      sets.push('completed_at = NULL')
    }
  }
  if (changes.time_estimate_value !== undefined) {
    sets.push('time_estimate_value = ?')
    values.push(changes.time_estimate_value)
  }
  if (changes.time_estimate_unit !== undefined) {
    sets.push('time_estimate_unit = ?')
    values.push(changes.time_estimate_unit)
  }
  if (changes.actual_effort_value !== undefined) {
    sets.push('actual_effort_value = ?')
    values.push(changes.actual_effort_value)
  }
  if (changes.actual_effort_unit !== undefined) {
    sets.push('actual_effort_unit = ?')
    values.push(changes.actual_effort_unit)
  }
  if (changes.due_date !== undefined) {
    sets.push('due_date = ?')
    values.push(changes.due_date)
  }
  if (changes.sort_order !== undefined) {
    sets.push('sort_order = ?')
    values.push(changes.sort_order)
  }

  values.push(id)

  if (sets.length > 0) {
    db.prepare(`UPDATE next_items SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  upsertChunksForItem(existing.epic_id).catch(() => {})

  const updated = getNextItemById(id)
  if (!updated) throw new Error('Failed to retrieve updated next item')
  return updated
}

export function toggleNextItem(id: string): NextItem {
  const existing = getNextItemById(id)
  if (!existing) throw new Error(`Next item ${id} not found`)
  const newStatus: NextItemStatus = existing.status === 'done' ? 'next' : 'done'
  return updateNextItem(id, { status: newStatus })
}

export function promoteToToday(id: string): NextItem {
  const existing = getNextItemById(id)
  if (!existing) throw new Error(`Next item ${id} not found`)
  return updateNextItem(id, { status: 'today' })
}

export function deleteNextItem(id: string): void {
  const db = getDb()
  const existing = getNextItemById(id)
  if (!existing) return

  db.prepare('DELETE FROM next_items WHERE id = ?').run(id)
  upsertChunksForItem(existing.epic_id).catch(() => {})
}

export function reorderNextItems(epicId: string, itemIds: string[]): void {
  const db = getDb()
  const updateStmt = db.prepare('UPDATE next_items SET sort_order = ? WHERE id = ? AND epic_id = ?')
  db.transaction(() => {
    itemIds.forEach((id, index) => {
      updateStmt.run(index, id, epicId)
    })
  })()
}

export function reorderTodayItems(itemIds: string[]): void {
  const db = getDb()
  const updateStmt = db.prepare('UPDATE next_items SET sort_order = ? WHERE id = ?')
  db.transaction(() => {
    itemIds.forEach((id, index) => {
      updateStmt.run(index, id)
    })
  })()
}
