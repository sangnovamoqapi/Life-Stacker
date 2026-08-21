import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { ExploreItem, NewExploreItem } from '../../preload/types'
import { upsertChunksForItem } from './memory'

interface ExploreItemRow {
  id: string
  epic_id: string
  title: string
  notes: string
  time_estimate_value: number | null
  time_estimate_unit: string | null
  closed: number
  last_touched_at: string
  created_at: string
}

function mapRow(row: ExploreItemRow): ExploreItem {
  return {
    id: row.id,
    epic_id: row.epic_id,
    title: row.title || '',
    notes: row.notes || '',
    time_estimate_value: row.time_estimate_value,
    time_estimate_unit: row.time_estimate_unit,
    closed: Boolean(row.closed),
    last_touched_at: row.last_touched_at,
    created_at: row.created_at
  }
}

export function listExploreItems(epicId?: string): ExploreItem[] {
  const db = getDb()
  if (epicId) {
    const rows = db.prepare(`
      SELECT * FROM explore_items 
      WHERE epic_id = ? 
      ORDER BY last_touched_at ASC
    `).all(epicId) as ExploreItemRow[]
    return rows.map(mapRow)
  }

  const rows = db.prepare(`
    SELECT * FROM explore_items 
    ORDER BY last_touched_at ASC
  `).all() as ExploreItemRow[]
  return rows.map(mapRow)
}

export function getExploreItemById(id: string): ExploreItem | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM explore_items WHERE id = ?').get(id) as ExploreItemRow | undefined
  return row ? mapRow(row) : undefined
}

export function createExploreItem(data: NewExploreItem): ExploreItem {
  const db = getDb()
  const now = new Date().toISOString()
  const id = uuid()

  const insert = db.prepare(`
    INSERT INTO explore_items (
      id, epic_id, title, notes, time_estimate_value, time_estimate_unit, closed, last_touched_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insert.run(
    id,
    data.epic_id,
    data.title || '',
    data.notes || '',
    data.time_estimate_value ?? null,
    data.time_estimate_unit ?? null,
    data.closed ? 1 : 0,
    now,
    now
  )

  upsertChunksForItem(data.epic_id).catch(() => {})

  const created = getExploreItemById(id)
  if (!created) throw new Error('Failed to retrieve created explore item')
  return created
}

export function updateExploreItem(
  id: string,
  changes: Partial<Omit<ExploreItem, 'id' | 'epic_id' | 'created_at'>>
): ExploreItem {
  const db = getDb()
  const existing = getExploreItemById(id)
  if (!existing) throw new Error(`Explore item ${id} not found`)

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
  if (changes.time_estimate_value !== undefined) {
    sets.push('time_estimate_value = ?')
    values.push(changes.time_estimate_value)
  }
  if (changes.time_estimate_unit !== undefined) {
    sets.push('time_estimate_unit = ?')
    values.push(changes.time_estimate_unit)
  }
  if (changes.closed !== undefined) {
    sets.push('closed = ?')
    values.push(changes.closed ? 1 : 0)
  }

  // Always update last_touched_at on any edit
  sets.push('last_touched_at = ?')
  values.push(now)

  values.push(id)

  if (sets.length > 0) {
    db.prepare(`UPDATE explore_items SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  upsertChunksForItem(existing.epic_id).catch(() => {})

  const updated = getExploreItemById(id)
  if (!updated) throw new Error('Failed to retrieve updated explore item')
  return updated
}

export function toggleExploreItemClosed(id: string): ExploreItem {
  const existing = getExploreItemById(id)
  if (!existing) throw new Error(`Explore item ${id} not found`)
  return updateExploreItem(id, { closed: !existing.closed })
}

export function deleteExploreItem(id: string): void {
  const db = getDb()
  const existing = getExploreItemById(id)
  if (!existing) return

  // Enforce deletion rule:
  // Cannot be deleted while parent epic status != 'done' AND it has any linked Next items.
  const parentEpic = db.prepare('SELECT status FROM items WHERE id = ?').get(existing.epic_id) as { status: string } | undefined
  const linkedNextCount = db.prepare('SELECT COUNT(*) as count FROM next_items WHERE parent_explore_id = ?').get(id) as { count: number }

  if (parentEpic && parentEpic.status !== 'done' && linkedNextCount.count > 0) {
    throw new Error(
      `Cannot delete Explore item with ${linkedNextCount.count} linked Next item(s) while parent Epic is not Done.`
    )
  }

  db.transaction(() => {
    // If parent is done or no open constraints, unlink child next items
    db.prepare('UPDATE next_items SET parent_explore_id = NULL WHERE parent_explore_id = ?').run(id)
    db.prepare('DELETE FROM explore_items WHERE id = ?').run(id)
  })()

  upsertChunksForItem(existing.epic_id).catch(() => {})
}
