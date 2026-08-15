import React, { useMemo, useState, useRef } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item } from '../types'

export const OverviewView: React.FC = () => {
  const { items, sectors, searchTerm, openItemModal, reorderItem, showToast } = useAppContext()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const rankedItems = useMemo(() => {
    let result = [...items].sort((a, b) => a.priority_rank - b.priority_rank)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(item => {
        const sector = sectors.find(s => s.id === item.sector_id)
        return item.title.toLowerCase().includes(lower) || 
               (sector && sector.name.toLowerCase().includes(lower))
      })
    }
    return result
  }, [items, sectors, searchTerm])

  const handleDragStart = (e: React.DragEvent, item: Item) => {
    setDraggedId(item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, item: Item) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (item.id !== draggedId) setDragOverId(item.id)
  }

  const handleDrop = async (e: React.DragEvent, targetItem: Item) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetItem.id) return
    try {
      await reorderItem(draggedId, targetItem.priority_rank)
    } catch {
      showToast('Failed to reorder', 'warning')
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const statusLabel = (s: string) => {
    if (s === 'queued') return 'QUEUE'
    return s.toUpperCase().slice(0, 5)
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: 'text-active', paused: 'text-paused', blocked: 'text-blocked', done: 'text-done', queued: 'text-queued'
    }
    return map[s] || 'text-ink-dim'
  }

  if (rankedItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-ink-faint font-serif italic text-lg">
        {searchTerm ? 'No items match your search.' : 'No items yet. Add one to get started.'}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-between mb-6 border-b border-border-soft pb-3">
          <h2 className="font-serif text-2xl text-ink">Master Stack</h2>
          <span className="font-mono text-xs text-ink-faint">{rankedItems.length} items · drag to reorder</span>
        </div>

        <div className="space-y-0">
          {rankedItems.map(item => {
            const sector = sectors.find(s => s.id === item.sector_id)
            if (!sector) return null

            const isDragging = draggedId === item.id
            const isDragOver = dragOverId === item.id

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDrop={(e) => handleDrop(e, item)}
                onDragEnd={handleDragEnd}
                onClick={() => openItemModal(item.id)}
                className={`drag-row flex items-center gap-3 px-4 py-2.5 border-b border-border-soft hover:bg-card-hover cursor-pointer transition-colors group
                  ${isDragging ? 'dragging' : ''}
                  ${isDragOver ? 'drag-over' : ''}
                  ${item.status === 'done' ? 'opacity-45' : ''}`}
              >
                {/* Drag handle */}
                <span className="drag-handle text-sm select-none">⠿</span>
                
                {/* Rank */}
                <span className="font-mono text-xs text-ink-faint w-8 shrink-0">#{item.priority_rank}</span>
                
                {/* Title */}
                <span className={`text-sm text-ink flex-1 truncate ${item.status === 'done' ? 'line-through text-ink-dim' : ''}`}>
                  {item.title}
                </span>
                
                {/* Sector pill */}
                <span 
                  className="text-[10px] font-mono px-2.5 py-0.5 rounded-full truncate max-w-[120px] shrink-0 font-medium flex items-center gap-1"
                  style={{ 
                    color: `var(--color-${sector.color})`,
                    backgroundColor: `color-mix(in srgb, var(--color-${sector.color}) 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, var(--color-${sector.color}) 25%, transparent)`
                  }}
                >
                  {sector.icon && <span className="text-xs">{sector.icon}</span>}
                  <span className="truncate">{sector.name}</span>
                </span>
                
                {/* Progress bar */}
                <div className="w-20 h-1.5 rounded-full overflow-hidden shrink-0 bg-white/[0.08]">
                  <div 
                    className="h-full rounded-full transition-all" 
                    style={{ width: `${item.progress}%`, backgroundColor: `var(--color-${sector.color})` }} 
                  />
                </div>
                
                {/* Status */}
                <span className={`text-[10px] font-mono uppercase w-12 text-right shrink-0 font-semibold ${statusColor(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
