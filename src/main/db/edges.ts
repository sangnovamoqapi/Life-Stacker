import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { Edge, NewEdge, EdgeWithDetails, EdgeLogEntry } from '../../preload/types'

export function createEdge(data: NewEdge): Edge {
  const db = getDb()
  const now = new Date().toISOString()
  const id = uuid()

  const edge: Edge = {
    id,
    from_item_id: data.from_item_id,
    to_item_id: data.to_item_id,
    relation_type: data.relation_type,
    note: data.note ?? null,
    created_at: now
  }

  db.transaction(() => {
    db.prepare(`
      INSERT INTO edges (id, from_item_id, to_item_id, relation_type, note, created_at)
      VALUES (@id, @from_item_id, @to_item_id, @relation_type, @note, @created_at)
    `).run(edge)

    db.prepare(`
      INSERT INTO edge_log (id, edge_id, action, old_relation_type, new_relation_type, changed_at)
      VALUES (?, ?, 'created', NULL, ?, ?)
    `).run(uuid(), id, data.relation_type, now)
  })()

  return edge
}

export function listEdgesForItem(itemId: string): { outgoing: EdgeWithDetails[]; incoming: EdgeWithDetails[] } {
  const db = getDb()

  const outgoingQuery = `
    SELECT 
      e.*,
      i.title as target_item_title,
      i.status as target_item_status
    FROM edges e
    JOIN items i ON e.to_item_id = i.id
    WHERE e.from_item_id = ?
    ORDER BY e.created_at DESC
  `
  const outgoing = db.prepare(outgoingQuery).all(itemId) as EdgeWithDetails[]

  const incomingQuery = `
    SELECT 
      e.*,
      i.title as source_item_title,
      i.status as source_item_status
    FROM edges e
    JOIN items i ON e.from_item_id = i.id
    WHERE e.to_item_id = ?
    ORDER BY e.created_at DESC
  `
  const incoming = db.prepare(incomingQuery).all(itemId) as EdgeWithDetails[]

  return { outgoing, incoming }
}

export function deleteEdge(edgeId: string): boolean {
  const db = getDb()
  const current = db.prepare('SELECT * FROM edges WHERE id = ?').get(edgeId) as Edge | undefined
  if (!current) return false

  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare('DELETE FROM edges WHERE id = ?').run(edgeId)
    db.prepare(`
      INSERT INTO edge_log (id, edge_id, action, old_relation_type, new_relation_type, changed_at)
      VALUES (?, ?, 'deleted', ?, NULL, ?)
    `).run(uuid(), edgeId, current.relation_type, now)
  })()

  return true
}

export function retypeEdge(edgeId: string, newRelationType: string): Edge {
  const db = getDb()
  const current = db.prepare('SELECT * FROM edges WHERE id = ?').get(edgeId) as Edge | undefined
  if (!current) throw new Error(`Edge not found: ${edgeId}`)

  const now = new Date().toISOString()
  const updated: Edge = {
    ...current,
    relation_type: newRelationType
  }

  db.transaction(() => {
    db.prepare('UPDATE edges SET relation_type = ? WHERE id = ?').run(newRelationType, edgeId)
    db.prepare(`
      INSERT INTO edge_log (id, edge_id, action, old_relation_type, new_relation_type, changed_at)
      VALUES (?, ?, 'retyped', ?, ?, ?)
    `).run(uuid(), edgeId, current.relation_type, newRelationType, now)
  })()

  return updated
}

export function listEdgeLogs(edgeId?: string): EdgeLogEntry[] {
  const db = getDb()
  if (edgeId) {
    return db.prepare('SELECT * FROM edge_log WHERE edge_id = ? ORDER BY changed_at DESC').all(edgeId) as EdgeLogEntry[]
  }
  return db.prepare('SELECT * FROM edge_log ORDER BY changed_at DESC').all() as EdgeLogEntry[]
}
