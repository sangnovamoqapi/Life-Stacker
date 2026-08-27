import React, { useState, useEffect, useMemo } from 'react'
import type { Item, NextItem, ExploreItem, Sector, EffortTotal } from '../../preload/types'
import { useAppContext } from '../state/AppContext'
import { calculateEpicPace } from '../utils/pace'

export const CalendarView: React.FC = () => {
  const { items, exploreItems, nextItems, sectors, openItemModal } = useAppContext()
  const [effortTotals, setEffortTotals] = useState<EffortTotal[]>([])
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  // Expand/collapse states for Sectors and Epics
  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({})
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>({})
  const [collapsedExplore, setCollapsedExplore] = useState<Record<string, boolean>>({})

  useEffect(() => {
    window.api.effortLog.getTotals().then(res => setEffortTotals(res || [])).catch(() => setEffortTotals([]))
  }, [])

  const toggleSector = (id: string) => setCollapsedSectors(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleEpic = (id: string) => setCollapsedEpics(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleExploreTopic = (id: string) => setCollapsedExplore(prev => ({ ...prev, [id]: !prev[id] }))

  // Compute 4-Month Timeline Window
  const timelineMonths = useMemo(() => {
    const months: { monthIndex: number; year: number; name: string; startDate: Date; endDate: Date; totalWeeks: number }[] = []
    const baseYear = baseDate.getFullYear()
    const baseMonth = baseDate.getMonth()

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
        endDate: lastDay,
        totalWeeks: 4
      })
    }
    return months
  }, [baseDate])

  const timelineStart = timelineMonths[0].startDate
  const timelineEnd = timelineMonths[timelineMonths.length - 1].endDate
  const totalTimelineDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24))

  // Helper to convert any date into % horizontal position across the 4-month grid
  const getPercentOffset = (date: Date): number => {
    const diff = (date.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.min(100, (diff / totalTimelineDays) * 100))
  }

  // Active Epics grouped by Sector
  const sectorGroups = useMemo(() => {
    const activeEpics = items.filter(i => i.status === 'active').sort((a, b) => a.priority_rank - b.priority_rank)
    
    return sectors.map(sec => {
      const secEpics = activeEpics.filter(e => e.sector_id === sec.id)
      return {
        sector: sec,
        epics: secEpics
      }
    }).filter(g => g.epics.length > 0)
  }, [sectors, items])

  const handlePrevMonth = () => {
    setBaseDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setBaseDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    const d = new Date()
    d.setDate(1)
    setBaseDate(d)
  }

  // Today indicator position
  const todayPercent = getPercentOffset(new Date())

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-base text-text-primary">
      {/* ─── Top Control Bar ─── */}
      <div className="px-8 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h1 className="font-serif text-2xl font-bold text-text-primary tracking-tight">Timeline & Gantt Horizons</h1>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Hierarchical breakdown across Sectors, Active Epics, Explore Research, and Next Actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-mono text-text-secondary hover:text-text-primary bg-surface-subtle hover:bg-surface-raised border border-border-subtle rounded-lg transition-colors cursor-pointer"
          >
            Current Horizon
          </button>
          <div className="flex items-center bg-surface-subtle border border-border-subtle rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded cursor-pointer"
              title="Previous Month"
            >
              ◀
            </button>
            <span className="px-3 text-xs font-mono font-bold text-text-primary min-w-[170px] text-center">
              {timelineMonths[0].name} – {timelineMonths[3].name} {timelineMonths[3].year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded cursor-pointer"
              title="Next Month"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Gantt Table Grid (Reference Image 1) ─── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1100px] flex flex-col h-full">

          {/* Grid Header */}
          <div className="flex border-b border-border-subtle sticky top-0 z-20 bg-surface-raised select-none">
            {/* Left Header */}
            <div className="w-[340px] shrink-0 p-3.5 border-r border-border-subtle font-mono text-xs font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>PROJECT / SECTOR TREE</span>
              <span className="text-[10px] font-normal text-text-muted">Expand (▼)</span>
            </div>

            {/* Right Header: Months & W1-W4 Columns */}
            <div className="flex-1 grid grid-cols-4 divide-x divide-border-subtle">
              {timelineMonths.map(m => (
                <div key={`${m.year}-${m.monthIndex}`} className="flex flex-col text-center">
                  <div className="py-1.5 border-b border-border-subtle text-xs font-bold font-sans text-text-primary">
                    {m.name} {m.year !== timelineMonths[0].year ? m.year : ''}
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-border-subtle/50 text-[10px] font-mono text-text-muted py-1 bg-surface-subtle/40">
                    <span>W1</span>
                    <span>W2</span>
                    <span>W3</span>
                    <span>W4</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Rows Body */}
          <div className="flex-1 relative divide-y divide-border-subtle/60">

            {/* Global Today Vertical Marker Line */}
            {todayPercent >= 0 && todayPercent <= 100 && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                style={{ left: `calc(340px + (100% - 340px) * ${todayPercent / 100})` }}
              >
                <div className="w-px h-full bg-accent opacity-70" />
                <span className="text-[9px] font-mono font-bold text-accent bg-surface-card px-1 rounded shadow-sm absolute -top-1">
                  Today
                </span>
              </div>
            )}

            {sectorGroups.length === 0 ? (
              <div className="p-16 text-center text-xs font-mono text-text-muted italic">
                No active epics in your life stack. Add or activate epics in Lanes or Overview.
              </div>
            ) : (
              sectorGroups.map(({ sector, epics }) => {
                const isSecCollapsed = !!collapsedSectors[sector.id]
                const sectorColor = `var(--color-${sector.color})`

                return (
                  <div key={sector.id} className="divide-y divide-border-subtle/40">

                    {/* ─── LEVEL 0: SECTOR ROW ─── */}
                    <div className="flex items-center bg-surface-subtle/50 hover:bg-surface-raised transition-colors group min-h-[38px]">
                      {/* Left: Sector Header */}
                      <div
                        onClick={() => toggleSector(sector.id)}
                        className="w-[340px] shrink-0 px-4 py-2 border-r border-border-subtle flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-bold text-xs font-sans text-text-primary truncate">
                          <span className="text-text-muted text-[10px]">{isSecCollapsed ? '▶' : '▼'}</span>
                          <span className="text-sm">{sector.icon || '📁'}</span>
                          <span className="truncate">{sector.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle">
                          {epics.length} {epics.length === 1 ? 'epic' : 'epics'}
                        </span>
                      </div>

                      {/* Right: Sector Background strip */}
                      <div className="flex-1 h-full grid grid-cols-4 divide-x divide-border-subtle/30" />
                    </div>

                    {/* ─── LEVEL 1: ACTIVE EPICS UNDER SECTOR ─── */}
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
                      const barWidth = Math.max(4, targetPct - startPct)

                      return (
                        <React.Fragment key={epic.id}>
                          {/* Epic Row */}
                          <div className="flex items-center hover:bg-surface-subtle/40 transition-colors min-h-[44px]">
                            {/* Left: Epic title and chevron */}
                            <div className="w-[340px] shrink-0 pl-7 pr-4 py-2 border-r border-border-subtle flex items-center justify-between">
                              <div
                                onClick={() => toggleEpic(epic.id)}
                                className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                              >
                                <span className="text-[10px] text-text-muted">{isEpicCollapsed ? '▶' : '▼'}</span>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sectorColor }} />
                                <span className="text-xs font-bold text-text-primary truncate" title={epic.title}>
                                  {epic.title}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openItemModal(epic.id)}
                                className="text-[10px] font-mono text-text-muted hover:text-accent ml-2 shrink-0 cursor-pointer"
                                title="Open Epic Drawer"
                              >
                                #{epic.priority_rank} ↗
                              </button>
                            </div>

                            {/* Right: Epic Horizon Bar */}
                            <div className="flex-1 h-full relative flex items-center px-2">
                              {/* Grid background columns */}
                              <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/30 pointer-events-none" />

                              {/* Epic Pill Bar */}
                              <div
                                onClick={() => openItemModal(epic.id)}
                                className="h-6 rounded-full shadow-soft cursor-pointer transition-all hover:scale-[1.01] flex items-center px-3 justify-between z-1 relative group"
                                style={{
                                  left: `${startPct}%`,
                                  width: `${barWidth}%`,
                                  backgroundColor: sectorColor,
                                  color: '#ffffff'
                                }}
                                title={`${epic.title} (${execProgress}% done, velocity: ${pace.statusLabel})`}
                              >
                                <span className="text-[11px] font-sans font-bold truncate drop-shadow-sm">
                                  {epic.title}
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-black/30 px-1.5 py-0.2 rounded-full ml-1">
                                  {execProgress}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ─── LEVEL 2 & 3: EXPLORE TOPICS & NEXT ACTIONS ─── */}
                          {!isEpicCollapsed && (
                            <>
                              {/* Explore Topics */}
                              {epicsExplore.map(explore => {
                                const isExpCollapsed = !!collapsedExplore[explore.id]
                                const topicNextItems = epicsNext.filter(n => n.parent_explore_id === explore.id)

                                const expStart = new Date(explore.created_at)
                                const expEnd = new Date(explore.last_touched_at || explore.created_at)
                                const expStartPct = getPercentOffset(expStart)
                                const expWidth = Math.max(3, getPercentOffset(expEnd) - expStartPct + 4)

                                return (
                                  <React.Fragment key={explore.id}>
                                    {/* Explore Topic Row */}
                                    <div className="flex items-center hover:bg-surface-subtle/30 transition-colors min-h-[34px] bg-surface-subtle/10">
                                      {/* Left: Explore Topic with elbow indicator */}
                                      <div className="w-[340px] shrink-0 pl-11 pr-4 py-1.5 border-r border-border-subtle flex items-center justify-between">
                                        <div
                                          onClick={() => toggleExploreTopic(explore.id)}
                                          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                                        >
                                          <span className="text-text-muted text-[11px] select-none font-mono">└</span>
                                          <span className="text-[9px] text-text-muted">{isExpCollapsed ? '▶' : '▼'}</span>
                                          <span className="text-xs text-text-secondary truncate" title={explore.title}>
                                            🔬 {explore.title || 'Research Topic'}
                                          </span>
                                        </div>
                                        {explore.closed ? (
                                          <span className="text-[9px] font-mono text-done font-bold bg-done/10 px-1.5 py-0.2 rounded">CLOSED</span>
                                        ) : (
                                          <span className="text-[9px] font-mono text-text-muted">{topicNextItems.length} acts</span>
                                        )}
                                      </div>

                                      {/* Right: Explore Timeline Bar with Step Elbow Connector */}
                                      <div className="flex-1 h-full relative flex items-center px-2">
                                        <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/20 pointer-events-none" />

                                        <div
                                          className="h-4 rounded-md bg-accent-dim/50 border border-accent/40 shadow-sm flex items-center px-2 z-1 relative group cursor-pointer"
                                          style={{
                                            left: `${expStartPct}%`,
                                            width: `${expWidth}%`
                                          }}
                                          title={`Explore: ${explore.title}`}
                                        >
                                          <span className="text-[9px] font-mono text-accent font-semibold truncate">
                                            {explore.title}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Next actions under this explore topic */}
                                    {!isExpCollapsed && topicNextItems.map(action => {
                                      const isDone = action.status === 'done'
                                      const actionDate = action.due_date ? new Date(action.due_date) : new Date(action.created_at)
                                      const actionPct = getPercentOffset(actionDate)

                                      return (
                                        <div key={action.id} className="flex items-center hover:bg-surface-subtle/40 transition-colors min-h-[30px] bg-surface-subtle/20">
                                          <div className="w-[340px] shrink-0 pl-16 pr-4 py-1 border-r border-border-subtle flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <span className="text-text-muted text-[10px] select-none font-mono">├──</span>
                                              <span className="text-xs truncate font-sans text-text-primary" title={action.title}>
                                                {isDone ? '✅' : '⚡'} {action.title}
                                              </span>
                                            </div>
                                            {action.status === 'today' && (
                                              <span className="text-[8px] font-mono font-bold text-accent bg-accent-subtle px-1 rounded">TODAY</span>
                                            )}
                                          </div>

                                          <div className="flex-1 h-full relative flex items-center px-2">
                                            <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/15 pointer-events-none" />

                                            {/* Milestone Diamond / Dot Bar */}
                                            <div
                                              className={`h-3 rounded-full border flex items-center px-1.5 z-1 relative shadow-sm ${
                                                isDone 
                                                  ? 'bg-done text-white border-done' 
                                                  : 'bg-surface-raised border-border-strong text-text-primary'
                                              }`}
                                              style={{
                                                left: `${actionPct}%`,
                                                minWidth: '40px'
                                              }}
                                              title={`${action.title} (${action.due_date ? `Due: ${action.due_date}` : 'Created: ' + action.created_at.slice(0, 10)})`}
                                            >
                                              <span className="text-[8px] font-mono truncate">{action.due_date ? action.due_date.slice(5) : 'act'}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </React.Fragment>
                                )
                              })}

                              {/* Direct Next Actions (not under explore topic) */}
                              {epicsNext.filter(n => !n.parent_explore_id).map(action => {
                                const isDone = action.status === 'done'
                                const actionDate = action.due_date ? new Date(action.due_date) : new Date(action.created_at)
                                const actionPct = getPercentOffset(actionDate)

                                return (
                                  <div key={action.id} className="flex items-center hover:bg-surface-subtle/40 transition-colors min-h-[30px] bg-surface-subtle/15">
                                    <div className="w-[340px] shrink-0 pl-11 pr-4 py-1 border-r border-border-subtle flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-text-muted text-[11px] select-none font-mono">└</span>
                                        <span className="text-xs truncate font-sans text-text-primary" title={action.title}>
                                          {isDone ? '✅' : '⚡'} {action.title}
                                        </span>
                                      </div>
                                      {action.status === 'today' && (
                                        <span className="text-[8px] font-mono font-bold text-accent bg-accent-subtle px-1 rounded">TODAY</span>
                                      )}
                                    </div>

                                    <div className="flex-1 h-full relative flex items-center px-2">
                                      <div className="absolute inset-0 grid grid-cols-4 divide-x divide-border-subtle/15 pointer-events-none" />

                                      <div
                                        className={`h-3 rounded-full border flex items-center px-1.5 z-1 relative shadow-sm ${
                                          isDone 
                                            ? 'bg-done text-white border-done' 
                                            : 'bg-surface-raised border-border-strong text-text-primary'
                                        }`}
                                        style={{
                                          left: `${actionPct}%`,
                                          minWidth: '40px'
                                        }}
                                        title={`${action.title} (${action.due_date ? `Due: ${action.due_date}` : 'Created: ' + action.created_at.slice(0, 10)})`}
                                      >
                                        <span className="text-[8px] font-mono truncate">{action.due_date ? action.due_date.slice(5) : 'act'}</span>
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
    </div>
  )
}
