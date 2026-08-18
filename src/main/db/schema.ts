import { getDb } from './connection'
import { v4 as uuid } from 'uuid'

export function initDb(): void {
  const db = getDb()

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
  `)

  // Migrations
  const stepsTableInfo = db.prepare("PRAGMA table_info('action_steps')").all() as { name: string }[]
  if (!stepsTableInfo.some(c => c.name === 'effort_value')) {
    db.exec(`
      ALTER TABLE action_steps ADD COLUMN effort_value REAL;
      ALTER TABLE action_steps ADD COLUMN effort_unit TEXT;
      ALTER TABLE action_steps ADD COLUMN actual_effort_value REAL;
      ALTER TABLE action_steps ADD COLUMN actual_effort_unit TEXT;
    `)
  }

  const itemsTableInfo = db.prepare("PRAGMA table_info('items')").all() as { name: string }[]
  if (!itemsTableInfo.some(c => c.name === 'priority_rank')) {
    db.exec(`
      ALTER TABLE items ADD COLUMN priority_rank INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN next_action TEXT;
    `)
  }

  // Migrate existing items.next_action into action_steps if action_steps is empty
  const countSteps = db.prepare('SELECT count(*) as count FROM action_steps').get() as { count: number }
  if (countSteps.count === 0) {
    const itemsWithNextAction = db.prepare("SELECT id, next_action FROM items WHERE next_action IS NOT NULL AND next_action != ''").all() as { id: string; next_action: string }[]
    const insertStep = db.prepare(`
      INSERT INTO action_steps (id, item_id, content, is_done, sort_order, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    for (const it of itemsWithNextAction) {
      const raw = it.next_action.trim()
      let parsedSteps: { text: string; completed: boolean }[] = []
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) {
            parsedSteps = arr.map(s => ({ text: String(s.text || ''), completed: Boolean(s.completed) }))
          }
        } catch {
          // fallback
        }
      }
      if (parsedSteps.length === 0) {
        const lines = raw.split('\n').filter(l => l.trim().length > 0)
        parsedSteps = lines.map(line => {
          let text = line.trim()
          let completed = false
          if (text.startsWith('- [x] ') || text.startsWith('- [X] ')) {
            completed = true
            text = text.substring(6)
          } else if (text.startsWith('- [ ] ')) {
            completed = false
            text = text.substring(6)
          } else if (text.startsWith('→ ') || text.startsWith('- ') || text.startsWith('* ')) {
            text = text.substring(2)
          }
          return { text, completed }
        })
      }

      parsedSteps.forEach((s, idx) => {
        if (!s.text.trim()) return
        const now = new Date().toISOString()
        insertStep.run(
          uuid(),
          it.id,
          s.text.trim(),
          s.completed ? 1 : 0,
          idx,
          now,
          s.completed ? now : null
        )
      })
    }
  }

  const sectorsTableInfo = db.prepare("PRAGMA table_info('sectors')").all() as { name: string }[]
  if (!sectorsTableInfo.some(c => c.name === 'icon')) {
    db.exec(`ALTER TABLE sectors ADD COLUMN icon TEXT;`)
  }

  // Update default icons for standard sector names if icon is null
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

  // Convert someday and queued to active
  db.prepare(`UPDATE items SET status = 'active' WHERE status = 'someday' OR status = 'queued'`).run()

  // Seed default sectors if empty
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

  // Seed default settings if empty
  const defaultSettings = [
    { key: 'focus_limit', value: JSON.stringify(5) },
    { key: 'stale_threshold_days', value: JSON.stringify(14) },
    { key: 'launch_at_login', value: JSON.stringify(true) }
  ]
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)')
  for (const s of defaultSettings) insertSetting.run(s)

  const reviewSettings = [
    { key: 'stack_review_enabled', value: JSON.stringify(true) },
    { key: 'stack_review_day', value: JSON.stringify(0) },
    { key: 'stack_review_time', value: JSON.stringify('18:00') },
    { key: 'glass_intensity', value: JSON.stringify(65) },
    { key: 'background_config', value: JSON.stringify({ type: 'gradient', value: `radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d` }) }
  ]
  for (const s of reviewSettings) insertSetting.run(s)

  // Migration: if old reduce_transparency exists, map to glass_intensity (true -> 15, false -> 65) then delete key
  try {
    const oldReduce = db.prepare(`SELECT value FROM settings WHERE key = 'reduce_transparency'`).get() as { value: string } | undefined
    if (oldReduce) {
      const isReduced = JSON.parse(oldReduce.value) === true
      const migratedIntensity = isReduced ? 15 : 65
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('glass_intensity', ?)`).run(JSON.stringify(migratedIntensity))
      db.prepare(`DELETE FROM settings WHERE key = 'reduce_transparency'`).run()
    }
  } catch (err) {
    console.error('Migration error for reduce_transparency:', err)
  }

  // Assign sequential priority_rank for items that have 0
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
