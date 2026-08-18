import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import { upsertChunksForItem } from './memory'

export interface ActionStepRow {
  id: string
  item_id: string
  content: string
  is_done: number
  sort_order: number
  effort_value: number | null
  effort_unit: string | null
  actual_effort_value: number | null
  actual_effort_unit: string | null
  created_at: string
  completed_at: string | null
}

export interface ActionStep {
  id: string
  item_id: string
  content: string
  is_done: boolean
  sort_order: number
  effort_value?: number | null
  effort_unit?: string | null
  actual_effort_value?: number | null
  actual_effort_unit?: string | null
  created_at: string
  completed_at: string | null
}

function mapRow(row: ActionStepRow): ActionStep {
  return {
    ...row,
    is_done: Boolean(row.is_done)
  }
}

export function listStepsForItem(itemId: string): ActionStep[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM action_steps 
    WHERE item_id = ? 
    ORDER BY sort_order ASC, created_at ASC
  `).all(itemId) as ActionStepRow[]
  return rows.map(mapRow)
}

export function listAllSteps(): ActionStep[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM action_steps 
    ORDER BY sort_order ASC, created_at ASC
  `).all() as ActionStepRow[]
  return rows.map(mapRow)
}

export function createStep(
  itemId: string, 
  content: string, 
  options?: { effort_value?: number; effort_unit?: string }
): ActionStep {
  const db = getDb()
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Step content cannot be empty')

  const maxOrderRow = db.prepare(`
    SELECT MAX(sort_order) as max_order FROM action_steps WHERE item_id = ?
  `).get(itemId) as { max_order: number | null }
  
  const sortOrder = typeof maxOrderRow?.max_order === 'number' ? maxOrderRow.max_order + 1 : 0
  const id = uuid()
  const now = new Date().toISOString()
  const effortValue = options?.effort_value || null
  const effortUnit = options?.effort_unit || (effortValue ? 'hours' : null)

  db.prepare(`
    INSERT INTO action_steps (id, item_id, content, is_done, sort_order, effort_value, effort_unit, actual_effort_value, actual_effort_unit, created_at, completed_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, NULL, NULL, ?, NULL)
  `).run(id, itemId, trimmed, sortOrder, effortValue, effortUnit, now)

  // Fire-and-forget vector memory sync
  upsertChunksForItem(itemId).catch(err => {
    console.error('[Memory] Step create re-embed error:', err)
  })

  return {
    id,
    item_id: itemId,
    content: trimmed,
    is_done: false,
    sort_order: sortOrder,
    effort_value: effortValue,
    effort_unit: effortUnit,
    actual_effort_value: null,
    actual_effort_unit: null,
    created_at: now,
    completed_at: null
  }
}

export function updateStep(
  id: string, 
  changes: { 
    content?: string
    is_done?: boolean
    sort_order?: number
    effort_value?: number | null
    effort_unit?: string | null
    actual_effort_value?: number | null
    actual_effort_unit?: string | null
  }
): ActionStep {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM action_steps WHERE id = ?').get(id) as ActionStepRow | undefined
  if (!existing) throw new Error(`Action step not found: ${id}`)

  const sets: string[] = []
  const values: any[] = []

  if (changes.content !== undefined) {
    const trimmed = changes.content.trim()
    if (!trimmed) throw new Error('Step content cannot be empty')
    sets.push('content = ?')
    values.push(trimmed)
  }

  if (changes.is_done !== undefined) {
    sets.push('is_done = ?')
    values.push(changes.is_done ? 1 : 0)
    sets.push('completed_at = ?')
    values.push(changes.is_done ? new Date().toISOString() : null)
  }

  if (changes.sort_order !== undefined) {
    sets.push('sort_order = ?')
    values.push(changes.sort_order)
  }

  if (changes.effort_value !== undefined) {
    sets.push('effort_value = ?')
    values.push(changes.effort_value)
  }

  if (changes.effort_unit !== undefined) {
    sets.push('effort_unit = ?')
    values.push(changes.effort_unit)
  }

  if (changes.actual_effort_value !== undefined) {
    sets.push('actual_effort_value = ?')
    values.push(changes.actual_effort_value)
  }

  if (changes.actual_effort_unit !== undefined) {
    sets.push('actual_effort_unit = ?')
    values.push(changes.actual_effort_unit)
  }

  if (sets.length > 0) {
    values.push(id)
    db.prepare(`UPDATE action_steps SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    
    // Fire-and-forget vector memory sync
    upsertChunksForItem(existing.item_id).catch(err => {
      console.error('[Memory] Step update re-embed error:', err)
    })
  }

  const updated = db.prepare('SELECT * FROM action_steps WHERE id = ?').get(id) as ActionStepRow
  return mapRow(updated)
}

export function toggleStep(id: string): ActionStep {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM action_steps WHERE id = ?').get(id) as ActionStepRow | undefined
  if (!existing) throw new Error(`Action step not found: ${id}`)

  const newDone = existing.is_done ? 0 : 1
  const completedAt = newDone ? new Date().toISOString() : null

  db.prepare(`
    UPDATE action_steps 
    SET is_done = ?, completed_at = ?
    WHERE id = ?
  `).run(newDone, completedAt, id)

  // Fire-and-forget vector memory sync
  upsertChunksForItem(existing.item_id).catch(err => {
    console.error('[Memory] Step toggle re-embed error:', err)
  })

  return {
    ...existing,
    is_done: Boolean(newDone),
    completed_at: completedAt
  }
}

export function deleteStep(id: string): void {
  const db = getDb()
  const existing = db.prepare('SELECT item_id FROM action_steps WHERE id = ?').get(id) as { item_id: string } | undefined
  if (!existing) return

  db.prepare('DELETE FROM action_steps WHERE id = ?').run(id)

  // Fire-and-forget vector memory sync
  upsertChunksForItem(existing.item_id).catch(err => {
    console.error('[Memory] Step delete re-embed error:', err)
  })
}

export function reorderSteps(itemId: string, stepIds: string[]): void {
  const db = getDb()
  const updateStmt = db.prepare('UPDATE action_steps SET sort_order = ? WHERE id = ? AND item_id = ?')
  
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((id, idx) => {
      updateStmt.run(idx, id, itemId)
    })
  })
  tx(stepIds)

  // Fire-and-forget vector memory sync
  upsertChunksForItem(itemId).catch(err => {
    console.error('[Memory] Step reorder re-embed error:', err)
  })
}
