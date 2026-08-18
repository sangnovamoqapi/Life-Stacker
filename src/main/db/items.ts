import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { Item, NewItem, ItemFilters } from '../../preload/types'
import { upsertChunksForItem } from './memory'

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
  return db.prepare(query).all(...params) as Item[]
}

export function createItem(data: NewItem): Item {
  const db = getDb()
  const now = new Date().toISOString()
  const maxRankRes = db.prepare('SELECT COALESCE(MAX(priority_rank), 0) as maxRank FROM items').get() as { maxRank: number }
  const nextRank = maxRankRes.maxRank + 1

  const item: Item = {
    id: uuid(),
    sector_id: data.sector_id,
    title: data.title,
    status: data.status ?? 'active',
    progress: data.progress ?? 0,
    notes: data.notes ?? null,
    priority_rank: nextRank,
    next_action: data.next_action ?? null,
    created_at: now,
    updated_at: now
  }

  db.prepare(`
    INSERT INTO items (id, sector_id, title, status, progress, notes, priority_rank, next_action, created_at, updated_at)
    VALUES (@id, @sector_id, @title, @status, @progress, @notes, @priority_rank, @next_action, @created_at, @updated_at)
  `).run(item)

  // Fire-and-forget vector embedding without blocking save
  upsertChunksForItem(item.id).catch(err => {
    console.error('[Memory] Fire-and-forget embed error on create:', err)
  })

  return item
}

export function updateItem(id: string, changes: Partial<Omit<Item, 'id' | 'created_at'>>): Item {
  const db = getDb()
  
  const result = db.transaction(() => {
    const current = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item
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

    const updated = { 
      ...current, 
      ...changes,
      progress: newProgress,
      status: newStatus,
      updated_at: now 
    }

    // Prepare action logs for changed tracked fields
    const actionLogStmt = db.prepare(`
      INSERT INTO action_log (id, item_id, field, old_value, new_value, changed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const trackedFields: (keyof Item)[] = ['status', 'progress', 'notes', 'sector_id', 'title', 'next_action']
    for (const field of trackedFields) {
      if (current[field] !== updated[field]) {
        actionLogStmt.run(
          uuid(),
          id,
          field,
          String(current[field] ?? ''),
          String(updated[field] ?? ''),
          now
        )
      }
    }

    db.prepare(`
      UPDATE items
      SET sector_id = @sector_id, title = @title, status = @status, progress = @progress,
          notes = @notes, next_action = @next_action, updated_at = @updated_at
      WHERE id = @id
    `).run(updated)

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
    const item = db.prepare('SELECT priority_rank FROM items WHERE id = ?').get(id) as { priority_rank: number }
    if (!item) return
    
    db.prepare('DELETE FROM action_log WHERE item_id = ?').run(id)
    db.prepare('DELETE FROM effort_log WHERE item_id = ?').run(id)
    db.prepare('DELETE FROM edges WHERE from_item_id = ? OR to_item_id = ?').run(id, id)
    db.prepare('DELETE FROM items WHERE id = ?').run(id)

    db.prepare('UPDATE items SET priority_rank = priority_rank - 1 WHERE priority_rank > ?').run(item.priority_rank)
  })
  tx()

  // Cleanup chunks in background
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
