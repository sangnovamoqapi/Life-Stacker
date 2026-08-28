import React, { useState, useEffect, useMemo } from 'react'
import type { Item, NextItem, ExploreItem, Sector, EffortTotal } from '../../preload/types'
import { useAppContext } from '../state/AppContext'
import { calculateEpicPace } from '../utils/pace'

export const CalendarView: React.FC = () => {
  const { items, exploreItems, nextItems, sectors, openItemModal, updateNextItemStatus, showToast } = useAppContext()
  const [viewMode, setViewMode] = useState<'calendar' | 'gantt'>('calendar')
  const [effortTotals, setEffortTotals] = useState<EffortTotal[]>([])

  // Calendar Date State (selected month)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())

  // Gantt collapse state
  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({})
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>({})
  const [collapsedExplore, setCollapsedExplore] = useState<Record<string, boolean>>({})

  useEffect(() => {
    window.api.effortLog.getTotals().then(res => setEffortTotals(res || [])).catch(() => setEffortTotals([]))
  }, [])

  const toggleSector = (id: string) => setCollapsedSectors(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleEpic = (id: string) => setCollapsedEpics(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleExploreTopic = (id: string) => setCollapsedExplore(prev => ({ ...prev, [id]: !prev[id] }))

  // Helper map for sectors and epics
  const sectorMap = useMemo(() => {
    const map: Record<string, Sector> = {}
    sectors.forEach(s => { map[s.id] = s })
    return map
  }, [sectors])

  const epicMap = useMemo(() => {
    const map: Record<string, Item> = {}
    items.forEach(i => { map[i.id] = i })
    return map
  }, [items])

  // Flatten all next actions across all epics
  const allNextActions = useMemo(() => {
    const all: NextItem[] = []
    Object.values(nextItems).forEach(list => {
      list.forEach(item => all.push(item))
    })
    return all
  }, [nextItems])

  const todayIsoStr = new Date().toISOString().slice(0, 10)

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR GRID COMPUTATIONS (Teams / Google Calendar style)
  // ═══════════════════════════════════════════════════════════════════════════
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    // Starting day of the week (0 = Sun, 1 = Mon... convert to Monday-first: Mon=0, Sun=6)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean; tasks: NextItem[] }[] = []

    // Previous month filler days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      const dStr = d.toISOString().slice(0, 10)
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayIsoStr,
        tasks: allNextActions.filter(t => t.due_date === dStr)
      })
    }

    // Current month days
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const d = new Date(year, month, day)
      const dStr = d.toISOString().slice(0, 10)
      
      // Collect tasks for this day:
      // 1. Next items explicitly scheduled on this due_date
      // 2. Or items marked 'today' when viewing today's cell
      const dayTasks = allNextActions.filter(t => {
        if (t.due_date === dStr) return true
        if (dStr === todayIsoStr && t.status === 'today') return true
        return false
      })

      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayIsoStr,
        tasks: dayTasks
      })
    }

    // Next month filler days (fill up to 35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42
    const remainingCells = totalCells - days.length
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(year, month + 1, day)
      const dStr = d.toISOString().slice(0, 10)
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayIsoStr,
        tasks: allNextActions.filter(t => t.due_date === dStr)
      })
    }

    return days
  }, [currentDate, allNextActions, todayIsoStr])

  // ═══════════════════════════════════════════════════════════════════════════
  // GANTT COMPUTATIONS (4-Month Timeline Window)
  // ═══════════════════════════════════════════════════════════════════════════
  const timelineMonths = useMemo(() => {
    const months: { monthIndex: number; year: number; name: string; startDate: Date; endDate: Date }[] = []
    const baseYear = currentDate.getFullYear()
    const baseMonth = currentDate.getMonth()

    for (let i = 0; i < 4; i++) {
      const d = new Date(baseYear, baseMonth + i, 1)
      const yr = d.getFullYear()
      const mIdx = d.getMonth()
      const name = d.toLocaleString('default', { month: 'long' })
      const lastDay = new Date(yr, mIdx + 1, 0)

      months.push({
        monthIndex: mIdx,
        year: yr,
        name,
        startDate: d,
        endDate: lastDay
      })
    }
    return months
  }, [currentDate])

  const timelineStart = timelineMonths[0].startDate
  const timelineEnd = timelineMonths[timelineMonths.length - 1].endDate
  const totalTimelineDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24))

  const getPercentOffset = (date: Date): number => {
    const diff = (date.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.min(100, (diff / totalTimelineDays) * 100))
  }

  const activeEpicsBySector = useMemo(() => {
    const active = items.filter(i => i.status === 'active').sort((a, b) => a.priority_rank - b.priority_rank)
    return sectors.map(sec => ({
      sector: sec,
      epics: active.filter(e => e.sector_id === sec.id)
    })).filter(g => g.epics.length > 0)
  }, [sectors, items])

  const handlePrev = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNext = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleGoToday = () => {
    setCurrentDate(new Date())
  }

  const handleToggleTaskDone = async (task: NextItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = task.status === 'done' ? 'next' : 'done'
    try {
      await updateNextItemStatus(task.id, newStatus)
      showToast(newStatus === 'done' ? 'Action completed! 🎉' : 'Action reopened', 'info')
    } catch {
      showToast('Error updating action status', 'error')
    }
  }

  const todayGanttPercent = getPercentOffset(new Date())

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-base text-text-primary">
      {/* ─── Top Control Bar with Segmented View Switcher ─── */}
      <header className="px-8 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-card shadow-soft">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{viewMode === 'calendar' ? '📅' : '📊'}</span>
            <h1 className="font-sans font-bold text-lg text-text-primary tracking-tight">
              {viewMode === 'calendar' ? 'Calendar & Scheduling' : 'Gantt Horizon Timeline'}
            </h1>
          </div>

          {/* Segmented Switch: Calendar Grid vs Gantt Timeline */}
          <div className="flex items-center p-0.5 bg-surface-subtle border border-border-subtle rounded-xl shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-accent text-white shadow-soft'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>📅</span> Calendar Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'gantt'
                  ? 'bg-accent text-white shadow-soft'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>📊</span> Gantt Timeline
            </button>
          </div>
        </div>

        {/* Date Navigator Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1 text-xs font-mono font-bold text-accent bg-accent-subtle hover:bg-accent hover:text-white border border-accent/30 rounded-lg transition-all cursor-pointer shadow-soft"
          >
            Today
          </button>

          <div className="flex items-center bg-surface-subtle border border-border-subtle rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
              title="Previous Month"
            >
              ◀
            </button>
            <span className="px-4 text-xs font-mono font-bold text-text-primary min-w-[160px] text-center">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
              title="Next Month"
            >
              ▶
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 1: TEAMS / GOOGLE CALENDAR MONTH GRID
         ═══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'calendar' && (
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-2 pb-2 text-center text-xs font-mono font-bold text-text-muted select-none">
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
            <span>SUN</span>
          </div>

          {/* Month Day Cells Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-2 overflow-hidden min-h-0">
            {calendarDays.slice(0, 35).map(day => {
              const isToday = day.isToday
              return (
                <div
                  key={day.dateStr}
                  className={`border rounded-xl p-2.5 flex flex-col justify-between overflow-hidden transition-all relative ${
                    isToday
                      ? 'bg-surface-raised border-accent ring-1 ring-accent/60 shadow-md'
                      : day.isCurrentMonth
                      ? 'bg-surface-card border-border-subtle hover:border-border-strong'
                      : 'bg-surface-subtle/30 border-border-subtle/40 opacity-40'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between shrink-0 mb-1.5">
                    {isToday ? (
                      <span className="text-[10px] font-mono font-bold text-accent bg-accent-subtle px-1.5 py-0.2 rounded border border-accent/30">
                        Today
                      </span>
                    ) : <span />}

                    <span className={`text-xs font-mono font-bold ${
                      isToday ? 'text-accent text-sm' : day.isCurrentMonth ? 'text-text-primary' : 'text-text-muted'
                    }`}>
                      {day.date.getDate()}
                    </span>
                  </div>

                  {/* Day Tasks List */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {day.tasks.map(task => {
                      const parentEpic = epicMap[task.epic_id]
                      const parentSec = parentEpic ? sectorMap[parentEpic.sector_id] : null
                      const sectorColor = parentSec ? `var(--color-${parentSec.color})` : 'var(--accent)'
                      const isDone = task.status === 'done'
                      const isTodayFlagged = task.status === 'today'

                      return (
                        <div
                          key={task.id}
                          onClick={() => parentEpic && openItemModal(parentEpic.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-pointer transition-all shadow-sm ${
                            isDone
                              ? 'bg-surface-subtle border-border-subtle opacity-50 line-through'
                              : isTodayFlagged
                              ? 'bg-accent/15 border-accent text-text-primary font-semibold'
                              : 'bg-surface-raised border-border-subtle hover:border-accent/40 text-text-primary'
                          }`}
                          style={{ borderLeft: `3px solid ${sectorColor}` }}
                          title={`${task.title} (Epic: ${parentEpic?.title || 'Unknown'})`}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleToggleTaskDone(task, e)}
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              isDone ? 'bg-done border-done text-white' : 'border-accent hover:bg-accent/20'
                            }`}
                          >
                            {isDone && <span className="text-[8px]">✓</span>}
                          </button>

                          <span className="truncate flex-1 font-sans text-[11px]">
                            {task.title}
                          </span>

                          {isTodayFlagged && (
                            <span className="text-[8px] font-mono text-accent font-bold">⭐</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 2: SNAPPY, HIGH-CONTRAST GANTT CHART
         ═══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'gantt' && (
        <div className="flex-1 overflow-auto bg-surface-base">
          <div className="min-w-[1100px] flex flex-col h-full">

            {/* Gantt Header */}
            <div className="flex border-b border-border-subtle sticky top-0 z-20 bg-surface-raised select-none shadow-sm">
              <div className="w-[340px] shrink-0 p-3.5 border-r border-border-subtle font-mono text-xs font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                <span>PROJECT / SECTOR TREE</span>
                <span className="text-[10px] font-normal text-text-muted">Expand (▼)</span>
              </div>

              <div className="flex-1 grid grid-cols-4 divide-x divide-border-subtle">
                {timelineMonths.map(m => (
                  <div key={`${m.year}-${m.monthIndex}`} className="flex flex-col text-center">
                    <div className="py-1.5 border-b border-border-subtle text-xs font-bold font-sans text-text-primary bg-surface-card">
                      {m.name} {m.year !== timelineMonths[0].year ? m.year : ''}
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-border-subtle/50 text-[10px] font-mono text-text-muted py-1 bg-surface-subtle/50">
                      <span>W1</span>
                      <span>W2</span>
                      <span>W3</span>
                      <span>W4</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Rows Container */}
            <div className="flex-1 relative divide-y divide-border-subtle/60">
              {/* Today Vertical Red Line */}
              {todayGanttPercent >= 0 && todayGanttPercent <= 100 && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                  style={{ left: `calc(340px + (100% - 340px) * ${todayGanttPercent / 100})` }}
                >
                  <div className="w-0.5 h-full bg-red-500 opacity-80" />
                  <span className="text-[9px] font-mono font-bold text-white bg-red-500 px-1 rounded shadow absolute -top-1">
                    Today
                  </span>
                </div>
              )}

              {activeEpicsBySector.length === 0 ? (
                <div className="p-16 text-center text-xs font-mono text-text-muted italic">
                  No active epics found. Add or activate epics in Overview or Lanes.
                </div>
              ) : (
                activeEpicsBySector.map(({ sector, epics }) => {
                  const isSecCollapsed = !!collapsedSectors[sector.id]
                  const sectorColor = `var(--color-${sector.color})`

                  return (
                    <div key={sector.id} className="divide-y divide-border-subtle/40">
                      {/* Sector Level Row */}
                      <div className="flex items-center bg-surface-subtle/60 hover:bg-surface-raised transition-colors min-h-[38px]">
                        <div
                          onClick={() => toggleSector(sector.id)}
                          className="w-[340px] shrink-0 px-4 py-2 border-r border-border-subtle flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2 font-bold text-xs font-sans text-text-primary truncate">
                            <span className="text-text-muted text-[10px]">{isSecCollapsed ? '▶' : '▼'}</span>
                            <span className="text-sm">{sector.icon || '📁'}</span>
                            <span className="truncate">{sector.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-text-muted bg-surface-card px-2 py-0.5 rounded border border-border-subtle">
                            {epics.length} {epics.length === 1 ? 'epic' : 'epics'}
                          </span>
                        </div>
                        <div className="flex-1 h-full grid grid-cols-4 divide-x divide-border-subtle/30" />
                      </div>

                      {/* Epics Rows */}
                      {!isSecCollapsed && epics.map(epic => {
                        const isEpicCollapsed = !!collapsedEpics[epic.id]
                        const epicsExplore = exploreItems[epic.id] || []
                        const epicsNext = nextItems[epic.id] || []
                        const itemTotal = effortTotals.find(t => t.item_id === epic.id)

                        const doneCount = epicsNext.filter(n => n.status === 'done').length
                        const execProgress = epicsNext.length > 0 ? Math.round((doneCount / epicsNext.length) * 100) : epic.progress

                        const pace = calculateEpicPace(
                          epic.created_at,
                          epic.time_budget,
                          execProgress,
                          itemTotal?.entries_hours || 0,
                          itemTotal?.entries_days || 0
                        )

                        const startDate = new Date(epic.created_at)
                        const targetDate = pace.budgetDays
                          ? new Date(startDate.getTime() + pace.budgetDays * 24 * 60 * 60 * 1000)
                          : new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000)

                        const startPct = getPercentOffset(startDate)
                        const targetPct = getPercentOffset(targetDate)
                        const barWidth = Math.max(5, targetPct - startPct)

                        return (
                          <React.Fragment key={epic.id}>
                            {/* Epic Horizon Row */}
                            <div className="flex items-center hover:bg-surface-subtle/40 transition-colors min-h-[44px]">
                              <div className="w-[340px] shrink-0 pl-7 pr-4 py-2 border-r border-border-subtle flex items-center justify-between">
                                <div
                                  onClick={() => toggleEpic(epic.id)}
                                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                                >
                                  <span className="text-[10px] text-text-muted">{isEpicCollapsed ? '▶' : '▼'}</span>
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sectorColor }} />
                                  <span className="text-xs font-bold text-text-primary truncate" title={epic.title}>
                                    {epic.title}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openItemModal(epic.id)}
                                  className="text-[10px] font-mono text-text-muted hover:text-accent ml-2 shrink-0 cursor-pointer"
                                >
                                  #{epic.priority_rank} ↗
                                </button>
                              </div>

                              <div className="flex-1 h-full relative flex items-center px-2">
                                <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/30 pointer-events-none" />

                                <div
                                  onClick={() => openItemModal(epic.id)}
                                  className="h-6 rounded-full shadow-md cursor-pointer transition-transform hover:scale-[1.01] flex items-center px-3 justify-between z-1 relative"
                                  style={{
                                    left: `${startPct}%`,
                                    width: `${barWidth}%`,
                                    backgroundColor: sectorColor,
                                    color: '#ffffff'
                                  }}
                                  title={`${epic.title} (${execProgress}% done)`}
                                >
                                  <span className="text-[11px] font-sans font-bold truncate drop-shadow-sm">
                                    {epic.title}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold bg-black/35 px-1.5 py-0.2 rounded-full ml-1 shrink-0">
                                    {execProgress}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Explore Topics & Next Actions with Connector Brackets */}
                            {!isEpicCollapsed && (
                              <>
                                {epicsExplore.map(explore => {
                                  const isExpCollapsed = !!collapsedExplore[explore.id]
                                  const topicNext = epicsNext.filter(n => n.parent_explore_id === explore.id)

                                  const expStart = new Date(explore.created_at)
                                  const expEnd = new Date(explore.last_touched_at || explore.created_at)
                                  const expStartPct = getPercentOffset(expStart)
                                  const expWidth = Math.max(4, getPercentOffset(expEnd) - expStartPct + 4)

                                  return (
                                    <React.Fragment key={explore.id}>
                                      <div className="flex items-center hover:bg-surface-subtle/30 transition-colors min-h-[34px] bg-surface-subtle/10">
                                        <div className="w-[340px] shrink-0 pl-11 pr-4 py-1.5 border-r border-border-subtle flex items-center justify-between">
                                          <div
                                            onClick={() => toggleExploreTopic(explore.id)}
                                            className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                                          >
                                            <span className="text-text-muted text-[11px] font-mono select-none">└</span>
                                            <span className="text-[9px] text-text-muted">{isExpCollapsed ? '▶' : '▼'}</span>
                                            <span className="text-xs text-text-secondary truncate">
                                              🔬 {explore.title || 'Research Topic'}
                                            </span>
                                          </div>
                                          <span className="text-[9px] font-mono text-text-muted">{topicNext.length} acts</span>
                                        </div>

                                        <div className="flex-1 h-full relative flex items-center px-2">
                                          <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/20 pointer-events-none" />

                                          <div
                                            className="h-4 rounded-md bg-purple-900/60 border border-purple-500/50 shadow-sm flex items-center px-2 z-1 relative"
                                            style={{
                                              left: `${expStartPct}%`,
                                              width: `${expWidth}%`
                                            }}
                                            title={`Explore: ${explore.title}`}
                                          >
                                            <span className="text-[9px] font-mono text-purple-200 font-semibold truncate">
                                              {explore.title}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {!isExpCollapsed && topicNext.map(act => {
                                        const isDone = act.status === 'done'
                                        const actDate = act.due_date ? new Date(act.due_date) : new Date(act.created_at)
                                        const actPct = getPercentOffset(actDate)

                                        return (
                                          <div key={act.id} className="flex items-center hover:bg-surface-subtle/40 transition-colors min-h-[30px] bg-surface-subtle/20">
                                            <div className="w-[340px] shrink-0 pl-16 pr-4 py-1 border-r border-border-subtle flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                <span className="text-text-muted text-[10px] font-mono select-none">├──</span>
                                                <span className="text-xs truncate font-sans text-text-primary">
                                                  {isDone ? '✅' : '⚡'} {act.title}
                                                </span>
                                              </div>
                                              {act.status === 'today' && (
                                                <span className="text-[8px] font-mono font-bold text-accent bg-accent-subtle px-1 rounded">TODAY</span>
                                              )}
                                            </div>

                                            <div className="flex-1 h-full relative flex items-center px-2">
                                              <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/15 pointer-events-none" />

                                              <div
                                                className={`h-3.5 rounded-full border flex items-center px-2 z-1 relative shadow-sm ${
                                                  isDone
                                                    ? 'bg-done text-white border-done'
                                                    : 'bg-surface-card border-border-strong text-text-primary'
                                                }`}
                                                style={{ left: `${actPct}%`, minWidth: '45px' }}
                                                title={`${act.title} (${act.due_date ? `Due: ${act.due_date}` : 'Created: ' + act.created_at.slice(0, 10)})`}
                                              >
                                                <span className="text-[8px] font-mono truncate">{act.due_date ? act.due_date.slice(5) : 'act'}</span>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </React.Fragment>
                                  )
                                })}

                                {epicsNext.filter(n => !n.parent_explore_id).map(act => {
                                  const isDone = act.status === 'done'
                                  const actDate = act.due_date ? new Date(act.due_date) : new Date(act.created_at)
                                  const actPct = getPercentOffset(actDate)

                                  return (
                                    <div key={act.id} className="flex items-center hover:bg-surface-subtle/40 transition-colors min-h-[30px] bg-surface-subtle/15">
                                      <div className="w-[340px] shrink-0 pl-11 pr-4 py-1 border-r border-border-subtle flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <span className="text-text-muted text-[11px] font-mono select-none">└</span>
                                          <span className="text-xs truncate font-sans text-text-primary">
                                            {isDone ? '✅' : '⚡'} {act.title}
                                          </span>
                                        </div>
                                        {act.status === 'today' && (
                                          <span className="text-[8px] font-mono font-bold text-accent bg-accent-subtle px-1 rounded">TODAY</span>
                                        )}
                                      </div>

                                      <div className="flex-1 h-full relative flex items-center px-2">
                                        <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/15 pointer-events-none" />

                                        <div
                                          className={`h-3.5 rounded-full border flex items-center px-2 z-1 relative shadow-sm ${
                                            isDone
                                              ? 'bg-done text-white border-done'
                                              : 'bg-surface-card border-border-strong text-text-primary'
                                          }`}
                                          style={{ left: `${actPct}%`, minWidth: '45px' }}
                                          title={`${act.title} (${act.due_date ? `Due: ${act.due_date}` : 'Created: ' + act.created_at.slice(0, 10)})`}
                                        >
                                          <span className="text-[8px] font-mono truncate">{act.due_date ? act.due_date.slice(5) : 'act'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </>
                            )}
                          </React.Fragment>
                        )
                      })}

                    </div>
                  )
                })
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
