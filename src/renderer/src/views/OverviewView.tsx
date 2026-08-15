import React, { useMemo, useState } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item, ItemStatus } from '../types'

function relativeTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const days = Math.floor(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

const statusBadgeStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400'
  },
  paused: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400'
  },
  blocked: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    dot: 'bg-red-400'
  },
  done: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400'
  },
  queued: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400'
  }
}

export const OverviewView: React.FC = () => {
  const { items, sectors, searchTerm, openItemModal, reorderItem, showToast } = useAppContext()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const rankedItems = useMemo(() => {
    let result = [...items].sort((a, b) => a.priority_rank - b.priority_rank)
    if (statusFilter !== 'ALL') {
      result = result.filter(item => item.status.toUpperCase() === statusFilter)
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(item => {
        const sector = sectors.find(s => s.id === item.sector_id)
        return item.title.toLowerCase().includes(lower) || 
               (sector && sector.name.toLowerCase().includes(lower))
      })
    }
    return result
  }, [items, sectors, searchTerm, statusFilter])

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

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header: Title + Subtitle + Status Filter */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-sans text-2xl font-bold text-slate-100 tracking-tight">Overview</h2>
            <p className="text-xs text-slate-400 mt-1">
              Of everything in your life, this is what comes next.
            </p>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#121622]/80 hover:bg-[#181d2b]/80 border border-white/[0.10] text-xs font-mono text-slate-200 px-3.5 py-1.5 rounded-lg outline-none cursor-pointer uppercase tracking-wider transition-colors"
            >
              <option value="ALL">ALL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="DONE">DONE</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="w-full">
          {/* Table Header */}
          <div className="flex items-center px-4 py-2 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-white/[0.06]">
            <div className="w-16 shrink-0">RANK</div>
            <div className="flex-1 min-w-[200px]">TITLE</div>
            <div className="w-44 shrink-0">SECTOR</div>
            <div className="w-48 shrink-0">PROGRESS</div>
            <div className="w-32 shrink-0">STATUS</div>
            <div className="w-24 shrink-0 text-right">UPDATED</div>
          </div>

          {/* Table Body */}
          {rankedItems.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-sans italic text-sm">
              {searchTerm ? 'No items match your search filter.' : 'No items to display.'}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {rankedItems.map(item => {
                const sector = sectors.find(s => s.id === item.sector_id)
                const isDragging = draggedId === item.id
                const isDragOver = dragOverId === item.id
                const badge = statusBadgeStyles[item.status] || statusBadgeStyles.active

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragOver={(e) => handleDragOver(e, item)}
                    onDrop={(e) => handleDrop(e, item)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openItemModal(item.id)}
                    className={`drag-row flex items-center px-4 py-3.5 hover:bg-white/[0.03] cursor-pointer transition-colors group rounded-lg ${
                      isDragging ? 'opacity-40' : ''
                    } ${isDragOver ? 'border-t-2 border-blue-500' : ''} ${
                      item.status === 'done' ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-16 shrink-0 flex items-center gap-1.5">
                      <span className="drag-handle text-slate-600 group-hover:text-slate-400 text-xs select-none">⠿</span>
                      <span className="font-mono text-xs text-slate-400">#{item.priority_rank}</span>
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-[200px] pr-4">
                      <span className={`text-sm font-sans font-semibold text-slate-100 ${
                        item.status === 'done' ? 'line-through text-slate-500' : ''
                      }`}>
                        {item.title}
                      </span>
                    </div>

                    {/* Sector */}
                    <div className="w-44 shrink-0 flex items-center gap-2 text-xs text-slate-300 pr-2">
                      {sector ? (
                        <>
                          <div 
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: `var(--color-${sector.color})` }}
                          />
                          {sector.icon && <span className="text-sm select-none shrink-0">{sector.icon}</span>}
                          <span className="truncate">{sector.name}</span>
                        </>
                      ) : (
                        <span className="text-slate-500 italic">No Sector</span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-48 shrink-0 flex items-center gap-3 pr-4">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/[0.08]">
                        <div 
                          className="h-full rounded-full transition-all bg-blue-500" 
                          style={{ 
                            width: `${item.progress}%`,
                            backgroundColor: sector ? `var(--color-${sector.color})` : '#3b82f6'
                          }} 
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-400 min-w-[32px] text-right font-medium">
                        {item.progress}%
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div className="w-32 shrink-0">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{item.status}</span>
                      </div>
                    </div>

                    {/* Relative Timestamp */}
                    <div className="w-24 shrink-0 text-right font-mono text-xs text-slate-500">
                      {relativeTime(item.updated_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
