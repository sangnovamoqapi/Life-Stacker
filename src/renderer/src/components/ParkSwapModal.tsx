import React, { useState } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item } from '../types'

interface ParkSwapModalProps {
  isOpen: boolean
  targetEpicTitle: string
  onConfirmSwap: (epicToParkId: string) => Promise<void>
  onCancel: () => void
}

export const ParkSwapModal: React.FC<ParkSwapModalProps> = ({
  isOpen,
  targetEpicTitle,
  onConfirmSwap,
  onCancel
}) => {
  const { items, sectors, settings } = useAppContext()
  const activeItems = items.filter(i => i.status === 'active')
  const [selectedParkId, setSelectedParkId] = useState<string>(activeItems[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const getSector = (sectorId: string) => sectors.find(s => s.id === sectorId)

  const handleConfirm = async () => {
    if (!selectedParkId) return
    setIsSubmitting(true)
    try {
      await onConfirmSwap(selectedParkId)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-lg modal-glass rounded-2xl border border-white/[0.12] shadow-2xl p-6 flex flex-col gap-5 text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🅿️</span>
              <h2 className="font-sans text-lg font-bold text-slate-100">
                Active Epic Cap Reached ({activeItems.length} / {activeCap})
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              You have reached your limit of <strong className="text-amber-400">{activeCap} active epics</strong>. 
              To activate <strong className="text-slate-100">"{targetEpicTitle}"</strong>, choose an active epic to park in exchange:
            </p>
          </div>
        </div>

        {/* List of active epics to park */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {activeItems.map(item => {
            const sec = getSector(item.sector_id)
            const isSelected = selectedParkId === item.id
            const secColor = sec ? `var(--color-${sec.color})` : '#3b82f6'

            return (
              <div
                key={item.id}
                onClick={() => setSelectedParkId(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <input
                    type="radio"
                    name="epicToPark"
                    checked={isSelected}
                    onChange={() => setSelectedParkId(item.id)}
                    className="accent-amber-400 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">#{item.priority_rank}</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: secColor }}>
                        {sec?.icon} {sec?.name}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                      {item.title}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-medium text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
                    Park this
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedParkId || isSubmitting}
            className="px-5 py-2 text-xs font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>⇄</span>
            <span>{isSubmitting ? 'Swapping...' : 'Swap & Activate'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
