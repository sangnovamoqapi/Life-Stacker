import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { EffortEntry, EffortUnit, EffortTotal } from '../../preload/types'

export function addEffort(itemId: string, amount: number, unit: EffortUnit, note?: string): EffortEntry {
  const db = getDb()
  const entry: EffortEntry = {
    id: uuid(),
    item_id: itemId,
    logged_at: new Date().toISOString(),
    amount,
    unit,
    note: note ?? null,
    source: 'manual'
  }

  db.prepare(`
    INSERT INTO effort_log (id, item_id, logged_at, amount, unit, note, source)
    VALUES (@id, @item_id, @logged_at, @amount, @unit, @note, @source)
  `).run(entry)

  return entry
}

export function listForItem(itemId: string): EffortEntry[] {
  const db = getDb()
  return db.prepare('SELECT * FROM effort_log WHERE item_id = ? ORDER BY logged_at DESC').all(itemId) as EffortEntry[]
}

export function getTotals(itemId?: string): EffortTotal[] {
  const db = getDb()
  let query = `
    SELECT 
      e.item_id,
      i.title as item_title,
      s.id as sector_id,
      s.name as sector_name,
      SUM(CASE WHEN e.unit = 'hours' THEN e.amount ELSE 0 END) as entries_hours,
      SUM(CASE WHEN e.unit = 'days' THEN e.amount ELSE 0 END) as entries_days
    FROM effort_log e
    JOIN items i ON e.item_id = i.id
    JOIN sectors s ON i.sector_id = s.id
  `
  
  if (itemId) {
    query += ' WHERE e.item_id = ?'
  }
  
  query += ' GROUP BY e.item_id'

  const rows = (itemId ? db.prepare(query).all(itemId) : db.prepare(query).all()) as any[]

  return rows.map(row => ({
    item_id: row.item_id,
    sector_id: row.sector_id,
    sector_name: row.sector_name,
    item_title: row.item_title,
    entries_hours: row.entries_hours,
    entries_days: row.entries_days,
    total_hours: row.entries_hours + (row.entries_days * 8)
  }))
}
