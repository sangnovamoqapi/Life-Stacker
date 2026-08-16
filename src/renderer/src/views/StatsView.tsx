import React, { useState, useEffect } from 'react'
import { useAppContext } from '../state/AppContext'
import type { EffortTotal } from '../types'

export const StatsView: React.FC = () => {
  const { sectors, openItemModal } = useAppContext()
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

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        
        {/* Main Stats Card */}
        <div className="glass-panel rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="font-sans text-2xl font-bold text-slate-100">Effort Statistics</h2>
              <p className="text-xs text-slate-400 mt-1">Total focused time recorded per life sector.</p>
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
              No effort logged yet. Check off next actions or log effort to see stats here.
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
