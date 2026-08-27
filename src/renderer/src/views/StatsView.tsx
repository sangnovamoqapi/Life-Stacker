import React, { useState, useEffect } from 'react'
import { useAppContext } from '../state/AppContext'
import type { EffortTotal, Item } from '../types'
import { calculateEpicPace, EpicPaceInfo } from '../utils/pace'

export const StatsView: React.FC = () => {
  const { sectors, items, settings, openItemModal, getExecutionProgress } = useAppContext()
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d')
  const [totals, setTotals] = useState<EffortTotal[]>([])
  const [expandedSector, setExpandedSector] = useState<string | null>(null)

  useEffect(() => {
    window.api.effortLog.getTotals().then(setTotals)
  }, [period])

  // Group by sector
  const sectorTotals = sectors.map(sec => {
    const secItems = totals.filter(t => t.sector_id === sec.id)
    const hours = secItems.reduce((acc, t) => acc + t.entries_hours, 0)
    const days = secItems.reduce((acc, t) => acc + t.entries_days, 0)
    const total_hours_equiv = secItems.reduce((acc, t) => acc + t.total_hours, 0)
    return { ...sec, hours, days, total_hours_equiv, items: secItems }
  }).filter(s => s.total_hours_equiv > 0)

  sectorTotals.sort((a, b) => b.total_hours_equiv - a.total_hours_equiv)
  
  const maxHours = Math.max(...sectorTotals.map(s => s.total_hours_equiv), 1)

  // Active Epics Pace & Burn metrics
  const activeEpics = items.filter(i => i.status === 'active')
  const epicPaceList: { epic: Item; pace: EpicPaceInfo; execProgress: number }[] = activeEpics.map(epic => {
    const itemTotal = totals.find(t => t.item_id === epic.id)
    const execProgress = getExecutionProgress(epic.id)
    const pace = calculateEpicPace(
      epic.created_at,
      epic.time_budget,
      execProgress,
      itemTotal?.entries_hours || 0,
      itemTotal?.entries_days || 0
    )
    return { epic, pace, execProgress }
  })

  const totalWeeklyBurn = epicPaceList.reduce((sum, e) => sum + e.pace.weeklyBurnHours, 0)
  const totalAllTimeHours = totals.reduce((sum, t) => sum + t.total_hours, 0)
  const burnTrackingEnabled = settings.burn_tracking_enabled !== false

  return (
    <div className="flex-1 overflow-y-auto p-8 text-text-primary">
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        
        {/* Phase 4: Informational Pace & Velocity Tracker */}
        {burnTrackingEnabled && (
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <h2 className="font-sans text-xl font-bold text-text-primary">Pace & Velocity Tracker</h2>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Derived burn rate and progress velocity across active horizons (informational).
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] uppercase text-text-muted block">Total Active Burn</span>
                <span className="text-lg font-bold text-accent">
                  {totalWeeklyBurn.toFixed(1)} <span className="text-xs text-text-muted font-normal">hrs/week</span>
                </span>
              </div>
            </div>

            {/* Active Epics Pace Rows */}
            <div className="space-y-3">
              {epicPaceList.map(({ epic, pace, execProgress }) => {
                const sec = sectors.find(s => s.id === epic.sector_id)
                const secColor = sec ? `var(--color-${sec.color})` : 'var(--accent)'

                const budgetObj = typeof epic.time_budget === 'string' 
                  ? JSON.parse(epic.time_budget) 
                  : epic.time_budget

                return (
                  <div
                    key={epic.id}
                    onClick={() => openItemModal(epic.id)}
                    className="p-3.5 bg-surface-subtle rounded-xl border border-border-subtle hover:border-accent/40 transition-all cursor-pointer space-y-2.5 shadow-soft"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: secColor }} />
                        <span className="text-xs font-bold text-text-primary truncate">{epic.title}</span>
                        <span className="text-[10px] font-mono text-text-muted">
                          #{epic.priority_rank}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pace.velocityStatus !== 'no_budget' && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                            pace.velocityStatus === 'ahead'
                              ? 'bg-done/15 text-done border-done/30'
                              : pace.velocityStatus === 'behind'
                              ? 'bg-accent/15 text-accent border-accent/30'
                              : 'bg-surface-raised text-text-secondary border-border-subtle'
                          }`}>
                            {pace.statusLabel}
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-text-secondary bg-surface-card px-2 py-0.5 rounded border border-border-subtle">
                          {pace.totalHoursLogged.toFixed(1)}h logged
                        </span>
                      </div>
                    </div>

                    {/* Progress vs Elapsed Horizon Comparison */}
                    {budgetObj && budgetObj.value && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                          <span>Execution Progress: <strong className="text-done">{execProgress}%</strong></span>
                          <span>
                            Horizon: <strong>{budgetObj.value} {budgetObj.unit}</strong> ({pace.timeElapsedPercent}% elapsed)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-done rounded-full transition-all" 
                              style={{ width: `${execProgress}%` }} 
                            />
                          </div>
                          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-accent rounded-full transition-all" 
                              style={{ width: `${pace.timeElapsedPercent || 0}%` }} 
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-mono text-text-muted pt-0.5">
                          <span>Burn: {pace.weeklyBurnHours.toFixed(1)} hrs/wk</span>
                          {pace.projectedWeeksToComplete && (
                            <span>Est. ~{pace.projectedWeeksToComplete} weeks to finish at current velocity</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {epicPaceList.length === 0 && (
                <div className="text-center py-6 text-text-muted text-xs font-mono italic">
                  No active epics currently tracking.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sector Effort Breakdown Card */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-6 shadow-soft">
          <div className="flex justify-between items-center border-b border-border-subtle pb-4">
            <div>
              <h2 className="font-sans text-xl font-bold text-text-primary">Effort Statistics</h2>
              <p className="text-xs text-text-muted mt-1">
                Total focused time recorded per life sector (All-time: <strong className="text-accent">{totalAllTimeHours.toFixed(1)} hrs</strong>).
              </p>
            </div>
            
            <div className="flex bg-surface-subtle p-1 rounded-xl border border-border-subtle gap-1">
              {(['7d', '30d', 'all'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-1 text-xs font-mono rounded-lg transition-colors capitalize cursor-pointer ${
                    period === p ? 'bg-surface-card text-text-primary font-bold shadow-soft border border-border-subtle' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {p === 'all' ? 'All time' : `Last ${p}`}
                </button>
              ))}
            </div>
          </div>

          {sectorTotals.length === 0 ? (
            <div className="text-center text-text-muted py-16 font-sans italic text-sm">
              No effort logged yet. Check off next actions or log effort in epics to see stats here.
            </div>
          ) : (
            <div className="space-y-3">
              {sectorTotals.map(sec => (
                <div key={sec.id} className="bg-surface-subtle rounded-xl border border-border-subtle overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-raised transition-colors"
                    onClick={() => setExpandedSector(expandedSector === sec.id ? null : sec.id)}
                  >
                    <div className="flex items-center gap-3 w-1/3 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${sec.color})` }} />
                      <span className="font-sans text-sm font-semibold text-text-primary truncate">{sec.name}</span>
                    </div>
                    
                    <div className="flex-1 px-4">
                      <div className="h-2 bg-surface-card rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ width: `${(sec.total_hours_equiv / maxHours) * 100}%`, backgroundColor: `var(--color-${sec.color})` }} 
                        />
                      </div>
                    </div>
                    
                    <div className="w-1/4 text-right font-mono text-sm font-bold text-accent">
                      {sec.hours}h {sec.days > 0 ? `, ${sec.days}d` : ''}
                    </div>
                  </div>

                  {expandedSector === sec.id && (
                    <div className="bg-surface-raised border-t border-border-subtle p-4 space-y-2">
                      {sec.items.sort((a,b) => b.total_hours - a.total_hours).map(item => (
                        <div 
                          key={item.item_id} 
                          className="flex justify-between items-center text-xs cursor-pointer hover:bg-surface-card p-2 rounded-lg transition-colors"
                          onClick={() => openItemModal(item.item_id)}
                        >
                          <span className="text-text-primary hover:text-accent truncate max-w-md font-medium">{item.item_title}</span>
                          <span className="font-mono text-text-muted">
                            {item.entries_hours}h {item.entries_days > 0 ? `, ${item.entries_days}d` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
