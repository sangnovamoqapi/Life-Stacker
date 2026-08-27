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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div 
        className="w-full max-w-lg bg-surface-modal rounded-2xl border border-border-subtle shadow-modal p-6 flex flex-col gap-5 text-text-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🅿️</span>
              <h2 className="font-sans text-lg font-bold text-text-primary">
                Active Epic Cap Reached ({activeItems.length} / {activeCap})
              </h2>
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              You have reached your limit of <strong className="text-accent">{activeCap} active epics</strong>. 
              To activate <strong className="text-text-primary">"{targetEpicTitle}"</strong>, choose an active epic to park in exchange:
            </p>
          </div>
        </div>

        {/* List of active epics to park */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {activeItems.map(item => {
            const sec = getSector(item.sector_id)
            const isSelected = selectedParkId === item.id
            const secColor = sec ? `var(--color-${sec.color})` : 'var(--accent)'

            return (
              <div
                key={item.id}
                onClick={() => setSelectedParkId(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-500/15 border-purple-500/60 shadow-xs'
                    : 'bg-surface-subtle border-border-subtle hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <input
                    type="radio"
                    name="epicToPark"
                    checked={isSelected}
                    onChange={() => setSelectedParkId(item.id)}
                    className="accent-purple-500 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-text-muted">#{item.priority_rank}</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: secColor }}>
                        {sec?.icon} {sec?.name}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-text-primary truncate mt-0.5">
                      {item.title}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-medium text-text-muted bg-surface-card px-2 py-0.5 rounded-full border border-border-subtle">
                    {item.progress}% done
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end items-center gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedParkId}
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-soft transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Swapping...' : 'Park Selected & Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}
