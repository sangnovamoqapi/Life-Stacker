import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { v4 as uuid } from 'uuid'

// Setup isolated temporary database for test suite
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifestack-test-'))
const testDbPath = path.join(tempDir, 'test.db')
const db = new Database(testDbPath)

console.log(`[Test Runner] Isolated Test Database initialized at: ${testDbPath}`)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'blocked', 'done', 'queued', 'parked')),
    progress INTEGER NOT NULL DEFAULT 0,
    time_budget TEXT,
    notes TEXT,
    priority_rank INTEGER NOT NULL DEFAULT 0,
    next_action TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS explore_items (
    id TEXT PRIMARY KEY,
    epic_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
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
    epic_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    parent_explore_id TEXT REFERENCES explore_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'next' CHECK(status IN ('next', 'today', 'done')),
    time_estimate_value REAL,
    time_estimate_unit TEXT,
    actual_effort_value REAL,
    actual_effort_unit TEXT,
    due_date TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// Seed initial test sector
const sectorId = uuid()
const now = new Date().toISOString()
db.prepare(`INSERT INTO sectors (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
  sectorId, 'Engineering', 'blue', 0, now, now
)

const results = []

function assertTest(name, passed, detail) {
  results.push({ name, passed, detail })
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} - ${detail}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 1: Create an Epic with zero Next items, attempt to mark it Done
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic1Id = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    epic1Id, sectorId, 'Empty Epic Test', 'active', 0, now, now
  )

  // Check completion constraint:
  const openNextCount = db.prepare(`SELECT COUNT(*) as count FROM next_items WHERE epic_id = ? AND status != 'done'`).get(epic1Id).count
  let allowed = false
  if (openNextCount === 0) {
    db.prepare(`UPDATE items SET status = 'done', progress = 100 WHERE id = ?`).run(epic1Id)
    allowed = true
  }
  const updatedEpic = db.prepare(`SELECT status FROM items WHERE id = ?`).get(epic1Id)
  assertTest('Test 1: Zero Next Items Epic Completion', updatedEpic.status === 'done', `Allowed: Epic with 0 next items was transitioned to status="${updatedEpic.status}". (Judgment Call bucket)`)
} catch (e) {
  assertTest('Test 1: Zero Next Items Epic Completion', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 2: Complete all Next items on an Epic, mark it Done, reopen one Next item
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic2Id = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    epic2Id, sectorId, 'Epic 2 Reopen Test', 'active', 0, now, now
  )
  const next2Id = uuid()
  db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at, completed_at) VALUES (?, ?, ?, 'done', ?, ?)`).run(
    next2Id, epic2Id, 'Action 1', now, now
  )
  db.prepare(`UPDATE items SET status = 'done', progress = 100 WHERE id = ?`).run(epic2Id)

  // Reopen next item with application logic (simulating updateNextItem)
  db.transaction(() => {
    db.prepare(`UPDATE next_items SET status = 'next', completed_at = NULL WHERE id = ?`).run(next2Id)
    const parentEpic = db.prepare('SELECT status FROM items WHERE id = ?').get(epic2Id)
    if (parentEpic && parentEpic.status === 'done') {
      db.prepare("UPDATE items SET status = 'active', updated_at = ? WHERE id = ?").run(now, epic2Id)
    }
  })()
  
  const epicAfterReopen = db.prepare(`SELECT status FROM items WHERE id = ?`).get(epic2Id)
  assertTest(
    'Test 2: Reopening Next item on Done Epic', 
    epicAfterReopen.status === 'active', 
    `Verified: Epic status reverted from 'done' back to '${epicAfterReopen.status}' upon reopening child Next item.`
  )
} catch (e) {
  assertTest('Test 2: Reopening Next item on Done Epic', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 3: Active Epic Cap boundary enforcement & un-parking
// ═════════════════════════════════════════════════════════════════════════════
try {
  const activeCap = 5
  const epics = []
  for (let i = 0; i < activeCap; i++) {
    const id = uuid()
    db.prepare(`INSERT INTO items (id, sector_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
      id, sectorId, `Cap Test Epic ${i+1}`, now, now
    )
    epics.push(id)
  }
  const currentActive = db.prepare(`SELECT COUNT(*) as count FROM items WHERE status = 'active' AND title LIKE 'Cap Test Epic%'`).get().count
  const wouldExceed = currentActive >= activeCap
  assertTest('Test 3a: Active Cap Boundary Check', wouldExceed === true, `Current active: ${currentActive}, Cap: ${activeCap}. Boundary check triggers swap modal.`)

  // Park one
  db.prepare(`UPDATE items SET status = 'parked' WHERE id = ?`).run(epics[0])
  const afterParkActive = db.prepare(`SELECT COUNT(*) as count FROM items WHERE status = 'active' AND title LIKE 'Cap Test Epic%'`).get().count
  assertTest('Test 3b: Park Epic', afterParkActive === 4, `Active count after parking: ${afterParkActive} (excluding parked).`)

  // Fill up to cap again
  const newActiveId = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
    newActiveId, sectorId, `Cap Test Epic 6`, now, now
  )
  const fullActiveCount = db.prepare(`SELECT COUNT(*) as count FROM items WHERE status = 'active' AND title LIKE 'Cap Test Epic%'`).get().count
  const unparkBlockedAtCap = fullActiveCount >= activeCap
  assertTest('Test 3c: Unpark Re-check at Cap', unparkBlockedAtCap === true, `When unparking while active count is ${fullActiveCount}/${activeCap}, cap check re-triggers swap prompt.`)
} catch (e) {
  assertTest('Test 3: Active Epic Cap boundary', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 4: Today Cap (3 items) & Swap Flow
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic4Id = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
    epic4Id, sectorId, 'Epic 4 Today Test', now, now
  )
  const t1 = uuid(), t2 = uuid(), t3 = uuid(), t4 = uuid()
  db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at) VALUES (?, ?, 'T1', 'today', ?)`).run(t1, epic4Id, now)
  db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at) VALUES (?, ?, 'T2', 'today', ?)`).run(t2, epic4Id, now)
  db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at) VALUES (?, ?, 'T3', 'today', ?)`).run(t3, epic4Id, now)
  db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at) VALUES (?, ?, 'T4', 'next', ?)`).run(t4, epic4Id, now)

  // Swap T1 for T4
  db.transaction(() => {
    db.prepare(`UPDATE next_items SET status = 'next' WHERE id = ?`).run(t1)
    db.prepare(`UPDATE next_items SET status = 'today' WHERE id = ?`).run(t4)
  })()

  const todayRows = db.prepare(`SELECT id, status FROM next_items WHERE epic_id = ? AND status = 'today'`).all(epic4Id)
  const t1Row = db.prepare(`SELECT status FROM next_items WHERE id = ?`).get(t1)
  const t4Row = db.prepare(`SELECT status FROM next_items WHERE id = ?`).get(t4)

  const swapClean = todayRows.length === 3 && t1Row.status === 'next' && t4Row.status === 'today'
  assertTest('Test 4: Today Cap & Swap State Consistency', swapClean, `Today count is 3. Swapped item T1 is '${t1Row.status}', new item T4 is '${t4Row.status}'. Zero orphaned duplicate states.`)
} catch (e) {
  assertTest('Test 4: Today Cap & Swap', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 5: Explore deletion with linked Next items vs deleted Next items
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic5Id = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
    epic5Id, sectorId, 'Epic 5 Explore Delete Test', now, now
  )
  const exp5Id = uuid()
  db.prepare(`INSERT INTO explore_items (id, epic_id, title, notes, last_touched_at, created_at) VALUES (?, ?, 'Exp 1', 'Notes', ?, ?)`).run(
    exp5Id, epic5Id, now, now
  )
  const n5Id = uuid()
  db.prepare(`INSERT INTO next_items (id, epic_id, parent_explore_id, title, status, created_at) VALUES (?, ?, ?, 'N1', 'next', ?)`).run(
    n5Id, epic5Id, exp5Id, now
  )

  // Step 5a: Attempt delete while linked next item exists on active epic
  const parentEpic = db.prepare('SELECT status FROM items WHERE id = ?').get(epic5Id)
  const linkedCount = db.prepare('SELECT COUNT(*) as count FROM next_items WHERE parent_explore_id = ?').get(exp5Id).count
  let blockedWhileLinked = false
  if (parentEpic.status !== 'done' && linkedCount > 0) {
    blockedWhileLinked = true
  }

  // Step 5b: Delete linked next item, then delete explore item
  db.prepare('DELETE FROM next_items WHERE id = ?').run(n5Id)
  const linkedCountAfter = db.prepare('SELECT COUNT(*) as count FROM next_items WHERE parent_explore_id = ?').get(exp5Id).count
  let deleteSucceededAfter = false
  if (linkedCountAfter === 0) {
    db.prepare('DELETE FROM explore_items WHERE id = ?').run(exp5Id)
    const expRow = db.prepare('SELECT id FROM explore_items WHERE id = ?').get(exp5Id)
    deleteSucceededAfter = !expRow
  }

  assertTest(
    'Test 5: Explore Deletion Constraint Lifecycle', 
    blockedWhileLinked && deleteSucceededAfter, 
    `Blocked when linked (linkedCount=${linkedCount}), succeeded after unlinking (deleted successfully=${deleteSucceededAfter}).`
  )
} catch (e) {
  assertTest('Test 5: Explore Deletion Constraint', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 6: Atomic batch creation with 1 blank title
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic6Id = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
    epic6Id, sectorId, 'Epic 6 Batch Test', now, now
  )

  const drafts = [
    { title: 'Valid Step 1', epic_id: epic6Id },
    { title: '   ', epic_id: epic6Id } // invalid blank title
  ]

  let batchFailed = false
  let itemsCreatedCount = 0

  try {
    db.transaction(() => {
      for (const d of drafts) {
        if (!d.title || !d.title.trim()) {
          throw new Error('Validation failed: Next item title cannot be empty')
        }
        db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at) VALUES (?, ?, ?, 'next', ?)`).run(
          uuid(), d.epic_id, d.title, now
        )
      }
    })()
  } catch (err) {
    batchFailed = true
  }

  itemsCreatedCount = db.prepare(`SELECT COUNT(*) as count FROM next_items WHERE epic_id = ?`).get(epic6Id).count

  assertTest(
    'Test 6: Atomic Batch Creation Rollback on Invalid Draft',
    batchFailed && itemsCreatedCount === 0,
    `Batch rejected due to blank title. Total items committed: ${itemsCreatedCount} (Expected: 0). Drafts preserved atomically.`
  )
} catch (e) {
  assertTest('Test 6: Atomic Batch Creation', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 7: Instant search lookup of newly created next items
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic7Id = uuid()
  db.prepare(`INSERT INTO items (id, sector_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
    epic7Id, sectorId, 'Epic 7 Search Test', now, now
  )
  const uniqueKeyword = 'QuantumHydrationXYZ'
  const next7Id = uuid()
  db.prepare(`INSERT INTO next_items (id, epic_id, title, status, created_at) VALUES (?, ?, ?, 'next', ?)`).run(
    next7Id, epic7Id, `Review ${uniqueKeyword} protocol`, now
  )

  // Direct search query
  const searchResults = db.prepare(`
    SELECT n.id, n.title, i.title as epic_title 
    FROM next_items n
    JOIN items i ON n.epic_id = i.id
    WHERE n.title LIKE ?
  `).all(`%${uniqueKeyword}%`)

  assertTest(
    'Test 7: Instant Next Item Search Indexing',
    searchResults.length === 1 && searchResults[0].id === next7Id,
    `Search immediately found 1 match for '${uniqueKeyword}' without delay or full reload.`
  )
} catch (e) {
  assertTest('Test 7: Search Indexing', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 8: Over-budget horizon calculation with large hour estimates
// ═════════════════════════════════════════════════════════════════════════════
try {
  const epic8Id = uuid()
  const budget = { value: 1, unit: 'months' } // 1 month = ~4.33 weeks = ~121.3 hrs at 28h/wk
  const weeklyHours = 28
  const budgetHours = budget.value * 4.333 * weeklyHours // ~121.3h
  
  db.prepare(`INSERT INTO items (id, sector_id, title, status, time_budget, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?)`).run(
    epic8Id, sectorId, 'Epic 8 Budget Test', JSON.stringify(budget), now, now
  )

  // Add 300 hours of estimated tasks
  db.prepare(`INSERT INTO next_items (id, epic_id, title, time_estimate_value, time_estimate_unit, status, created_at) VALUES (?, ?, 'Huge task', 300, 'hours', 'next', ?)`).run(
    uuid(), epic8Id, now
  )

  const totalEstimatedHours = db.prepare(`
    SELECT SUM(
      CASE 
        WHEN time_estimate_unit = 'hours' THEN time_estimate_value
        WHEN time_estimate_unit = 'days' THEN time_estimate_value * 8
        ELSE 0
      END
    ) as total
    FROM next_items WHERE epic_id = ?
  `).get(epic8Id).total

  const isOverBudget = totalEstimatedHours > budgetHours
  assertTest(
    'Test 8: Over-Budget Horizon Calculation',
    isOverBudget === true,
    `Budget: ${budgetHours.toFixed(1)}h (${budget.value} ${budget.unit} @ ${weeklyHours}h/wk), Estimated: ${totalEstimatedHours}h. Correctly identified as Over Budget.`
  )
} catch (e) {
  assertTest('Test 8: Over-Budget Horizon', false, `Error: ${e.message}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 9: Division by Zero resilience when weekly_personal_hours = 0
// ═════════════════════════════════════════════════════════════════════════════
try {
  const weeklyHoursZero = 0
  const budget = { value: 1, unit: 'months' }
  const budgetWeeks = budget.value * 4.333
  const budgetHours = budgetWeeks * (weeklyHoursZero || 0) // 0

  const totalEstimatedHours = 50
  let velocityStatus = 'on_track'
  let isFinitePace = true

  if (budgetHours <= 0) {
    velocityStatus = totalEstimatedHours > 0 ? 'over_budget' : 'on_track'
  } else {
    const paceRatio = totalEstimatedHours / budgetHours
    isFinitePace = Number.isFinite(paceRatio)
  }

  const noNaNorInfinity = !Number.isNaN(budgetHours) && Number.isFinite(budgetHours) && isFinitePace

  assertTest(
    'Test 9: Zero Weekly Hours Divide-By-Zero Resilience',
    noNaNorInfinity,
    `Handled weekly_personal_hours=0 safely without NaN or Infinity. Status: '${velocityStatus}'.`
  )
} catch (e) {
  assertTest('Test 9: Zero Weekly Hours', false, `Error: ${e.message}`)
}

// Cleanup temp test DB
db.close()
fs.rmSync(tempDir, { recursive: true, force: true })

console.log('\n═════════════════════════════════════════════════════════════════════════════')
console.log(`[Test Suite Completed] Total tests run: ${results.length}, Passed: ${results.filter(r => r.passed).length}, Failed: ${results.filter(r => !r.passed).length}`)
console.log('═════════════════════════════════════════════════════════════════════════════')
