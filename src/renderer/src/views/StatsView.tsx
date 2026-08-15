import React, { useState, useEffect } from 'react'
import { useAppContext } from '../state/AppContext'
import type { EffortTotal } from '../types'

export const StatsView: React.FC = () => {
  const { sectors, openItemModal } = useAppContext()
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d')
  const [totals, setTotals] = useState<EffortTotal[]>([])
  const [expandedSector, setExpandedSector] = useState<string | null>(null)

  useEffect(() => {
    // In a real app, API would filter by period. For now we load all totals.
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
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="flex justify-between items-end border-b border-border-soft pb-4">
          <h2 className="font-serif text-3xl text-ink">Effort Statistics</h2>
          <div className="flex bg-bg-raised p-1 rounded-md border border-border-soft">
            {(['7d', '30d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  period === p ? 'bg-border text-active' : 'text-ink-dim hover:text-ink'
                }`}
              >
                {p === 'all' ? 'All time' : `Last ${p}`}
              </button>
            ))}
          </div>
        </div>

        {sectorTotals.length === 0 ? (
          <div className="text-center text-ink-faint py-12 font-serif italic text-lg">
            No effort logged yet.
          </div>
        ) : (
          <div className="space-y-6">
            {sectorTotals.map(sec => (
              <div key={sec.id} className="bg-bg-raised rounded-lg border border-border overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-card-hover transition-colors"
                  onClick={() => setExpandedSector(expandedSector === sec.id ? null : sec.id)}
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${sec.color})` }} />
                    <span className="font-serif text-lg text-ink font-medium truncate">{sec.name}</span>
                  </div>
                  
                  <div className="flex-1 px-4">
                    <div className="h-2 bg-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(sec.total_hours_equiv / maxHours) * 100}%`, backgroundColor: `var(--color-${sec.color})` }} 
                      />
                    </div>
                  </div>
                  
                  <div className="w-1/4 text-right font-mono text-sm text-ink">
                    {sec.hours}h {sec.days > 0 ? `, ${sec.days}d` : ''}
                  </div>
                </div>

                {expandedSector === sec.id && (
                  <div className="bg-bg border-t border-border-soft p-4 space-y-3">
                    {sec.items.sort((a,b) => b.total_hours - a.total_hours).map(item => (
                      <div 
                        key={item.item_id} 
                        className="flex justify-between items-center text-sm cursor-pointer hover:bg-border-soft px-2 py-1 -mx-2 rounded transition-colors"
                        onClick={() => openItemModal(item.item_id)}
                      >
                        <span className="text-ink-dim hover:text-ink truncate max-w-sm">{item.item_title}</span>
                        <span className="font-mono text-ink-faint">
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
  )
}
