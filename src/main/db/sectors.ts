import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { Sector, NewSector } from '../../preload/types'

export function listSectors(): Sector[] {
  const db = getDb()
  return db.prepare('SELECT * FROM sectors ORDER BY sort_order').all() as Sector[]
}

export function createSector(data: NewSector): Sector {
  const db = getDb()
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM sectors').get() as { next_order: number }
  
  const sector: Sector = {
    id: uuid(),
    name: data.name,
    icon: data.icon ?? null,
    color: data.color,
    notif_enabled: data.notif_enabled ?? true,
    notif_cadence: data.notif_cadence ?? 'daily',
    notif_interval_days: data.notif_interval_days ?? null,
    notif_weekdays: data.notif_weekdays ?? null,
    notif_time: data.notif_time ?? '09:00',
    sort_order: row.next_order
  }

  db.prepare(`
    INSERT INTO sectors (id, name, icon, color, notif_enabled, notif_cadence, notif_interval_days, notif_weekdays, notif_time, sort_order)
    VALUES (@id, @name, @icon, @color, @notif_enabled, @notif_cadence, @notif_interval_days, @notif_weekdays, @notif_time, @sort_order)
  `).run(sector)

  return sector
}

export function updateSector(id: string, data: Partial<Omit<Sector, 'id'>>): Sector {
  const db = getDb()
  const current = db.prepare('SELECT * FROM sectors WHERE id = ?').get(id) as Sector
  if (!current) throw new Error(`Sector not found: ${id}`)

  const updated = { ...current, ...data }

  db.prepare(`
    UPDATE sectors
    SET name = @name, icon = @icon, color = @color, notif_enabled = @notif_enabled, notif_cadence = @notif_cadence,
        notif_interval_days = @notif_interval_days, notif_weekdays = @notif_weekdays, notif_time = @notif_time,
        sort_order = @sort_order
    WHERE id = @id
  `).run(updated)

  return updated
}

export function deleteSector(id: string, moveItemsTo?: string): void {
  const db = getDb()
  const tx = db.transaction(() => {
    if (moveItemsTo) {
      db.prepare('UPDATE items SET sector_id = ? WHERE sector_id = ?').run(moveItemsTo, id)
    }
    db.prepare('DELETE FROM sectors WHERE id = ?').run(id)
  })
  tx()
}

export function reorderSectors(ids: string[]): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE sectors SET sort_order = ? WHERE id = ?')
  const tx = db.transaction((sectorIds: string[]) => {
    for (let i = 0; i < sectorIds.length; i++) {
      stmt.run(i, sectorIds[i])
    }
  })
  tx(ids)
}
