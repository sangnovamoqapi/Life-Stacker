import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import * as sqliteVec from 'sqlite-vec'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'lifestack.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    try {
      sqliteVec.load(db)
    } catch (e) {
      console.error('[Database] Failed to load sqlite-vec extension:', e)
    }
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
