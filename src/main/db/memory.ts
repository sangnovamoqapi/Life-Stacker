import { getDb } from './connection'
import { v4 as uuid } from 'uuid'
import * as ollamaClient from '../ai/ollama-client'
import * as settingsDb from './settings'
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

    // 3. Extract and format searchable text
    const steps = db.prepare(`
      SELECT content, is_done FROM action_steps 
      WHERE item_id = ? 
      ORDER BY sort_order ASC
    `).all(itemId) as { content: string; is_done: number }[]

    let nextActionText = ''
    if (steps.length > 0) {
      nextActionText = steps.map(s => `${s.is_done ? '[x]' : '[ ]'} ${s.content}`).join('; ')
    } else if (item.next_action) {
      try {
        const parsed = parseChecklist(item.next_action)
        nextActionText = parsed.map(p => p.text).join('; ')
      } catch {
        nextActionText = item.next_action
      }
    }

    const combinedContent = [
      `Title: ${item.title}`,
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
    const errMsg = `Vector search query failed: ${err?.message || err}`
    console.error('[Memory Search Error]', errMsg)
    ollamaClient.setLastError(errMsg)
    return []
  }
}

export async function backfillEmbeddings(): Promise<boolean> {
  const db = getDb()
  const currentVersion = settingsDb.get<number>('embeddings_version') ?? 0
  if (currentVersion >= 1) return true

  console.log('[Memory Backfill] Starting one-time Nomic embeddings backfill (v1)...')
  
  const isReady = await ollamaClient.checkStatus()
  if (!isReady) {
    console.log('[Memory Backfill] Ollama not ready yet, will retry on next startup')
    return false
  }

  const chunks = db.prepare('SELECT id, vec_rowid, content FROM memory_chunks').all() as { id: string; vec_rowid: number; content: string }[]
  if (chunks.length === 0) {
    settingsDb.set('embeddings_version', 1)
    console.log('[Memory Backfill] No existing memory chunks to backfill. Set embeddings_version = 1')
    return true
  }

  let successCount = 0
  const updateVecStmt = db.prepare('UPDATE chunk_vectors SET embedding = ? WHERE rowid = ?')
  
  for (const chunk of chunks) {
    const embedding = await ollamaClient.embed(chunk.content, 'document')
    if (embedding && embedding.length === 768) {
      const vectorData = new Float32Array(embedding)
      try {
        updateVecStmt.run(vectorData, chunk.vec_rowid)
        successCount++
      } catch (err) {
        console.error(`[Memory Backfill] Failed to update vector for chunk ${chunk.id}:`, err)
      }
    }
  }

  console.log(`[Memory Backfill] Successfully backfilled ${successCount}/${chunks.length} memory vectors with Nomic document prefix`)
  if (successCount > 0 || chunks.length === 0) {
    settingsDb.set('embeddings_version', 1)
  }
  return true
}
