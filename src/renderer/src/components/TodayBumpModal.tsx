import React, { useState } from 'react'
import { useAppContext } from '../state/AppContext'
import type { NextItem } from '../types'
import { formatEffortBadge } from '../utils/checklist'

interface TodayBumpModalProps {
  isOpen: boolean
  targetNextItemTitle: string
  todayItems: NextItem[]
  onConfirmBump: (todayItemIdToBump: string) => Promise<void>
  onCancel: () => void
}

export const TodayBumpModal: React.FC<TodayBumpModalProps> = ({
  isOpen,
  targetNextItemTitle,
  todayItems,
  onConfirmBump,
  onCancel
}) => {
  const { settings, getItemById, sectors } = useAppContext()
  const [selectedBumpId, setSelectedBumpId] = useState<string>(todayItems[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const todayCap = settings.today_cap ?? 3

  const handleConfirm = async () => {
    if (!selectedBumpId) return
    setIsSubmitting(true)
    try {
      await onConfirmBump(selectedBumpId)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getEpic = (epicId: string) => getItemById(epicId)
  const getSector = (sectorId?: string) => sectors.find(s => s.id === sectorId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div 
        className="w-full max-w-md bg-surface-modal rounded-2xl border border-border-subtle shadow-modal p-5 flex flex-col gap-4 text-text-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h2 className="font-sans text-base font-bold text-text-primary">
                Today Focus Cap ({todayItems.length} / {todayCap})
              </h2>
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Your Today focus is capped at <strong className="text-accent">{todayCap} items</strong>. 
              To bring in <strong className="text-text-primary">"{targetNextItemTitle}"</strong>, select one item to bump back to Next:
            </p>
          </div>
        </div>

        {/* List of Today items */}
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {todayItems.map(item => {
            const isSelected = selectedBumpId === item.id
            const parentEpic = getEpic(item.epic_id)
            const parentSector = getSector(parentEpic?.sector_id)
            const sectorColor = parentSector ? `var(--color-${parentSector.color})` : 'var(--accent)'

            return (
              <div
                key={item.id}
                onClick={() => setSelectedBumpId(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-accent/15 border-accent shadow-xs'
                    : 'bg-surface-subtle border-border-subtle hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <input
                    type="radio"
                    name="itemToBump"
                    checked={isSelected}
                    onChange={() => setSelectedBumpId(item.id)}
                    className="accent-accent shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-primary truncate">
                      {item.title}
                    </div>
                    {parentEpic && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-text-muted">
                        <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic.title}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {item.time_estimate_value ? (
                    <span className="text-[10px] font-mono text-text-muted bg-surface-card px-2 py-0.5 rounded-full border border-border-subtle">
                      ⏱ {formatEffortBadge(item.time_estimate_value, (item.time_estimate_unit as any) || 'hours')}
                    </span>
                  ) : null}
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
            disabled={isSubmitting || !selectedBumpId}
            className="px-4 py-1.5 text-xs font-bold text-white bg-accent hover:bg-accent-hover rounded-lg shadow-soft transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Swapping...' : 'Bump & Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}
