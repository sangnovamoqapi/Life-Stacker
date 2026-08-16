import React, { useMemo, useState } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item, ItemStatus } from '../types'
import { parseChecklist, formatEffortBadge } from '../utils/checklist'
import { renderSimpleMarkdown } from '../utils/markdown'

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
    bg: 'bg-blue-500/20',
    text: 'text-blue-300',
    border: 'border-blue-500/50',
    dot: 'bg-blue-400'
  },
  paused: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-500/50',
    dot: 'bg-amber-400'
  },
  blocked: {
    bg: 'bg-red-500/20',
    text: 'text-red-300',
    border: 'border-red-500/50',
    dot: 'bg-red-400'
  },
  done: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-500/50',
    dot: 'bg-emerald-400'
  },
  queued: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-300',
    border: 'border-slate-500/50',
    dot: 'bg-slate-400'
  }
}

export const OverviewView: React.FC = () => {
  const { items, sectors, searchTerm, openItemModal, reorderItem, showToast, toggleChecklistItem } = useAppContext()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Main Frosted Glass Card Container (Matching Lane Card Translucency) */}
        <div className="glass-panel rounded-2xl p-6 space-y-5">
          
          {/* Header: Title + Subtitle + Status Filter */}
          <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="font-sans text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                <span>Life Stack</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {rankedItems.length} items
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Of everything in your life, this is what comes next.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Filter:</span>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-[#121622]/90 hover:bg-[#181d2b] border border-white/[0.12] text-xs font-mono font-semibold text-slate-200 px-3.5 py-1.5 rounded-lg outline-none cursor-pointer uppercase tracking-wider transition-colors"
                >
                  <option value="ALL">ALL</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="w-full">
            {/* Table Header */}
            <div className="flex items-center px-4 py-2.5 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-white/[0.08] bg-black/20 rounded-xl mb-2">
              <div className="w-20 shrink-0">RANK</div>
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
              <div className="space-y-1.5">
                {rankedItems.map(item => {
                  const sector = sectors.find(s => s.id === item.sector_id)
                  const isDragging = draggedId === item.id
                  const isDragOver = dragOverId === item.id
                  const isExpanded = expandedId === item.id
                  const badge = statusBadgeStyles[item.status] || statusBadgeStyles.active
                  const checklist = parseChecklist(item.next_action)
                  const sectorColor = sector ? `var(--color-${sector.color})` : '#3b82f6'

                  return (
                    <div key={item.id} className="transition-all">
                      {/* Main Card Row with Rich Glass Depth */}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragOver={(e) => handleDragOver(e, item)}
                        onDrop={(e) => handleDrop(e, item)}
                        onDragEnd={handleDragEnd}
                        onClick={() => toggleExpand(item.id)}
                        className={`drag-row flex items-center px-4 py-3 bg-black/25 hover:bg-black/40 border border-white/[0.06] hover:border-white/[0.12] cursor-pointer transition-all group rounded-xl shadow-sm ${
                          isDragging ? 'opacity-40' : ''
                        } ${isDragOver ? 'border-t-2 border-blue-500' : ''} ${
                          isExpanded ? 'bg-black/45 border-white/[0.14]' : ''
                        } ${item.status === 'done' ? 'opacity-50' : ''}`}
                      >
                        {/* Rank + Glassy Accordion Button */}
                        <div className="w-20 shrink-0 flex items-center gap-2">
                          <span 
                            className="drag-handle text-slate-600 group-hover:text-slate-400 text-xs select-none"
                            onClick={e => e.stopPropagation()}
                          >
                            ⠿
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-300 min-w-[24px]">#{item.priority_rank}</span>
                          
                          {/* Glassy Chevron Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(item.id)
                            }}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shadow-sm ${
                              isExpanded 
                                ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300' 
                                : 'bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-slate-400 hover:text-white'
                            }`}
                            title={isExpanded ? 'Collapse' : 'Expand details'}
                          >
                            <svg 
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Title */}
                        <div className="flex-1 min-w-[200px] pr-4">
                          <span className={`text-sm font-sans font-bold text-slate-100 group-hover:text-blue-300 transition-colors ${
                            item.status === 'done' ? 'line-through text-slate-500' : ''
                          }`}>
                            {item.title}
                          </span>
                          {/* Mini subtitle indicator if has checklist */}
                          {checklist.length > 0 && !isExpanded && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                              <span className="text-blue-400">→</span>
                              <span>{checklist[0].text}</span>
                              {checklist.length > 1 && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  (+{checklist.length - 1} more)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Sector */}
                        <div className="w-44 shrink-0 flex items-center gap-2 text-xs text-slate-200 pr-2">
                          {sector ? (
                            <>
                              <div 
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sectorColor }}
                              />
                              {sector.icon && <span className="text-sm select-none shrink-0">{sector.icon}</span>}
                              <span className="truncate font-medium">{sector.name}</span>
                            </>
                          ) : (
                            <span className="text-slate-500 italic">No Sector</span>
                          )}
                        </div>

                        {/* Progress Bar (Always clearly visible with gradient fill) */}
                        <div className="w-48 shrink-0 flex items-center gap-3 pr-4" onClick={e => e.stopPropagation()}>
                          <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.08] p-0.5 border border-white/[0.05]">
                            <div 
                              className="h-full rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.max(item.progress, item.progress > 0 ? 5 : 0)}%`,
                                background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)',
                                boxShadow: item.progress > 0 ? '0 0 8px rgba(59,130,246,0.5)' : 'none'
                              }} 
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-300 min-w-[32px] text-right font-bold">
                            {item.progress}%
                          </span>
                        </div>

                        {/* Status Pill */}
                        <div className="w-32 shrink-0">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${badge.dot}`} />
                            <span>{item.status}</span>
                          </div>
                        </div>

                        {/* Relative Timestamp */}
                        <div className="w-24 shrink-0 text-right font-mono text-xs text-slate-400 font-medium">
                          {relativeTime(item.updated_at)}
                        </div>
                      </div>

                      {/* Expandable Inline Accordion Drawer */}
                      {isExpanded && (
                        <div className="ml-10 mr-2 my-2 p-4 bg-black/40 border border-white/[0.08] rounded-xl shadow-inner space-y-4">
                          
                          {/* Next Action Checklist */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-blue-400 uppercase tracking-wider font-bold">
                                Next Action Checklist ({checklist.filter(c => c.completed).length}/{checklist.length})
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                Click checkbox to log effort & complete
                              </span>
                            </div>

                            {checklist.length > 0 ? (
                              <div className="space-y-1.5">
                                {checklist.map(step => (
                                  <div 
                                    key={step.id} 
                                    className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                                      step.completed 
                                        ? 'bg-white/[0.02] border-white/[0.04] opacity-60' 
                                        : 'bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15]'
                                    }`}
                                  >
                                    {/* Dark themed custom checkbox */}
                                    <button
                                      type="button"
                                      onClick={() => toggleChecklistItem(item.id, step.id)}
                                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                        step.completed
                                          ? 'bg-blue-600 border-blue-500 text-white'
                                          : 'bg-[#121622] border-white/25 hover:border-blue-400'
                                      }`}
                                    >
                                      {step.completed && <span className="text-[10px] font-bold leading-none">✓</span>}
                                    </button>

                                    <span className={`text-xs flex-1 ${
                                      step.completed ? 'line-through text-slate-500' : 'text-slate-200'
                                    }`}>
                                      {step.text}
                                    </span>
                                    {step.effortValue && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                                        ⏱ {formatEffortBadge(step.effortValue, step.effortUnit)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 italic py-1">
                                No checklist actions defined yet. Click &ldquo;More Details & Edit&rdquo; to add checklist items.
                              </div>
                            )}
                          </div>

                          {/* Notes Markdown Preview */}
                          {item.notes && (
                            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Notes</span>
                              <div className="text-xs bg-black/30 p-3 rounded-lg border border-white/[0.05] max-h-48 overflow-y-auto">
                                {renderSimpleMarkdown(item.notes)}
                              </div>
                            </div>
                          )}

                          {/* Drawer Actions */}
                          <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/[0.06]">
                            <button
                              onClick={() => openItemModal(item.id)}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-md flex items-center gap-1.5"
                            >
                              <span>More Details & Edit</span>
                              <span className="text-sm">→</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
