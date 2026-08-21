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
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        
        {/* Phase 4: Informational Pace & Velocity Tracker */}
        {burnTrackingEnabled && (
          <div className="glass-panel rounded-2xl p-6 space-y-5 border border-amber-500/20 shadow-xl bg-amber-950/[0.05]">
            <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <h2 className="font-sans text-xl font-bold text-slate-100">Pace & Velocity Tracker</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Derived burn rate and progress velocity across active horizons (informational).
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] uppercase text-slate-400 block">Total Active Burn</span>
                <span className="text-lg font-bold text-amber-400">
                  {totalWeeklyBurn.toFixed(1)} <span className="text-xs text-slate-300 font-normal">hrs/week</span>
                </span>
              </div>
            </div>

            {/* Active Epics Pace Rows */}
            <div className="space-y-3">
              {epicPaceList.map(({ epic, pace, execProgress }) => {
                const sec = sectors.find(s => s.id === epic.sector_id)
                const secColor = sec ? `var(--color-${sec.color})` : '#3b82f6'

                const budgetObj = typeof epic.time_budget === 'string' 
                  ? JSON.parse(epic.time_budget) 
                  : epic.time_budget

                return (
                  <div
                    key={epic.id}
                    onClick={() => openItemModal(epic.id)}
                    className="p-3.5 bg-black/30 rounded-xl border border-white/[0.06] hover:border-amber-400/40 transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: secColor }} />
                        <span className="text-xs font-bold text-slate-200 truncate">{epic.title}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          #{epic.priority_rank}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pace.velocityStatus !== 'no_budget' && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                            pace.velocityStatus === 'ahead'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : pace.velocityStatus === 'behind'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}>
                            {pace.statusLabel}
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-300 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">
                          {pace.totalHoursLogged.toFixed(1)}h logged
                        </span>
                      </div>
                    </div>

                    {/* Progress vs Elapsed Horizon Comparison */}
                    {budgetObj && budgetObj.value && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Execution Progress: <strong className="text-emerald-400">{execProgress}%</strong></span>
                          <span>
                            Horizon: <strong>{budgetObj.value} {budgetObj.unit}</strong> ({pace.timeElapsedPercent}% elapsed)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-400 rounded-full transition-all" 
                              style={{ width: `${execProgress}%` }} 
                            />
                          </div>
                          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-400 rounded-full transition-all" 
                              style={{ width: `${pace.timeElapsedPercent || 0}%` }} 
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5">
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
                <div className="text-center py-6 text-slate-500 text-xs font-mono italic">
                  No active epics currently tracking.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sector Effort Breakdown Card */}
        <div className="glass-panel rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="font-sans text-xl font-bold text-slate-100">Effort Statistics</h2>
              <p className="text-xs text-slate-400 mt-1">
                Total focused time recorded per life sector (All-time: <strong className="text-blue-400">{totalAllTimeHours.toFixed(1)} hrs</strong>).
              </p>
            </div>
            
            <div className="flex bg-black/30 p-1 rounded-xl border border-white/[0.08] gap-1">
              {(['7d', '30d', 'all'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-1 text-xs font-mono rounded-lg transition-colors capitalize ${
                    period === p ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p === 'all' ? 'All time' : `Last ${p}`}
                </button>
              ))}
            </div>
          </div>

          {sectorTotals.length === 0 ? (
            <div className="text-center text-slate-500 py-16 font-sans italic text-sm">
              No effort logged yet. Check off next actions or log effort in epics to see stats here.
            </div>
          ) : (
            <div className="space-y-3">
              {sectorTotals.map(sec => (
                <div key={sec.id} className="bg-black/30 rounded-xl border border-white/[0.06] overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => setExpandedSector(expandedSector === sec.id ? null : sec.id)}
                  >
                    <div className="flex items-center gap-3 w-1/3 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${sec.color})` }} />
                      <span className="font-sans text-sm font-semibold text-slate-100 truncate">{sec.name}</span>
                    </div>
                    
                    <div className="flex-1 px-4">
                      <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ width: `${(sec.total_hours_equiv / maxHours) * 100}%`, backgroundColor: `var(--color-${sec.color})` }} 
                        />
                      </div>
                    </div>
                    
                    <div className="w-1/4 text-right font-mono text-sm font-bold text-blue-400">
                      {sec.hours}h {sec.days > 0 ? `, ${sec.days}d` : ''}
                    </div>
                  </div>

                  {expandedSector === sec.id && (
                    <div className="bg-black/40 border-t border-white/[0.06] p-4 space-y-2">
                      {sec.items.sort((a,b) => b.total_hours - a.total_hours).map(item => (
                        <div 
                          key={item.item_id} 
                          className="flex justify-between items-center text-xs cursor-pointer hover:bg-white/[0.04] p-2 rounded-lg transition-colors"
                          onClick={() => openItemModal(item.item_id)}
                        >
                          <span className="text-slate-300 hover:text-blue-300 truncate max-w-md font-medium">{item.item_title}</span>
                          <span className="font-mono text-slate-400">
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
