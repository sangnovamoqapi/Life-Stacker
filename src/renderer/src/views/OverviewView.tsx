import React, { useMemo, useState } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item, NextItem, ExploreItem } from '../types'
import { formatEffortBadge } from '../utils/checklist'
import { TodayBumpModal } from '../components/TodayBumpModal'

function daysSince(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDaysAgo(dateStr: string) {
  const days = daysSince(dateStr)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export const OverviewView: React.FC = () => {
  const { 
    items, 
    sectors, 
    exploreItems, 
    nextItems, 
    settings, 
    openItemModal, 
    updateItem, 
    toggleNextItem, 
    promoteToToday, 
    demoteFromToday, 
    reorderTodayItems, 
    getResearchProgress, 
    getExecutionProgress, 
    getEpicStage,
    showToast,
    setChecklistEffortPrompt
  } = useAppContext()

  // Bump Modal State
  const [targetNextItemToPromote, setTargetNextItemToPromote] = useState<NextItem | null>(null)

  // Drag & drop state for Today panel
  const [draggedTodayId, setDraggedTodayId] = useState<string | null>(null)
  const [dragOverTodayId, setDragOverTodayId] = useState<string | null>(null)

  const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5
  const todayCap = settings.today_cap ?? 3

  const getSector = (sectorId: string) => sectors.find(s => s.id === sectorId)
  const getEpic = (epicId: string) => items.find(i => i.id === epicId)

  // ─── 1. TOP-LEFT: Active Epics (Ranked #1..#5) ───
  const activeEpics = useMemo(() => {
    return items
      .filter(i => i.status === 'active')
      .sort((a, b) => a.priority_rank - b.priority_rank)
      .slice(0, activeCap)
  }, [items, activeCap])

  const activeEpicIds = useMemo(() => new Set(activeEpics.map(e => e.id)), [activeEpics])

  // ─── 2. TOP-RIGHT: Explore Items (Open research from active epics, oldest-touched first) ───
  const activeExploreItems = useMemo(() => {
    const list: ExploreItem[] = []
    Object.keys(exploreItems).forEach(epicId => {
      if (activeEpicIds.has(epicId)) {
        const epicsExplores = exploreItems[epicId] || []
        epicsExplores.forEach(e => {
          if (!e.closed) list.push(e)
        })
      }
    })

    // Sort by staleness (oldest-touched first)
    return list.sort((a, b) => new Date(a.last_touched_at).getTime() - new Date(b.last_touched_at).getTime())
  }, [exploreItems, activeEpicIds])

  // ─── 3. BOTTOM-LEFT: Next Items (Open actions from active epics, due-date-then-effort) ───
  const activeNextItems = useMemo(() => {
    const list: NextItem[] = []
    Object.keys(nextItems).forEach(epicId => {
      if (activeEpicIds.has(epicId)) {
        const epicsNext = nextItems[epicId] || []
        epicsNext.forEach(n => {
          if (n.status === 'next') list.push(n)
        })
      }
    })

    // Sort by due-date-then-effort:
    // 1. Items with due dates (earliest first)
    // 2. Items without due dates, sorted by time estimate (smallest first)
    return list.sort((a, b) => {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      }
      if (a.due_date && !b.due_date) return -1
      if (!a.due_date && b.due_date) return 1

      const aEst = a.time_estimate_value ?? 9999
      const bEst = b.time_estimate_value ?? 9999
      return aEst - bEst
    })
  }, [nextItems, activeEpicIds])

  // ─── 4. BOTTOM-RIGHT: Today Focus Items (all status === 'today') ───
  const todayItems = useMemo(() => {
    const list: NextItem[] = []
    Object.keys(nextItems).forEach(epicId => {
      const epicsNext = nextItems[epicId] || []
      epicsNext.forEach(n => {
        if (n.status === 'today') list.push(n)
      })
    })
    return list.sort((a, b) => a.sort_order - b.sort_order)
  }, [nextItems])

  // ─── Action Handlers ───
  const handlePromoteClick = async (nextItem: NextItem) => {
    if (todayItems.length >= todayCap) {
      setTargetNextItemToPromote(nextItem)
    } else {
      await promoteToToday(nextItem.id)
      showToast(`Pulled "${nextItem.title}" into Today focus`, 'success')
    }
  }

  const handleConfirmBump = async (bumpItemId: string) => {
    if (!targetNextItemToPromote) return
    const bumpedItem = todayItems.find(i => i.id === bumpItemId)
    
    await demoteFromToday(bumpItemId)
    await promoteToToday(targetNextItemToPromote.id)
    
    showToast(`Bumping: "${targetNextItemToPromote.title}" moved to Today, "${bumpedItem?.title || 'Item'}" back to Next`, 'info')
    setTargetNextItemToPromote(null)
  }

  const handleToggleTodayDone = async (item: NextItem) => {
    const toggled = await toggleNextItem(item.id)
    if (toggled.status === 'done') {
      setChecklistEffortPrompt({
        itemId: item.epic_id,
        checklistItem: {
          id: item.id,
          text: item.title,
          completed: true,
          effortValue: item.time_estimate_value ?? undefined,
          effortUnit: (item.time_estimate_unit as any) || undefined
        }
      })
      showToast(`Completed: "${item.title}"`, 'success')
    }
  }

  // Drag-to-reorder within Today panel
  const handleTodayDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTodayId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleTodayDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggedTodayId) setDragOverTodayId(id)
  }

  const handleTodayDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedTodayId || draggedTodayId === targetId) return

    const currentIds = todayItems.map(i => i.id)
    const fromIdx = currentIds.indexOf(draggedTodayId)
    const toIdx = currentIds.indexOf(targetId)

    if (fromIdx !== -1 && toIdx !== -1) {
      const reordered = [...currentIds]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)

      await reorderTodayItems(reordered)
      showToast('Today focus reordered', 'info')
    }

    setDraggedTodayId(null)
    setDragOverTodayId(null)
  }

  const handleTodayDragEnd = () => {
    setDraggedTodayId(null)
    setDragOverTodayId(null)
  }

  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col gap-4">
      {/* 2×2 Fixed Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 grid-rows-2 gap-4 overflow-hidden min-h-0">

        {/* ═══════════════════════════════════════════════════════════════════
            1. TOP-LEFT: EPICS PANEL
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lane-glass rounded-2xl p-4 flex flex-col min-h-0 border border-white/[0.08] shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h2 className="font-sans font-bold text-slate-100 text-sm">Active Epics</h2>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/25">
                {activeEpics.length} / {activeCap}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Ranked by Priority</span>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
            {activeEpics.map(epic => {
              const sec = getSector(epic.sector_id)
              const secColor = sec ? `var(--color-${sec.color})` : '#3b82f6'
              const researchProg = getResearchProgress(epic.id)
              const executionProg = getExecutionProgress(epic.id)
              const stage = getEpicStage(epic.id)

              return (
                <div
                  key={epic.id}
                  onClick={() => openItemModal(epic.id)}
                  className="card-dominant cursor-pointer transition-all hover:scale-[1.01] p-3 rounded-xl"
                  style={{ borderLeft: `3px solid ${secColor}` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono font-bold text-amber-400">#{epic.priority_rank}</span>
                      <span className="text-xs font-semibold text-slate-200 truncate">{epic.title}</span>
                    </div>

                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.10] shrink-0 font-semibold">
                      {stage.label}
                    </span>
                  </div>

                  {/* Dual Stacked Progress Bars */}
                  <div className="space-y-1 my-2 bg-black/20 p-2 rounded-lg border border-white/[0.04]">
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                      <span className="text-purple-300">🔬 Research {researchProg}%</span>
                      <span className="text-emerald-300">⚡ Execution {executionProg}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${researchProg}%` }} />
                      </div>
                      <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${executionProg}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span style={{ color: secColor }}>{sec?.icon} {sec?.name}</span>
                    <span>{formatDaysAgo(epic.updated_at)}</span>
                  </div>
                </div>
              )
            })}

            {activeEpics.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs font-mono italic">
                No active epics. Activate epics in the Sectors page.
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. TOP-RIGHT: EXPLORE PANEL (Staleness Sort)
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lane-glass rounded-2xl p-4 flex flex-col min-h-0 border border-purple-500/20 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-purple-500/15 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🔬</span>
              <h2 className="font-sans font-bold text-purple-200 text-sm">Explore Research</h2>
              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/25">
                {activeExploreItems.length} Open
              </span>
            </div>
            <span className="text-[11px] font-mono text-purple-400">Oldest-Touched First</span>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
            {activeExploreItems.map(exp => {
              const parentEpic = getEpic(exp.epic_id)
              const parentSector = getSector(parentEpic?.sector_id || '')
              const sectorColor = parentSector ? `var(--color-${parentSector.color})` : '#3b82f6'
              const daysUntouched = daysSince(exp.last_touched_at)

              return (
                <div
                  key={exp.id}
                  onClick={() => openItemModal(exp.epic_id)}
                  className="p-3 rounded-xl bg-white/[0.03] border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-950/20 transition-all cursor-pointer shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-0.5">
                        <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic?.title}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 truncate">
                        {exp.title || exp.notes.split('\n')[0] || 'Explore Topic'}
                      </h4>
                    </div>

                    {exp.time_estimate_value && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                        ⏱ {formatEffortBadge(exp.time_estimate_value, (exp.time_estimate_unit as any) || 'hours')}
                      </span>
                    )}
                  </div>

                  {exp.notes && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mt-1">
                      {exp.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 pt-1.5 border-t border-white/[0.04]">
                    <span className={daysUntouched >= 7 ? 'text-amber-400 font-semibold' : ''}>
                      Untouched for {daysUntouched === 0 ? 'today' : `${daysUntouched}d`}
                    </span>
                    <span className="text-purple-400">Click to expand finding →</span>
                  </div>
                </div>
              )
            })}

            {activeExploreItems.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs font-mono italic">
                No open research topics across your active epics.
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            3. BOTTOM-LEFT: NEXT ACTIONS PANEL (Due Date & Effort Sort)
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lane-glass rounded-2xl p-4 flex flex-col min-h-0 border border-amber-500/20 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/15 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h2 className="font-sans font-bold text-amber-200 text-sm">Next Backlog</h2>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/25">
                {activeNextItems.length} Open
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-400">Due-Date & Effort Sort</span>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 space-y-2 pr-1">
            {activeNextItems.map(nextItem => {
              const parentEpic = getEpic(nextItem.epic_id)
              const parentSector = getSector(parentEpic?.sector_id || '')
              const sectorColor = parentSector ? `var(--color-${parentSector.color})` : '#3b82f6'

              return (
                <div
                  key={nextItem.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/30 transition-all gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleTodayDone(nextItem)}
                      className="w-4 h-4 rounded-full border-2 border-amber-400/70 hover:border-amber-300 hover:bg-amber-400/20 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                      title="Complete task"
                    />

                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-slate-100 block truncate">
                        {nextItem.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                        <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic?.title}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {nextItem.time_estimate_value && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                        ⏱ {formatEffortBadge(nextItem.time_estimate_value, (nextItem.time_estimate_unit as any) || 'hours')}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handlePromoteClick(nextItem)}
                      className="px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                      title="Promote to Today Focus"
                    >
                      <span>⭐ Today</span>
                    </button>
                  </div>
                </div>
              )
            })}

            {activeNextItems.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs font-mono italic">
                No open next items. Spawn from explore research or add to epics.
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            4. BOTTOM-RIGHT: TODAY PANEL (Governed by today_cap)
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lane-glass rounded-2xl p-4 flex flex-col min-h-0 border border-amber-400/30 shadow-lg bg-amber-950/[0.08]">
          <div className="flex items-center justify-between pb-3 border-b border-amber-400/20 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <h2 className="font-sans font-bold text-amber-200 text-sm">Today's Focus</h2>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                {todayItems.length} / {todayCap}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Drag to Reorder</span>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
            {todayItems.map(item => {
              const parentEpic = getEpic(item.epic_id)
              const parentSector = getSector(parentEpic?.sector_id || '')
              const sectorColor = parentSector ? `var(--color-${parentSector.color})` : '#3b82f6'
              const isDragging = draggedTodayId === item.id
              const isDragOver = dragOverTodayId === item.id

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleTodayDragStart(e, item.id)}
                  onDragOver={(e) => handleTodayDragOver(e, item.id)}
                  onDrop={(e) => handleTodayDrop(e, item.id)}
                  onDragEnd={handleTodayDragEnd}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all gap-3 cursor-grab active:cursor-grabbing ${
                    isDragging ? 'opacity-40 scale-95' : ''
                  } ${
                    isDragOver ? 'border-t-2 border-amber-400 bg-amber-500/20' : 'bg-amber-500/[0.12] border border-amber-400/30 hover:border-amber-400 shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-slate-500 select-none text-xs">⠿</span>

                    <button
                      type="button"
                      onClick={() => handleToggleTodayDone(item)}
                      className="w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-400/20 hover:bg-amber-400/40 text-black flex items-center justify-center shrink-0 transition-all cursor-pointer"
                      title="Complete today's task"
                    />

                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-100 block truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                        <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic?.title}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.time_estimate_value && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30">
                        ⏱ {formatEffortBadge(item.time_estimate_value, (item.time_estimate_unit as any) || 'hours')}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => demoteFromToday(item.id)}
                      className="text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-white/[0.06] hover:bg-white/[0.12] px-2 py-1 rounded-md border border-white/[0.08] transition-colors cursor-pointer"
                      title="Return to Next backlog"
                    >
                      ↩
                    </button>
                  </div>
                </div>
              )
            })}

            {todayItems.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs font-mono italic">
                Nothing committed for today. Click ⭐ Today on any Next action on the left.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Today Focus Bump Modal */}
      <TodayBumpModal
        isOpen={targetNextItemToPromote !== null}
        targetNextItemTitle={targetNextItemToPromote?.title || ''}
        todayItems={todayItems}
        onConfirmBump={handleConfirmBump}
        onCancel={() => setTargetNextItemToPromote(null)}
      />
    </div>
  )
}
