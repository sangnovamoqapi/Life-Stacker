import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

function backupDatabase(): void {
  try {
    const userDataPath = app?.getPath ? app.getPath('userData') : path.join(process.env.APPDATA || '', 'lifestack')
    const dbFile = path.join(userDataPath, 'lifestack.db')
    if (fs.existsSync(dbFile)) {
      const backupDir = path.join(userDataPath, 'backups')
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupDir, `lifestack_pre_phase0_${timestamp}.db`)
      fs.copyFileSync(dbFile, backupPath)
      console.log(`[Backup] Successfully created database backup: ${backupPath}`)
    }
  } catch (err) {
    console.error('[Backup Error] Failed to create database backup:', err)
  }
}

export function initDb(): void {
  // 1. Take a safe automated backup before any schema changes
  backupDatabase()

  const db = getDb()

  // 2. Base tables creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT NOT NULL,
      notif_enabled INTEGER DEFAULT 1,
      notif_cadence TEXT NOT NULL,
      notif_interval_days INTEGER,
      notif_weekdays TEXT,
      notif_time TEXT NOT NULL,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      sector_id TEXT NOT NULL REFERENCES sectors(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS explore_items (
      id TEXT PRIMARY KEY,
      epic_id TEXT NOT NULL REFERENCES items(id),
      title TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      time_estimate_value REAL,
      time_estimate_unit TEXT,
      closed INTEGER NOT NULL DEFAULT 0,
      last_touched_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS next_items (
      id TEXT PRIMARY KEY,
      epic_id TEXT NOT NULL REFERENCES items(id),
      parent_explore_id TEXT REFERENCES explore_items(id),
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'next',
      time_estimate_value REAL,
      time_estimate_unit TEXT,
      actual_effort_value REAL,
      actual_effort_unit TEXT,
      due_date TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS effort_log (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      logged_at TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      from_item_id TEXT NOT NULL REFERENCES items(id),
      to_item_id TEXT NOT NULL REFERENCES items(id),
      relation_type TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edge_log (
      id TEXT PRIMARY KEY,
      edge_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_relation_type TEXT,
      new_relation_type TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_chunks (
      id TEXT PRIMARY KEY,
      vec_rowid INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_steps (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      content TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      effort_value REAL,
      effort_unit TEXT,
      actual_effort_value REAL,
      actual_effort_unit TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
      embedding float[768]
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_actions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES chat_messages(id),
      tool_name TEXT NOT NULL,
      arguments TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_at TEXT
    );
  `)

  // 3. Schema Migrations (Column additions)
  const itemsTableInfo = db.prepare("PRAGMA table_info('items')").all() as { name: string }[]
  if (!itemsTableInfo.some(c => c.name === 'priority_rank')) {
    db.exec(`
      ALTER TABLE items ADD COLUMN priority_rank INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN next_action TEXT;
    `)
  }
  if (!itemsTableInfo.some(c => c.name === 'time_budget')) {
    db.exec(`ALTER TABLE items ADD COLUMN time_budget TEXT;`)
  }

  const sectorsTableInfo = db.prepare("PRAGMA table_info('sectors')").all() as { name: string }[]
  if (!sectorsTableInfo.some(c => c.name === 'icon')) {
    db.exec(`ALTER TABLE sectors ADD COLUMN icon TEXT;`)
  }

  const exploreTableInfo = db.prepare("PRAGMA table_info('explore_items')").all() as { name: string }[]
  if (!exploreTableInfo.some(c => c.name === 'title')) {
    db.exec(`ALTER TABLE explore_items ADD COLUMN title TEXT NOT NULL DEFAULT '';`)
  }

  // 4. Migrate action_steps -> next_items (Idempotent)
  const countNext = db.prepare('SELECT count(*) as count FROM next_items').get() as { count: number }
  const countActionSteps = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='action_steps'").get() as { count: number }
  if (countActionSteps.count > 0 && countNext.count === 0) {
    const existingSteps = db.prepare('SELECT * FROM action_steps').all() as any[]
    if (existingSteps.length > 0) {
      const insertNext = db.prepare(`
        INSERT INTO next_items (
          id, epic_id, parent_explore_id, title, notes, status,
          time_estimate_value, time_estimate_unit, actual_effort_value, actual_effort_unit,
          due_date, sort_order, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      db.transaction(() => {
        for (const s of existingSteps) {
          const status = s.is_done ? 'done' : 'next'
          insertNext.run(
            s.id,
            s.item_id,
            null,
            s.content,
            null,
            status,
            s.effort_value ?? null,
            s.effort_unit ?? null,
            s.actual_effort_value ?? null,
            s.actual_effort_unit ?? null,
            null,
            s.sort_order ?? 0,
            s.created_at || new Date().toISOString(),
            s.completed_at || null
          )
        }
      })()
      console.log(`[Migration] Successfully migrated ${existingSteps.length} action_steps rows to next_items.`)
    }
  }

  // 5. Update default icons for standard sector names if icon is null
  const defaultSectorIcons: Record<string, string> = {
    'Career': '💼',
    'Learning': '🎓',
    'Health': '💚',
    'Side Projects': '🚀',
    'Relationships': '👥',
    'Home & Admin': '🏠'
  }
  for (const [sName, sIcon] of Object.entries(defaultSectorIcons)) {
    db.prepare(`UPDATE sectors SET icon = ? WHERE name = ? AND (icon IS NULL OR icon = '')`).run(sIcon, sName)
  }

  // 6. Seed default sectors if empty
  const countSectors = db.prepare('SELECT count(*) as count FROM sectors').get() as { count: number }
  if (countSectors.count === 0) {
    const defaultSectors = [
      { id: uuid(), name: 'Career', icon: '💼', color: 'sector-0', notif_enabled: 1, notif_cadence: 'daily', notif_interval_days: null, notif_weekdays: null, notif_time: '09:00', sort_order: 0 },
      { id: uuid(), name: 'Learning', icon: '🎓', color: 'sector-2', notif_enabled: 1, notif_cadence: 'every_n_days', notif_interval_days: 14, notif_weekdays: null, notif_time: '09:00', sort_order: 1 },
      { id: uuid(), name: 'Health', icon: '💚', color: 'sector-3', notif_enabled: 1, notif_cadence: 'daily', notif_interval_days: null, notif_weekdays: null, notif_time: '09:00', sort_order: 2 },
      { id: uuid(), name: 'Side Projects', icon: '🚀', color: 'sector-5', notif_enabled: 1, notif_cadence: 'weekdays', notif_interval_days: null, notif_weekdays: '[6,0]', notif_time: '10:00', sort_order: 3 },
      { id: uuid(), name: 'Relationships', icon: '👥', color: 'sector-1', notif_enabled: 1, notif_cadence: 'daily', notif_interval_days: null, notif_weekdays: null, notif_time: '09:00', sort_order: 4 },
      { id: uuid(), name: 'Home & Admin', icon: '🏠', color: 'sector-4', notif_enabled: 1, notif_cadence: 'daily', notif_interval_days: null, notif_weekdays: null, notif_time: '09:00', sort_order: 5 }
    ]
    const insertSector = db.prepare(`
      INSERT INTO sectors (id, name, icon, color, notif_enabled, notif_cadence, notif_interval_days, notif_weekdays, notif_time, sort_order)
      VALUES (@id, @name, @icon, @color, @notif_enabled, @notif_cadence, @notif_interval_days, @notif_weekdays, @notif_time, @sort_order)
    `)
    const tx = db.transaction((sectors: typeof defaultSectors) => {
      for (const s of sectors) insertSector.run(s)
    })
    tx(defaultSectors)
  }

  // 7. Seed & Migrate Settings
  // Evolve focus_limit -> active_epic_cap
  try {
    const focusLimitRow = db.prepare(`SELECT value FROM settings WHERE key = 'focus_limit'`).get() as { value: string } | undefined
    const activeCapRow = db.prepare(`SELECT value FROM settings WHERE key = 'active_epic_cap'`).get() as { value: string } | undefined
    if (focusLimitRow && !activeCapRow) {
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('active_epic_cap', ?)`).run(focusLimitRow.value)
    }
  } catch (err) {
    console.error('Settings migration error for active_epic_cap:', err)
  }

  const phase0Settings = [
    { key: 'active_epic_cap', value: JSON.stringify(5) },
    { key: 'focus_limit', value: JSON.stringify(5) }, // keep for backward compat
    { key: 'today_cap', value: JSON.stringify(3) },
    { key: 'weekly_personal_hours', value: JSON.stringify(null) },
    { key: 'burn_tracking_enabled', value: JSON.stringify(true) },
    { key: 'stale_threshold_days', value: JSON.stringify(14) },
    { key: 'launch_at_login', value: JSON.stringify(true) },
    { key: 'stack_review_enabled', value: JSON.stringify(true) },
    { key: 'stack_review_day', value: JSON.stringify(0) },
    { key: 'stack_review_time', value: JSON.stringify('18:00') },
    { key: 'glass_intensity', value: JSON.stringify(65) },
    { key: 'background_config', value: JSON.stringify({ type: 'gradient', value: `radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d` }) },
    { key: 'chat_model', value: JSON.stringify('llama3.2:3b') }
  ]
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)')
  for (const s of phase0Settings) insertSetting.run(s)

  // 8. Assign sequential priority_rank for items that have 0
  const unrankedItems = db.prepare('SELECT id FROM items WHERE priority_rank = 0 ORDER BY created_at ASC').all() as { id: string }[]
  if (unrankedItems.length > 0) {
    const maxRankRes = db.prepare('SELECT MAX(priority_rank) as maxRank FROM items').get() as { maxRank: number | null }
    let nextRank = (maxRankRes.maxRank || 0) + 1
    const updateRank = db.prepare('UPDATE items SET priority_rank = ? WHERE id = ?')
    db.transaction(() => {
      for (const item of unrankedItems) {
        updateRank.run(nextRank++, item.id)
      }
    })()
  }
}
