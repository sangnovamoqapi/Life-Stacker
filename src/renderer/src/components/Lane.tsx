import React, { useState } from 'react'
import { Card } from './Card'
import { useAppContext } from '../state/AppContext'
import type { Sector } from '../types'

import { useHybridSearch } from '../hooks/useHybridSearch'

interface LaneProps {
  sector: Sector
}

export const Lane: React.FC<LaneProps> = ({ sector }) => {
  const { getItemsForSector, sectors, items, actionSteps, searchTerm } = useAppContext()
  const [showDone, setShowDone] = useState(false)

  const allSectorItems = getItemsForSector(sector.id)
  const { combinedItems, semanticMatchedIds, isSearching } = useHybridSearch(items, sectors, actionSteps, searchTerm)

  const filteredItems = isSearching 
    ? combinedItems.filter(item => item.sector_id === sector.id)
    : allSectorItems

  const openItems = filteredItems.filter(i => i.status !== 'done' && i.status !== 'parked')
  const doneItems = filteredItems.filter(i => i.status === 'done')
  const activeCount = openItems.filter(i => i.status === 'active').length
  const totalOpen = openItems.length

  return (
    <div className="w-[280px] shrink-0 flex flex-col lane-glass rounded-2xl overflow-hidden max-h-[calc(100vh-155px)]">
      <div className="h-[3px] w-full" style={{ backgroundColor: `var(--color-${sector.color})` }} />
      
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06] sticky top-0 z-10 bg-transparent">
        <div className="flex items-center gap-2 truncate pr-2">
          {sector.icon && <span className="text-base shrink-0 select-none">{sector.icon}</span>}
          <h2 className="font-sans font-bold text-slate-100 text-base truncate">{sector.name}</h2>
        </div>
        <span className="font-mono text-xs text-slate-400 shrink-0 font-medium">{activeCount}⚡ / {totalOpen}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 relative">
        {openItems.map((item, idx) => (
          <Card 
            key={item.id} 
            item={item} 
            sector={sector} 
            isDominant={idx === 0} 
            isSemanticMatch={semanticMatchedIds.has(item.id)}
          />
        ))}
        
        {openItems.length === 0 && doneItems.length === 0 && !searchTerm && (
          <div className="text-center text-ink-faint py-6 max-h-[120px]">
            <div className="text-3xl mb-2 opacity-20">+</div>
            <div className="text-sm font-serif italic">Nothing here yet</div>
          </div>
        )}

        {doneItems.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border-soft">
            <button
              onClick={() => setShowDone(!showDone)}
              className="flex items-center gap-2 text-xs text-ink-dim hover:text-ink w-full px-2 py-1 transition-colors"
            >
              <span className={`transition-transform ${showDone ? 'rotate-90' : ''}`}>▸</span>
              finished ({doneItems.length})
            </button>
            
            {showDone && (
              <div className="mt-1 space-y-1 pl-1">
                {doneItems.map(item => (
                  <Card 
                    key={item.id} 
                    item={item} 
                    sector={sector} 
                    isDominant={false} 
                    isSemanticMatch={semanticMatchedIds.has(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
