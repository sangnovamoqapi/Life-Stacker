import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { Item, NewItem, ItemFilters, TimeBudget } from '../../preload/types'
import { upsertChunksForItem } from './memory'

interface ItemRow {
  id: string
  sector_id: string
  title: string
  status: any
  progress: number
  time_budget: string | null
  notes: string | null
  priority_rank: number
  next_action: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: ItemRow): Item {
  let timeBudget: TimeBudget | null = null
  if (row.time_budget) {
    try {
      timeBudget = JSON.parse(row.time_budget)
    } catch {
      timeBudget = null
    }
  }

  return {
    id: row.id,
    sector_id: row.sector_id,
    title: row.title,
    status: row.status,
    progress: row.progress,
    time_budget: timeBudget,
    notes: row.notes,
    priority_rank: row.priority_rank,
    next_action: row.next_action,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function listItems(filters?: ItemFilters): Item[] {
  const db = getDb()
  let query = 'SELECT * FROM items WHERE 1=1'
  const params: any[] = []

  if (filters?.sector_id) {
    query += ' AND sector_id = ?'
    params.push(filters.sector_id)
  }
  if (filters?.status) {
    query += ' AND status = ?'
    params.push(filters.status)
  }
  if (filters?.search) {
    query += ' AND title LIKE ?'
    params.push(`%${filters.search}%`)
  }

  query += ' ORDER BY created_at DESC'
  const rows = db.prepare(query).all(...params) as ItemRow[]
  return rows.map(mapRow)
}

export function getItemById(id: string): Item | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
  return row ? mapRow(row) : undefined
}

export function createItem(data: NewItem): Item {
  const db = getDb()
  const now = new Date().toISOString()
  const maxRankRes = db.prepare('SELECT COALESCE(MAX(priority_rank), 0) as maxRank FROM items').get() as { maxRank: number }
  const nextRank = maxRankRes.maxRank + 1
  const id = uuid()

  const timeBudgetStr = data.time_budget ? JSON.stringify(data.time_budget) : null

  db.prepare(`
    INSERT INTO items (id, sector_id, title, status, progress, time_budget, notes, priority_rank, next_action, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sector_id,
    data.title,
    data.status ?? 'active',
    data.progress ?? 0,
    timeBudgetStr,
    data.notes ?? null,
    nextRank,
    data.next_action ?? null,
    now,
    now
  )

  // Fire-and-forget vector embedding without blocking save
  upsertChunksForItem(id).catch(err => {
    console.error('[Memory] Fire-and-forget embed error on create:', err)
  })

  const created = getItemById(id)
  if (!created) throw new Error('Failed to retrieve created item')
  return created
}

export function updateItem(id: string, changes: Partial<Omit<Item, 'id' | 'created_at'>>): Item {
  const db = getDb()
  
  const result = db.transaction(() => {
    const current = getItemById(id)
    if (!current) throw new Error(`Item not found: ${id}`)

    const now = new Date().toISOString()
    
    // Auto-sync status and progress based on constraints
    let newProgress = changes.progress ?? current.progress
    let newStatus = changes.status ?? current.status
    if (newProgress === 100 && newStatus !== 'done') {
      newStatus = 'done'
    } else if (newProgress < 100 && newStatus === 'done') {
      newStatus = 'queued'
    }

    // Completion rule: An Epic can only move to done when zero Next items remain open
    if (newStatus === 'done' && current.status !== 'done') {
      const openNextCount = db.prepare(`
        SELECT COUNT(*) as count FROM next_items 
        WHERE epic_id = ? AND status != 'done'
      `).get(id) as { count: number }

      if (openNextCount.count > 0) {
        throw new Error(`Cannot mark Epic as Done while ${openNextCount.count} open Next item(s) exist.`)
      }
    }

    const timeBudgetStr = changes.time_budget !== undefined 
      ? (changes.time_budget ? JSON.stringify(changes.time_budget) : null)
      : (current.time_budget ? JSON.stringify(current.time_budget) : null)

    const updated: Item = { 
      ...current, 
      ...changes,
      progress: newProgress,
      status: newStatus,
      time_budget: changes.time_budget !== undefined ? changes.time_budget : current.time_budget,
      updated_at: now 
    }

    // Prepare action logs for changed tracked fields
    const actionLogStmt = db.prepare(`
      INSERT INTO action_log (id, item_id, field, old_value, new_value, changed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const trackedFields: (keyof Item)[] = ['status', 'progress', 'notes', 'sector_id', 'title', 'next_action', 'time_budget']
    for (const field of trackedFields) {
      if (JSON.stringify(current[field]) !== JSON.stringify(updated[field])) {
        actionLogStmt.run(
          uuid(),
          id,
          field,
          current[field] ? (typeof current[field] === 'object' ? JSON.stringify(current[field]) : String(current[field])) : null,
          updated[field] ? (typeof updated[field] === 'object' ? JSON.stringify(updated[field]) : String(updated[field])) : null,
          now
        )
      }
    }

    db.prepare(`
      UPDATE items
      SET sector_id = ?, title = ?, status = ?, progress = ?, time_budget = ?,
          notes = ?, next_action = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.sector_id,
      updated.title,
      updated.status,
      updated.progress,
      timeBudgetStr,
      updated.notes,
      updated.next_action,
      updated.updated_at,
      id
    )

    return updated
  })()

  // Fire-and-forget vector embedding without blocking save
  upsertChunksForItem(result.id).catch(err => {
    console.error('[Memory] Fire-and-forget embed error on update:', err)
  })

  return result
}

export function deleteItem(id: string): void {
  const db = getDb()
  const tx = db.transaction(() => {
    const item = db.prepare('SELECT priority_rank FROM items WHERE id = ?').get(id) as { priority_rank: number } | undefined
    if (!item) return
    
    // 1. Delete all referencing child tables to prevent foreign key violations
    db.prepare('DELETE FROM next_items WHERE epic_id = ?').run(id)
    db.prepare('DELETE FROM explore_items WHERE epic_id = ?').run(id)
    db.prepare('DELETE FROM action_steps WHERE item_id = ?').run(id)
    db.prepare('DELETE FROM action_log WHERE item_id = ?').run(id)
    db.prepare('DELETE FROM effort_log WHERE item_id = ?').run(id)
    db.prepare('DELETE FROM edges WHERE from_item_id = ? OR to_item_id = ?').run(id, id)

    // 2. Clean up vector memory chunks and embeddings
    const chunkRows = db.prepare('SELECT vec_rowid FROM memory_chunks WHERE source_id = ?').all(id) as { vec_rowid: number }[]
    for (const chunk of chunkRows) {
      try {
        db.prepare('DELETE FROM chunk_vectors WHERE rowid = ?').run(chunk.vec_rowid)
      } catch {}
    }
    db.prepare('DELETE FROM memory_chunks WHERE source_id = ?').run(id)

    // 3. Delete the parent item row
    db.prepare('DELETE FROM items WHERE id = ?').run(id)

    // 4. Compact priority ranks
    db.prepare('UPDATE items SET priority_rank = priority_rank - 1 WHERE priority_rank > ?').run(item.priority_rank)
  })
  tx()

  // Additional background vector sync
  upsertChunksForItem(id).catch(err => {
    console.error('[Memory] Fire-and-forget cleanup error on delete:', err)
  })
}

export function reorderItem(itemId: string, newRank: number): void {
  const db = getDb()
  db.transaction(() => {
    const item = db.prepare('SELECT priority_rank FROM items WHERE id = ?').get(itemId) as { priority_rank: number }
    if (!item) return
    
    const oldRank = item.priority_rank
    if (oldRank === newRank) return

    if (newRank < oldRank) {
      db.prepare('UPDATE items SET priority_rank = priority_rank + 1 WHERE priority_rank >= ? AND priority_rank < ?').run(newRank, oldRank)
    } else {
      db.prepare('UPDATE items SET priority_rank = priority_rank - 1 WHERE priority_rank > ? AND priority_rank <= ?').run(oldRank, newRank)
    }
    
    db.prepare('UPDATE items SET priority_rank = ? WHERE id = ?').run(newRank, itemId)
  })()
}

export function setUrgent(itemId: string): void {
  const db = getDb()
  db.transaction(() => {
    const item = db.prepare('SELECT status FROM items WHERE id = ?').get(itemId) as { status: string }
    if (!item) return
    
    db.prepare('UPDATE items SET priority_rank = priority_rank + 1').run()
    db.prepare("UPDATE items SET priority_rank = 0, status = 'active' WHERE id = ?").run(itemId)
    
    if (item.status !== 'active') {
      db.prepare(`
        INSERT INTO action_log (id, item_id, field, old_value, new_value, changed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuid(), itemId, 'status', item.status, 'active', new Date().toISOString())
    }
  })()
}
