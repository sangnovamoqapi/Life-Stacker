import React, { useRef, useEffect, useState } from 'react'
import { useAppContext } from '../state/AppContext'
import { Lane } from '../components/Lane'
import { Card } from '../components/Card'
import { FocusStrip } from '../components/FocusStrip'
import { ParkSwapModal } from '../components/ParkSwapModal'
import type { Item } from '../types'

export const LanesView: React.FC = () => {
  const { sectors, items, openSectorModal, updateItem, settings, showToast } = useAppContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [activeTab, setActiveTab] = useState<'sectors' | 'parked'>('sectors')
  
  // Swap Modal State
  const [targetEpicToActivate, setTargetEpicToActivate] = useState<Item | null>(null)

  const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5
  const activeCount = items.filter(i => i.status === 'active').length
  const parkedItems = items.filter(i => i.status === 'parked')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 10)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sectors.length, activeTab])

  const handleReactivateParked = async (item: Item) => {
    if (activeCount >= activeCap) {
      setTargetEpicToActivate(item)
    } else {
      await updateItem(item.id, { status: 'active' })
      showToast(`Reactivated "${item.title}"`, 'success')
    }
  }

  const handleConfirmSwap = async (epicToParkId: string) => {
    if (!targetEpicToActivate) return
    const epicToPark = items.find(i => i.id === epicToParkId)
    
    await updateItem(epicToParkId, { status: 'parked' })
    await updateItem(targetEpicToActivate.id, { status: 'active' })
    
    showToast(`Swapped: "${targetEpicToActivate.title}" activated, "${epicToPark?.title || 'Epic'}" parked`, 'success')
    setTargetEpicToActivate(null)
  }

  const getSector = (sectorId: string) => sectors.find(s => s.id === sectorId) || sectors[0]

  return (
    <div data-tour="lanes-view" className="flex-1 flex flex-col overflow-hidden">
      <FocusStrip />

      {/* Lanes Sub-Header: Active Cap + Tab Switcher */}
      <div className="px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sectors')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'sectors'
                ? 'bg-surface-card text-text-primary border border-border-subtle shadow-soft'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-subtle'
            }`}
          >
            Sectors ({sectors.length})
          </button>

          <button
            onClick={() => setActiveTab('parked')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'parked'
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-soft'
                : 'text-text-muted hover:text-purple-400 hover:bg-surface-subtle'
            }`}
          >
            <span>🅿️ Parked</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              parkedItems.length > 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-surface-subtle text-text-muted'
            }`}>
              {parkedItems.length}
            </span>
          </button>
        </div>

        <div className="text-xs font-mono text-text-muted flex items-center gap-2">
          <span>Active:</span>
          <span className={`font-bold ${activeCount >= activeCap ? 'text-accent' : 'text-accent'}`}>
            {activeCount} / {activeCap}
          </span>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'sectors' ? (
        <div 
          ref={containerRef}
          className={`flex-1 flex gap-4 overflow-x-auto px-6 pb-6 items-start lanes-container ${hasOverflow ? 'has-overflow' : ''}`}
        >
          {sectors.map(sector => (
            <Lane key={sector.id} sector={sector} />
          ))}
          
          <button 
            onClick={() => openSectorModal(null)}
            className="w-[280px] shrink-0 h-24 border-2 border-dashed rounded-xl text-text-muted hover:text-text-primary hover:border-border-strong transition-colors flex items-center justify-center font-sans font-medium text-sm bg-surface-subtle/40 border-border-subtle"
          >
            + New Sector
          </button>
        </div>
      ) : (
        /* Parked Epics Tab */
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            <div className="p-4 rounded-xl bg-surface-card border border-purple-500/30 mb-6 flex items-start justify-between shadow-soft">
              <div>
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <span>🅿️</span>
                  <span>Parked Icebox Epics</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Epics stored here do not count toward your active cap ({activeCap}). Click Reactivate to bring an epic back into focus.
                </p>
              </div>
              <span className="font-mono text-xs text-purple-400 bg-purple-500/15 px-2.5 py-1 rounded-full border border-purple-500/30">
                {parkedItems.length} Parked
              </span>
            </div>

            {parkedItems.length === 0 ? (
              <div className="text-center py-16 text-text-muted font-sans italic">
                <div className="text-3xl mb-2 opacity-30">🅿️</div>
                <div>No parked epics. All in-flight epics are actively tracked in sectors.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parkedItems.map(item => (
                  <Card
                    key={item.id}
                    item={item}
                    sector={getSector(item.sector_id)}
                    isDominant={true}
                    onReactivate={handleReactivateParked}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Epic Cap Swap Modal */}
      <ParkSwapModal
        isOpen={targetEpicToActivate !== null}
        targetEpicTitle={targetEpicToActivate?.title || ''}
        onConfirmSwap={handleConfirmSwap}
        onCancel={() => setTargetEpicToActivate(null)}
      />
    </div>
  )
}
