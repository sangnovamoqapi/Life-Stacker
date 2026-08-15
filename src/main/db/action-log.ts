import { getDb } from './connection'
import type { ActionLogEntry } from '../../preload/types'

export function listForItem(itemId: string): ActionLogEntry[] {
  const db = getDb()
  return db.prepare('SELECT * FROM action_log WHERE item_id = ? ORDER BY changed_at DESC').all(itemId) as ActionLogEntry[]
}
