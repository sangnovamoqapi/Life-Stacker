import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import type { JournalEntry, JournalAttachment } from '../../preload/types'
import { upsertChunksForJournalEntry } from './memory'

export function createJournalEntry(
  data: { content: string; created_at?: string; parent_id?: string | null },
  attachments?: { file_path: string; media_type: 'image' | 'audio' | 'video' }[]
): JournalEntry {
  const db = getDb()
  const id = uuid()
  const now = data.created_at || new Date().toISOString()
  const parentId = data.parent_id || null

  const entry: JournalEntry = {
    id,
    parent_id: parentId,
    content: data.content,
    created_at: now,
    attachments: []
  }

  db.transaction(() => {
    db.prepare(`
      INSERT INTO journal_entries (id, parent_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, parentId, data.content, now)

    if (attachments && attachments.length > 0) {
      const insertAttach = db.prepare(`
        INSERT INTO journal_attachments (id, entry_id, file_path, media_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const att of attachments) {
        const attId = uuid()
        insertAttach.run(attId, id, att.file_path, att.media_type, now)
        entry.attachments.push({
          id: attId,
          entry_id: id,
          file_path: att.file_path,
          media_type: att.media_type,
          created_at: now
        })
      }
    }
  })()

  // Fire-and-forget embedding generation (never blocks UI or query)
  upsertChunksForJournalEntry(id).catch(err => {
    console.error('[Journal Embedding Error]:', err)
  })

  return entry
}

export function listJournalEntries(): JournalEntry[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, parent_id, content, created_at
    FROM journal_entries
    ORDER BY created_at ASC
  `).all() as { id: string; parent_id?: string | null; content: string; created_at: string }[]

  const attachRows = db.prepare(`
    SELECT id, entry_id, file_path, media_type, created_at
    FROM journal_attachments
    ORDER BY created_at ASC
  `).all() as JournalAttachment[]

  const attachMap: Record<string, JournalAttachment[]> = {}
  for (const a of attachRows) {
    if (!attachMap[a.entry_id]) attachMap[a.entry_id] = []
    attachMap[a.entry_id].push(a)
  }

  return rows.map(r => ({
    id: r.id,
    parent_id: r.parent_id || null,
    content: r.content,
    created_at: r.created_at,
    attachments: attachMap[r.id] || []
  }))
}

export function queryJournalEntriesByDateRange(startDate: string, endDate: string): JournalEntry[] {
  const db = getDb()
  
  // Normalize date boundaries for inclusive filtering (e.g. YYYY-MM-DD or ISO strings)
  const startIso = startDate.length === 10 ? `${startDate}T00:00:00.000Z` : startDate
  const endIso = endDate.length === 10 ? `${endDate}T23:59:59.999Z` : endDate

  const rows = db.prepare(`
    SELECT id, parent_id, content, created_at
    FROM journal_entries
    WHERE created_at >= ? AND created_at <= ?
    ORDER BY created_at ASC
  `).all(startIso, endIso) as { id: string; parent_id?: string | null; content: string; created_at: string }[]

  const attachRows = db.prepare(`
    SELECT id, entry_id, file_path, media_type, created_at
    FROM journal_attachments
    ORDER BY created_at ASC
  `).all() as JournalAttachment[]

  const attachMap: Record<string, JournalAttachment[]> = {}
  for (const a of attachRows) {
    if (!attachMap[a.entry_id]) attachMap[a.entry_id] = []
    attachMap[a.entry_id].push(a)
  }

  return rows.map(r => ({
    id: r.id,
    parent_id: r.parent_id || null,
    content: r.content,
    created_at: r.created_at,
    attachments: attachMap[r.id] || []
  }))
}

export function deleteJournalEntry(id: string): { success: boolean } {
  const db = getDb()
  db.transaction(() => {
    // Delete all child entries recursively if any
    const childIds = (db.prepare('SELECT id FROM journal_entries WHERE parent_id = ?').all(id) as { id: string }[]).map(c => c.id)
    for (const childId of childIds) {
      deleteJournalEntry(childId)
    }
    db.prepare('DELETE FROM journal_attachments WHERE entry_id = ?').run(id)
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
    db.prepare('DELETE FROM memory_chunks WHERE source_id = ?').run(id)
  })()
  return { success: true }
}
