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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-md modal-glass rounded-2xl border border-amber-500/30 shadow-2xl p-5 flex flex-col gap-4 text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h2 className="font-sans text-base font-bold text-slate-100">
                Today Focus Cap ({todayItems.length} / {todayCap})
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Your Today focus is capped at <strong className="text-amber-300">{todayCap} items</strong>. 
              To bring in <strong className="text-slate-100">"{targetNextItemTitle}"</strong>, select one item to bump back to Next:
            </p>
          </div>
        </div>

        {/* List of Today items */}
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {todayItems.map(item => {
            const isSelected = selectedBumpId === item.id
            const parentEpic = getEpic(item.epic_id)
            const parentSector = getSector(parentEpic?.sector_id)
            const sectorColor = parentSector ? `var(--color-${parentSector.color})` : '#3b82f6'

            return (
              <div
                key={item.id}
                onClick={() => setSelectedBumpId(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <input
                    type="radio"
                    name="itemToBump"
                    checked={isSelected}
                    onChange={() => setSelectedBumpId(item.id)}
                    className="accent-amber-400 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {item.title}
                    </div>
                    {parentEpic && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-slate-400">
                        <span style={{ color: sectorColor }}>{parentSector?.icon} {parentEpic.title}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {item.time_estimate_value && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                      ⏱ {formatEffortBadge(item.time_estimate_value, (item.time_estimate_unit as any) || 'hours')}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
                    Bump
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedBumpId || isSubmitting}
            className="px-4 py-1.5 text-xs font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>⇄</span>
            <span>{isSubmitting ? 'Bumping...' : 'Bump & Promote'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
