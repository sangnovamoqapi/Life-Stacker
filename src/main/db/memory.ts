import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import * as ollamaClient from '../ai/ollama-client'
import type { Item, MemorySearchResult } from '../../preload/types'
import { parseChecklist } from '../../renderer/src/utils/checklist'

export function chunkText(text: string, maxTokens: number = 250, overlapRatio: number = 0.2): string[] {
  if (!text || text.trim().length === 0) return []

  const words = text.trim().split(/\s+/)
  if (words.length <= maxTokens) {
    return [words.join(' ')]
  }

  const chunks: string[] = []
  const step = Math.max(1, Math.floor(maxTokens * (1 - overlapRatio)))
  
  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + maxTokens)
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '))
    }
    if (i + maxTokens >= words.length) break
  }

  return chunks
}

export async function upsertChunksForItem(itemId: string): Promise<void> {
  const db = getDb()
  
  try {
    // 1. Fetch current item
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Item | undefined

    // 2. Fetch and delete existing chunks for this item
    const existingChunks = db.prepare('SELECT vec_rowid FROM memory_chunks WHERE source_id = ?').all(itemId) as { vec_rowid: number }[]
    
    if (existingChunks.length > 0) {
      const deleteVectorsStmt = db.prepare('DELETE FROM chunk_vectors WHERE rowid = ?')
      const deleteChunksStmt = db.prepare('DELETE FROM memory_chunks WHERE source_id = ?')
      
      db.transaction(() => {
        for (const c of existingChunks) {
          try {
            deleteVectorsStmt.run(c.vec_rowid)
          } catch {
            // Ignore if vector was already removed
          }
        }
        deleteChunksStmt.run(itemId)
      })()
    }

    if (!item) return

    // 3. Extract and format searchable text from Next Items & Explore Items
    const nextItems = db.prepare(`
      SELECT title, status, notes FROM next_items 
      WHERE epic_id = ? 
      ORDER BY sort_order ASC
    `).all(itemId) as { title: string; status: string; notes: string | null }[]

    let nextActionText = ''
    if (nextItems.length > 0) {
      nextActionText = nextItems.map(s => `${s.status === 'done' ? '[x]' : '[ ]'} ${s.title}${s.notes ? ` (${s.notes})` : ''}`).join('; ')
    } else {
      // Fallback check on action_steps if next_items not yet populated
      try {
        const legacySteps = db.prepare(`
          SELECT content, is_done FROM action_steps 
          WHERE item_id = ? 
          ORDER BY sort_order ASC
        `).all(itemId) as { content: string; is_done: number }[]
        if (legacySteps.length > 0) {
          nextActionText = legacySteps.map(s => `${s.is_done ? '[x]' : '[ ]'} ${s.content}`).join('; ')
        } else if (item.next_action) {
          try {
            const parsed = parseChecklist(item.next_action)
            nextActionText = parsed.map(p => p.text).join('; ')
          } catch {
            nextActionText = item.next_action
          }
        }
      } catch {}
    }

    const exploreRows = db.prepare(`
      SELECT title, notes, closed FROM explore_items
      WHERE epic_id = ?
    `).all(itemId) as { title?: string; notes: string; closed: number }[]

    const exploreNotesText = exploreRows
      .map(e => `${e.title ? `${e.title}: ` : ''}${e.notes?.trim() || ''}`.trim())
      .filter(Boolean)
      .join('\n')

    const combinedContent = [
      `Title: ${item.title}`,
      exploreNotesText ? `Explore Research: ${exploreNotesText}` : '',
      nextActionText ? `Next Actions: ${nextActionText}` : '',
      item.notes ? `Notes: ${item.notes}` : ''
    ].filter(Boolean).join('\n')

    if (!combinedContent.trim()) return

    // 4. Chunk text
    const chunks = chunkText(combinedContent, 250, 0.2)
    const now = new Date().toISOString()

    // 5. Generate embeddings and insert into vector index
    let insertedCount = 0
    for (const chunk of chunks) {
      const embedding = await ollamaClient.embed(chunk, 'document')
      if (embedding && embedding.length === 768) {
        const vectorData = new Float32Array(embedding)
        
        db.transaction(() => {
          const vecInsert = db.prepare('INSERT INTO chunk_vectors(embedding) VALUES (?)').run(vectorData)
          const vecRowid = vecInsert.lastInsertRowid
          
          db.prepare(`
            INSERT INTO memory_chunks (id, vec_rowid, source_type, source_id, content, created_at)
            VALUES (?, ?, 'item', ?, ?, ?)
          `).run(uuid(), vecRowid, itemId, chunk, now)
        })()
        insertedCount++
      }
    }

    if (insertedCount > 0) {
      console.log(`[Memory] Successfully indexed ${insertedCount} chunks for item '${item.title}' (${itemId})`)
    }
  } catch (err: any) {
    const errMsg = `Failed to index memory chunks for item ${itemId}: ${err?.message || err}`
    console.error('[Memory Error]', errMsg)
    ollamaClient.setLastError(errMsg)
  }
}

export async function reindexAllVectorMemory(): Promise<{ indexedEpics: number; totalChunks: number }> {
  const db = getDb()
  const items = db.prepare('SELECT id FROM items').all() as { id: string }[]
  console.log(`[Memory Reindex] Re-indexing vector memory for ${items.length} epics...`)

  let count = 0
  for (const item of items) {
    await upsertChunksForItem(item.id)
    count++
  }

  const chunkCountRes = db.prepare('SELECT count(*) as count FROM memory_chunks').get() as { count: number }
  console.log(`[Memory Reindex] Completed. Total memory chunks in index: ${chunkCountRes.count}`)
  return { indexedEpics: count, totalChunks: chunkCountRes.count }
}

export const backfillEmbeddings = reindexAllVectorMemory

export async function search(queryText: string, topK: number = 8): Promise<MemorySearchResult[]> {
  if (!queryText || queryText.trim().length === 0) return []

  const embedding = await ollamaClient.embed(queryText, 'query')
  if (!embedding || embedding.length !== 768) {
    return []
  }

  const db = getDb()
  const vectorData = new Float32Array(embedding)

  try {
    const query = `
      SELECT 
        mc.id as chunk_id,
        mc.source_type,
        mc.source_id,
        mc.content,
        i.title as item_title,
        i.status as item_status,
        i.priority_rank as item_rank,
        cv.distance
      FROM chunk_vectors cv
      JOIN memory_chunks mc ON cv.rowid = mc.vec_rowid
      LEFT JOIN items i ON mc.source_id = i.id
      WHERE cv.embedding MATCH ?
        AND k = ?
      ORDER BY cv.distance ASC
    `
    const rows = db.prepare(query).all(vectorData, topK) as MemorySearchResult[]
    return rows
  } catch (err: any) {
    console.error('[Vector Search Error]:', err)
    return []
  }
}
