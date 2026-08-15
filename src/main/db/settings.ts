import { getDb } from './connection'

export function get<T = unknown>(key: string): T | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

export function set(key: string, value: unknown): void {
  const db = getDb()
  const strValue = JSON.stringify(value)
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, strValue)
}
