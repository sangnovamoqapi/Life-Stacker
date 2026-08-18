import { useState, useEffect, useMemo, useRef } from 'react'
import type { Item, Sector, ActionStep } from '../types'

export const L2_DISTANCE_CUTOFF = 22.35
export const SEARCH_DEBOUNCE_MS = 350

export interface HybridSearchResult {
  textMatchedItems: Item[]
  semanticMatchedItems: Item[]
  combinedItems: Item[]
  textMatchedIds: Set<string>
  semanticMatchedIds: Set<string>
  isSearching: boolean
}

export function useHybridSearch(
  items: Item[],
  sectors: Sector[],
  actionSteps: Record<string, ActionStep[]>,
  searchTerm: string
): HybridSearchResult {
  const [semanticMatchedItems, setSemanticMatchedItems] = useState<Item[]>([])
  const [semanticMatchedIds, setSemanticMatchedIds] = useState<Set<string>>(new Set())
  const generationRef = useRef<number>(0)

  const trimmedQuery = searchTerm.trim()
  const lowerQuery = trimmedQuery.toLowerCase()
  const isSearching = trimmedQuery.length > 0

  // Sector lookup map for fast text matching
  const sectorMap = useMemo(() => {
    const map = new Map<string, string>()
    sectors.forEach(s => map.set(s.id, s.name.toLowerCase()))
    return map
  }, [sectors])

  // 1. Instant Synchronous Text Substring Match (title, sector, notes, action_steps)
  const { textMatchedItems, textMatchedIds } = useMemo(() => {
    if (!isSearching) {
      return {
        textMatchedItems: items,
        textMatchedIds: new Set<string>()
      }
    }

    const matchedIds = new Set<string>()
    const matched = items.filter(item => {
      // 1. Title match
      if (item.title.toLowerCase().includes(lowerQuery)) {
        matchedIds.add(item.id)
        return true
      }

      // 2. Sector name match
      const sectorName = sectorMap.get(item.sector_id)
      if (sectorName && sectorName.includes(lowerQuery)) {
        matchedIds.add(item.id)
        return true
      }

      // 3. Notes match
      if (item.notes && item.notes.toLowerCase().includes(lowerQuery)) {
        matchedIds.add(item.id)
        return true
      }

      // 4. Action steps content match
      const steps = actionSteps[item.id]
      if (steps && steps.some(step => step.content.toLowerCase().includes(lowerQuery))) {
        matchedIds.add(item.id)
        return true
      }

      return false
    })

    return {
      textMatchedItems: matched,
      textMatchedIds: matchedIds
    }
  }, [items, sectorMap, actionSteps, lowerQuery, isSearching])

  // 2. Debounced Additive Semantic Search via Ollama Vectors (Guarded by Generation Counter)
  useEffect(() => {
    if (!isSearching || trimmedQuery.length < 3) {
      setSemanticMatchedItems([])
      setSemanticMatchedIds(new Set())
      return
    }

    generationRef.current += 1
    const currentGen = generationRef.current

    const timer = setTimeout(async () => {
      try {
        // Pre-check: fail-soft if AI / Ollama is not ready
        const isReady = await window.api.ai.checkStatus().catch(() => false)
        if (!isReady || generationRef.current !== currentGen) return

        const searchResults = await window.api.memory.search(trimmedQuery, 8).catch(() => [])
        if (generationRef.current !== currentGen) return

        // Filter results by L2 distance cutoff & exclude items already matched by text
        const validSemanticIds = new Set<string>()
        for (const res of searchResults) {
          if (res.distance <= L2_DISTANCE_CUTOFF && !textMatchedIds.has(res.source_id)) {
            validSemanticIds.add(res.source_id)
          }
        }

        // Map IDs back to item objects in memory
        const semanticItems = items.filter(i => validSemanticIds.has(i.id))

        if (generationRef.current === currentGen) {
          setSemanticMatchedItems(semanticItems)
          setSemanticMatchedIds(validSemanticIds)
        }
      } catch (err) {
        console.error('[Hybrid Search Error]:', err)
        if (generationRef.current === currentGen) {
          setSemanticMatchedItems([])
          setSemanticMatchedIds(new Set())
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [trimmedQuery, isSearching, items, textMatchedIds])

  // 3. Combined Ordered Results (Text matches first, followed by Semantic-only matches)
  const combinedItems = useMemo(() => {
    if (!isSearching) return items
    if (semanticMatchedItems.length === 0) return textMatchedItems
    return [...textMatchedItems, ...semanticMatchedItems]
  }, [items, isSearching, textMatchedItems, semanticMatchedItems])

  return {
    textMatchedItems,
    semanticMatchedItems,
    combinedItems,
    textMatchedIds,
    semanticMatchedIds,
    isSearching
  }
}
