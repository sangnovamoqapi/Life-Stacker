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
    reorderItem,
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

  // Panel Collapse States (Persisted in localStorage)
  const [collapsedPanels, setCollapsedPanels] = useState<Record<'epics' | 'explore' | 'next' | 'today', boolean>>(() => {
    try {
      const saved = localStorage.getItem('lifestack_overview_collapsed')
      return saved ? JSON.parse(saved) : { epics: false, explore: false, next: false, today: false }
    } catch {
      return { epics: false, explore: false, next: false, today: false }
    }
  })

  const togglePanelCollapse = (panelKey: 'epics' | 'explore' | 'next' | 'today') => {
    setCollapsedPanels(prev => {
      const updated = { ...prev, [panelKey]: !prev[panelKey] }
      try {
        localStorage.setItem('lifestack_overview_collapsed', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  // Drag & drop state for Epics panel
  const [draggedEpicId, setDraggedEpicId] = useState<string | null>(null)
  const [dragOverEpicId, setDragOverEpicId] = useState<string | null>(null)

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

  // ─── 4. BOTTOM-RIGHT: Today Focus Items & Week Pool ───
  const [todayOrWeek, setTodayOrWeek] = useState<'today' | 'week'>('today')

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

  const weekRange = useMemo(() => {
    const now = new Date()
    const currentDay = now.getDay() // 0 = Sun, 1 = Mon, ...
    const distanceToMonday = (currentDay + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - distanceToMonday)
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    return { monday, sunday }
  }, [])

  const weekItems = useMemo(() => {
    const list: NextItem[] = []
    Object.keys(nextItems).forEach(epicId => {
      if (activeEpicIds.has(epicId)) {
        const epicsNext = nextItems[epicId] || []
        epicsNext.forEach(n => {
          if (n.status === 'today') {
            list.push(n)
          } else if (n.due_date && n.status !== 'done') {
            const dueDate = new Date(n.due_date)
            if (dueDate >= weekRange.monday && dueDate <= weekRange.sunday) {
              list.push(n)
            }
          }
        })
      }
    })
    return list
  }, [nextItems, activeEpicIds, weekRange])

  const weekGrouped = useMemo(() => {
    const groups: { dayName: string; dateStr: string; items: NextItem[] }[] = []
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekRange.monday)
      d.setDate(weekRange.monday.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayName = days[i]
      const matchingItems = weekItems.filter(item => {
        if (item.due_date) {
          return item.due_date.slice(0, 10) === dateStr
        }
        const todayStr = new Date().toISOString().slice(0, 10)
        return item.status === 'today' && dateStr === todayStr
      })
      groups.push({ dayName, dateStr, items: matchingItems })
    }

    return groups
  }, [weekItems, weekRange])

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
    await demoteFromToday(bumpItemId)
    await promoteToToday(targetNextItemToPromote.id)
    showToast(`Swapped: "${targetNextItemToPromote.title}" in, bumped previous item to Next`, 'success')
    setTargetNextItemToPromote(null)
  }

  const handleToggleTodayDone = async (item: NextItem) => {
    const toggled = await toggleNextItem(item.id)
    if (toggled.status === 'done') {
      showToast(`Completed "${item.title}"!`, 'success')
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
    }
  }

  // ─── Drag and Drop Handlers for Epics Panel ───
  const handleEpicDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedEpicId(id)
  }

  const handleEpicDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dragOverEpicId !== id) {
      setDragOverEpicId(id)
    }
  }

  const handleEpicDrop = async (e: React.DragEvent, targetEpic: Item) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain') || draggedEpicId
    if (!sourceId || sourceId === targetEpic.id) {
      setDraggedEpicId(null)
      setDragOverEpicId(null)
      return
    }

    const sourceEpic = items.find(i => i.id === sourceId)
    if (sourceEpic) {
      await reorderItem(sourceId, targetEpic.priority_rank)
      showToast(`Updated rank: "${sourceEpic.title}" is now #${targetEpic.priority_rank}`, 'info')
    }

    setDraggedEpicId(null)
    setDragOverEpicId(null)
  }

  const handleEpicDragEnd = () => {
    setDraggedEpicId(null)
    setDragOverEpicId(null)
  }

  // ─── Drag and Drop Handlers for Today Panel ───
  const handleTodayDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedTodayId(id)
  }

  const handleTodayDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dragOverTodayId !== id) {
      setDragOverTodayId(id)
    }
  }

  const handleTodayDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTodayId
    if (!sourceId || sourceId === targetId) {
      setDraggedTodayId(null)
      setDragOverTodayId(null)
      return
    }

    const fromIdx = todayItems.findIndex(i => i.id === sourceId)
    const toIdx = todayItems.findIndex(i => i.id === targetId)
    if (fromIdx !== -1 && toIdx !== -1) {
      const reordered = [...todayItems]
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
      <div data-tour="overview-grid" className="flex-1 grid grid-cols-1 lg:grid-cols-2 grid-rows-2 gap-4 overflow-hidden min-h-0">

        {/* ═══════════════════════════════════════════════════════════════════
            1. TOP-LEFT: EPICS PANEL
           ═══════════════════════════════════════════════════════════════════ */}
        <div className={`lane-glass rounded-xl p-4 flex flex-col transition-all ${
          collapsedPanels.epics ? 'min-h-[64px] max-h-[64px]' : 'min-h-0'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h2 className="font-sans font-bold text-text-primary text-sm">Active Epics</h2>
              <span className="text-xs font-mono font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded-full border border-accent/25">
                {activeEpics.length} / {activeCap}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-text-muted">Drag to Reorder Rank</span>
              <button
                type="button"
                onClick={() => togglePanelCollapse('epics')}
                className="text-xs text-text-muted hover:text-text-primary bg-surface-subtle hover:bg-surface-raised px-1.5 py-0.5 rounded border border-border-subtle transition-colors cursor-pointer"
                title={collapsedPanels.epics ? 'Expand panel' : 'Collapse panel'}
              >
                {collapsedPanels.epics ? '＋' : '−'}
              </button>
            </div>
          </div>

          {!collapsedPanels.epics && (
            <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
              {activeEpics.map(epic => {
                const sec = getSector(epic.sector_id)
                const secColor = sec ? `var(--color-${sec.color})` : 'var(--accent)'
                const researchProg = getResearchProgress(epic.id)
                const executionProg = getExecutionProgress(epic.id)
                const stage = getEpicStage(epic.id)
                const isDragging = draggedEpicId === epic.id
                const isDragOver = dragOverEpicId === epic.id

                return (
                  <div
                    key={epic.id}
                    draggable
                    onDragStart={(e) => handleEpicDragStart(e, epic.id)}
                    onDragOver={(e) => handleEpicDragOver(e, epic.id)}
                    onDrop={(e) => handleEpicDrop(e, epic)}
                    onDragEnd={handleEpicDragEnd}
                    onClick={() => openItemModal(epic.id)}
                    className={`card-dominant cursor-pointer transition-all p-3 rounded-lg ${
                      isDragging ? 'opacity-40 scale-95' : ''
                    } ${
                      isDragOver ? 'border-t-2 border-accent bg-surface-raised' : 'hover:scale-[1.005]'
                    }`}
                    style={{ borderLeft: `3px solid ${secColor}` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-text-muted text-xs select-none cursor-grab active:cursor-grabbing">⠿</span>
                        <span className="text-xs font-mono font-bold text-accent">#{epic.priority_rank}</span>
                        <span className="text-xs font-semibold text-text-primary truncate">{epic.title}</span>
                      </div>

                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-border-subtle shrink-0 font-semibold">
                        {stage.label}
                      </span>
                    </div>

                    {/* Dual Stacked Progress Bars */}
                    <div className="space-y-1 my-2 bg-surface-subtle p-2 rounded-lg border border-border-subtle">
                      <div className="flex items-center justify-between text-[9px] font-mono text-text-muted">
                        <span className="text-purple-400">🔬 Research {researchProg}%</span>
                        <span className="text-emerald-500">⚡ Execution {executionProg}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-1 bg-surface-raised rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${researchProg}%` }} />
                        </div>
                        <div className="h-1 bg-surface-raised rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${executionProg}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                      <span style={{ color: secColor }}>{sec?.icon} {sec?.name}</span>
                      <span>{formatDaysAgo(epic.updated_at)}</span>
                    </div>
                  </div>
                )
              })}

              {activeEpics.length === 0 && (
                <div className="text-center py-12 text-text-muted text-xs font-mono italic">
                  No active epics. Activate epics in the Sectors page.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. TOP-RIGHT: EXPLORE PANEL (Staleness Sort)
           ═══════════════════════════════════════════════════════════════════ */}
        <div data-tour="explore-panel" className={`lane-glass rounded-xl p-4 flex flex-col transition-all ${
          collapsedPanels.explore ? 'min-h-[64px] max-h-[64px]' : 'min-h-0'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🔬</span>
              <h2 className="font-sans font-bold text-purple-400 text-sm">Explore Research</h2>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/25">
                {activeExploreItems.length} Open
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-text-muted">Oldest-Touched First</span>
              <button
                type="button"
                onClick={() => togglePanelCollapse('explore')}
                className="text-xs text-text-muted hover:text-text-primary bg-surface-subtle hover:bg-surface-raised px-1.5 py-0.5 rounded border border-border-subtle transition-colors cursor-pointer"
                title={collapsedPanels.explore ? 'Expand panel' : 'Collapse panel'}
              >
                {collapsedPanels.explore ? '＋' : '−'}
              </button>
            </div>
          </div>

          {!collapsedPanels.explore && (
            <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
              {activeExploreItems.map(exp => {
                const parentEpic = getEpic(exp.epic_id)
                const parentSector = getSector(parentEpic?.sector_id || '')
                const sectorColor = parentSector ? `var(--color-${parentSector.color})` : 'var(--accent)'
                const daysUntouched = daysSince(exp.last_touched_at)

                return (
                  <div
                    key={exp.id}
                    onClick={() => openItemModal(exp.epic_id)}
                    className="p-3 rounded-lg bg-surface-card border border-border-subtle hover:border-purple-500/40 hover:bg-surface-card-hover transition-all cursor-pointer shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted mb-0.5">
                          <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic?.title}</span>
                        </div>
                        <h4 className="text-xs font-bold text-text-primary truncate">
                          {exp.title || exp.notes.split('\n')[0] || 'Explore Topic'}
                        </h4>
                      </div>

                      {exp.time_estimate_value && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-subtle text-purple-400 border border-purple-500/30 shrink-0">
                          ⏱ {formatEffortBadge(exp.time_estimate_value, (exp.time_estimate_unit as any) || 'hours')}
                        </span>
                      )}
                    </div>

                    {exp.notes && (
                      <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed mt-1">
                        {exp.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mt-2 pt-1.5 border-t border-border-subtle">
                      <span className={daysUntouched >= 7 ? 'text-accent font-semibold' : ''}>
                        Untouched for {daysUntouched === 0 ? 'today' : `${daysUntouched}d`}
                      </span>
                      <span className="text-purple-400">Click to expand finding →</span>
                    </div>
                  </div>
                )
              })}

              {activeExploreItems.length === 0 && (
                <div className="text-center py-12 text-text-muted text-xs font-mono italic">
                  No open research topics across your active epics.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            3 & 4. BOTTOM HALF: TODAY (SPLIT 2-COL) OR WEEK (7-DAY STRIP)
           ═══════════════════════════════════════════════════════════════════ */}
        {todayOrWeek === 'today' ? (
          <>
            {/* 3. BOTTOM-LEFT: NEXT ACTIONS PANEL (Due Date & Effort Sort) */}
            <div className={`lane-glass rounded-xl p-4 flex flex-col transition-all ${
              collapsedPanels.next ? 'min-h-[64px] max-h-[64px]' : 'min-h-0'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <h2 className="font-sans font-bold text-text-primary text-sm">Next Backlog</h2>
                  <span className="text-xs font-mono font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded-full border border-accent/25">
                    {activeNextItems.length} Open
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-text-muted">Due-Date & Effort Sort</span>
                  <button
                    type="button"
                    onClick={() => togglePanelCollapse('next')}
                    className="text-xs text-text-muted hover:text-text-primary bg-surface-subtle hover:bg-surface-raised px-1.5 py-0.5 rounded border border-border-subtle transition-colors cursor-pointer"
                    title={collapsedPanels.next ? 'Expand panel' : 'Collapse panel'}
                  >
                    {collapsedPanels.next ? '＋' : '−'}
                  </button>
                </div>
              </div>

              {!collapsedPanels.next && (
                <div className="flex-1 overflow-y-auto pt-3 space-y-2 pr-1">
                  {activeNextItems.map(nextItem => {
                    const parentEpic = getEpic(nextItem.epic_id)
                    const parentSector = getSector(parentEpic?.sector_id || '')
                    const sectorColor = parentSector ? `var(--color-${parentSector.color})` : 'var(--accent)'

                    return (
                      <div
                        key={nextItem.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-surface-card border border-border-subtle hover:border-accent/30 transition-all gap-2 shadow-soft"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleTodayDone(nextItem)}
                            className="w-4 h-4 rounded-full border-2 border-accent hover:bg-accent/20 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                            title="Complete task"
                          />

                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-text-primary block truncate">
                              {nextItem.title}
                            </span>
                            <span className="text-[10px] font-mono text-text-muted flex items-center gap-1 mt-0.5 truncate">
                              <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic?.title}</span>
                              {nextItem.due_date && (
                                <span className="text-text-muted ml-1.5">📅 {nextItem.due_date}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {nextItem.time_estimate_value && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-border-subtle">
                              ⏱ {formatEffortBadge(nextItem.time_estimate_value, (nextItem.time_estimate_unit as any) || 'hours')}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePromoteClick(nextItem)}
                            className="px-2.5 py-1 text-xs font-mono font-bold text-white bg-accent hover:bg-accent-hover rounded-lg shadow-soft transition-all cursor-pointer flex items-center gap-1"
                            title="Promote to Today Focus"
                          >
                            <span>⭐ Today</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {activeNextItems.length === 0 && (
                    <div className="text-center py-12 text-text-muted text-xs font-mono italic">
                      No open next items. Spawn from explore research or add to epics.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. BOTTOM-RIGHT: TODAY FOCUS PANEL (Governed by today_cap) */}
            <div data-tour="today-panel" className={`lane-glass rounded-xl p-4 flex flex-col transition-all ${
              collapsedPanels.today ? 'min-h-[64px] max-h-[64px]' : 'min-h-0'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🎯</span>
                  <div className="flex items-center p-0.5 bg-surface-subtle border border-border-subtle rounded-lg">
                    <button
                      type="button"
                      onClick={() => setTodayOrWeek('today')}
                      className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                        todayOrWeek === 'today'
                          ? 'bg-accent text-white shadow-soft'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setTodayOrWeek('week')}
                      className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                        todayOrWeek === 'week'
                          ? 'bg-accent text-white shadow-soft'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Week
                    </button>
                  </div>

                  <span className="text-xs font-mono font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded-full border border-accent/30">
                    {todayItems.length} / {todayCap}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-text-muted hidden sm:inline">Drag to Reorder</span>
                  <button
                    type="button"
                    onClick={() => togglePanelCollapse('today')}
                    className="text-xs text-text-muted hover:text-text-primary bg-surface-subtle hover:bg-surface-raised px-1.5 py-0.5 rounded border border-border-subtle transition-colors cursor-pointer"
                    title={collapsedPanels.today ? 'Expand panel' : 'Collapse panel'}
                  >
                    {collapsedPanels.today ? '＋' : '−'}
                  </button>
                </div>
              </div>

              {!collapsedPanels.today && (
                <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
                  {todayItems.map(item => {
                    const parentEpic = getEpic(item.epic_id)
                    const parentSector = getSector(parentEpic?.sector_id || '')
                    const sectorColor = parentSector ? `var(--color-${parentSector.color})` : 'var(--accent)'
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
                        className={`flex items-center justify-between p-3 rounded-lg transition-all gap-3 cursor-grab active:cursor-grabbing ${
                          isDragging ? 'opacity-40 scale-95' : ''
                        } ${
                          isDragOver ? 'border-t-2 border-accent bg-surface-raised' : 'bg-surface-card border border-border-subtle hover:border-accent/40 shadow-soft'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-text-muted select-none text-xs">⠿</span>

                          <button
                            type="button"
                            onClick={() => handleToggleTodayDone(item)}
                            className="w-5 h-5 rounded-full border-2 border-accent bg-accent/20 hover:bg-accent/40 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                            title="Complete today's task"
                          />

                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-text-primary block truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-mono text-text-muted flex items-center gap-1 mt-0.5 truncate">
                              <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic?.title}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.time_estimate_value && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-border-subtle">
                              ⏱ {formatEffortBadge(item.time_estimate_value, (item.time_estimate_unit as any) || 'hours')}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => demoteFromToday(item.id)}
                            className="text-[10px] font-mono text-text-muted hover:text-text-primary bg-surface-subtle hover:bg-surface-raised px-2 py-1 rounded-md border border-border-subtle transition-colors cursor-pointer"
                            title="Return to Next backlog"
                          >
                            ↩
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {todayItems.length === 0 && (
                    <div className="text-center py-12 text-text-muted text-xs font-mono italic">
                      Nothing committed for today. Click ⭐ Today on any Next action on the left.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════
              WEEK MODE: UNIFIED FULL-WIDTH 7-DAY CALENDAR STRIP
             ═══════════════════════════════════════════════════════════════════ */
          <div data-tour="today-panel" className="col-span-1 lg:col-span-2 lane-glass rounded-xl p-4 flex flex-col transition-all min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-base">📅</span>
                <h2 className="font-sans font-bold text-text-primary text-sm">Weekly Action Calendar</h2>
                <div className="flex items-center p-0.5 bg-surface-subtle border border-border-subtle rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTodayOrWeek('today')}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                      todayOrWeek === 'today'
                        ? 'bg-accent text-white shadow-soft'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setTodayOrWeek('week')}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                      todayOrWeek === 'week'
                        ? 'bg-accent text-white shadow-soft'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Week
                  </button>
                </div>

                <span className="text-xs font-mono text-text-muted hidden sm:inline">
                  {weekRange.start} → {weekRange.end} ({weekItems.length} tasks scheduled)
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                <span>Click ✓ to complete</span>
              </div>
            </div>

            {/* 7-Day Columns Strip */}
            <div className="flex-1 grid grid-cols-7 gap-2.5 pt-3 overflow-y-auto min-h-0">
              {weekGrouped.map((dayGroup, idx) => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const isCurrentDay = dayGroup.dateStr === todayStr

                return (
                  <div
                    key={dayGroup.dayName}
                    className={`rounded-xl p-2.5 flex flex-col overflow-hidden border transition-all ${
                      isCurrentDay
                        ? 'bg-surface-raised border-accent shadow-md ring-1 ring-accent/50'
                        : 'bg-surface-card border-border-subtle'
                    }`}
                  >
                    {/* Day Column Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle shrink-0">
                      <div>
                        <span className={`text-xs font-mono font-bold uppercase block ${isCurrentDay ? 'text-accent' : 'text-text-primary'}`}>
                          {dayGroup.dayName.slice(0, 3)}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">
                          {dayGroup.dateStr ? dayGroup.dateStr.slice(5) : ''}
                        </span>
                      </div>

                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        dayGroup.items.length > 0 ? 'bg-accent-subtle text-accent border border-accent/20' : 'text-text-muted'
                      }`}>
                        {dayGroup.items.length}
                      </span>
                    </div>

                    {/* Day Task Items */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                      {dayGroup.items.map(item => {
                        const parentEpic = getEpic(item.epic_id)
                        const parentSector = getSector(parentEpic?.sector_id || '')
                        const sectorColor = parentSector ? `var(--color-${parentSector.color})` : 'var(--accent)'
                        const isDone = item.status === 'done'

                        return (
                          <div
                            key={item.id}
                            className={`p-2 rounded-lg border text-xs flex flex-col gap-1 transition-all shadow-sm ${
                              isDone
                                ? 'bg-surface-subtle border-border-subtle opacity-50 line-through'
                                : 'bg-surface-raised border-border-subtle hover:border-accent/40 text-text-primary'
                            }`}
                            style={{ borderLeft: `3px solid ${sectorColor}` }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleTodayDone(item)}
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                  isDone ? 'bg-done border-done text-white' : 'border-accent hover:bg-accent/20'
                                }`}
                              >
                                {isDone && <span className="text-[8px]">✓</span>}
                              </button>

                              <span className="text-xs font-semibold text-text-primary truncate flex-1" title={item.title}>
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-mono text-text-muted pl-5">
                              <span className="truncate" style={{ color: sectorColor }}>
                                {parentSector?.icon} {parentEpic?.title}
                              </span>
                              {item.status === 'today' && (
                                <span className="text-[8px] font-mono font-bold text-accent">⭐ TODAY</span>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {dayGroup.items.length === 0 && (
                        <div className="h-full flex items-center justify-center text-[10px] font-mono text-text-muted/40 italic text-center py-4">
                          No tasks
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
