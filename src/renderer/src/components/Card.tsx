import React, { useRef } from 'react'
import type { Item, Sector, ItemStatus } from '../types'
import { useAppContext } from '../state/AppContext'
import { parseChecklist, formatEffortBadge } from '../utils/checklist'

interface CardProps {
  item: Item
  sector: Sector
  isDominant?: boolean
}

function daysSince(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function relativeTime(dateStr: string) {
  const days = daysSince(dateStr)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

const statusColors: Record<ItemStatus, string> = {
  active: '#3b82f6',
  paused: '#f59e0b',
  blocked: '#ef4444',
  done: '#10b981',
  queued: '#64748b'
}

export const Card: React.FC<CardProps> = ({ item, sector, isDominant = false }) => {
  const { updateItem, openItemModal, settings, setEffortPrompt, toggleChecklistItem } = useAppContext()
  const progressRef = useRef<HTMLInputElement>(null)
  
  const daysUntouched = daysSince(item.updated_at)
  const isStale = (item.status === 'active' || item.status === 'paused') && daysUntouched >= settings.stale_threshold_days
  const sectorColor = `var(--color-${sector.color})`
  const rankLabel = `#${item.priority_rank}`

  const checklist = parseChecklist(item.next_action)

  const handleProgressCommit = async (e: React.MouseEvent<HTMLInputElement>) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10)
    if (val === item.progress) return
    
    let newStatus = item.status
    if (val === 100) newStatus = 'done'
    else if (item.status === 'done' && val < 100) newStatus = 'active'
      
    await updateItem(item.id, { progress: val, status: newStatus })
    setEffortPrompt({ itemId: item.id, oldProgress: item.progress, newProgress: val })
  }

  const setStatus = async (e: React.MouseEvent, status: ItemStatus) => {
    e.stopPropagation()
    if (status === item.status) return
    await updateItem(item.id, { status })
  }

  // ─── Compact mode: single-line row ───
  if (!isDominant) {
    return (
      <div 
        onClick={() => openItemModal(item.id)}
        className={`card-compact group cursor-pointer ${item.status === 'done' ? 'opacity-50' : ''}`}
      >
        <span className="text-[10px] font-mono text-slate-500 w-6 shrink-0">{rankLabel}</span>
        <div 
          className="w-2 h-2 rounded-full shrink-0 shadow-sm" 
          style={{ backgroundColor: statusColors[item.status] }} 
        />
        <span className={`text-[12px] font-medium text-slate-200 truncate flex-1 ${item.status === 'done' ? 'line-through text-slate-500' : ''}`}>
          {item.title}
        </span>
        <div className="w-[40px] h-1.5 rounded-full overflow-hidden shrink-0 bg-white/[0.08]">
          <div className="h-full rounded-full transition-all" style={{ width: `${item.progress}%`, backgroundColor: statusColors[item.status] || sectorColor }} />
        </div>
        <span className="text-[10px] font-mono text-slate-400 shrink-0 w-[28px] text-right font-medium">
          {item.progress}%
        </span>
      </div>
    )
  }

  // ─── Dominant mode: expanded top card ───
  return (
    <div 
      onClick={() => openItemModal(item.id)}
      className={`card-dominant cursor-pointer transition-all ${item.status === 'done' ? 'opacity-60' : ''}`}
      style={{ 
        borderLeft: `3px solid ${sectorColor}`,
        '--sector-glow': `${sectorColor}25` 
      } as React.CSSProperties}
    >
      {/* Top row: Rank + Status Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-xs select-none">⠿</span>
          <span className="text-xs font-mono font-bold text-slate-300">{rankLabel}</span>
        </div>
        
        {/* Status Badge */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border shadow-sm"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${statusColors[item.status]} 20%, transparent)`,
            borderColor: `color-mix(in srgb, ${statusColors[item.status]} 50%, transparent)`,
            color: statusColors[item.status]
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColors[item.status] }} />
          <span>{item.status}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className={`font-sans text-base font-bold text-slate-100 leading-snug mb-2 ${item.status === 'done' ? 'line-through text-slate-500' : ''}`}>
        {item.title}
      </h3>

      {/* Prominent Next Action Checklist */}
      {checklist.length > 0 && (
        <div className="space-y-1.5 mb-3 bg-black/25 border border-blue-500/20 rounded-xl p-2.5" onClick={e => e.stopPropagation()}>
          <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold mb-1 flex justify-between">
            <span>Next Action</span>
            <span>{checklist.filter(c => c.completed).length}/{checklist.length}</span>
          </div>
          {checklist.map(step => (
            <div 
              key={step.id} 
              className={`flex items-center gap-2 text-xs transition-colors py-0.5 ${
                step.completed ? 'text-slate-500 line-through' : 'text-slate-200'
              }`}
            >
              {/* Dark custom checkbox */}
              <button
                type="button"
                onClick={() => toggleChecklistItem(item.id, step.id)}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                  step.completed
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#121622] border-white/25 hover:border-blue-400'
                }`}
              >
                {step.completed && <span className="text-[9px] font-bold leading-none">✓</span>}
              </button>

              <span className="flex-1 truncate">{step.text}</span>
              {step.effortValue && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 shrink-0">
                  ⏱ {formatEffortBadge(step.effortValue, step.effortUnit)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2.5">
        <span className="font-mono text-[11px] font-semibold" style={{ color: sectorColor }}>
          {sector.icon ? `${sector.icon} ` : ''}{sector.name}
        </span>
        <span className="text-slate-600">·</span>
        <span className="font-mono text-[11px]">{relativeTime(item.updated_at)}</span>
        {isStale && (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-red-400 font-mono text-[10px] bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded font-semibold">
              stale {daysUntouched}d
            </span>
          </>
        )}
      </div>

      {/* Single Sleek Progress Bar (Pointer Cursor on Hover) */}
      <div className="flex items-center gap-3 mb-2.5" onClick={e => e.stopPropagation()}>
        <div className="relative flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden cursor-pointer">
          <div 
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${item.progress}%`, backgroundColor: statusColors[item.status] || sectorColor }}
          />
          <input 
            ref={progressRef}
            type="range" 
            min="0" max="100" step="5"
            defaultValue={item.progress}
            onMouseUp={handleProgressCommit}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title={`Progress: ${item.progress}% (click/drag to update)`}
          />
        </div>
        <span className="text-xs font-mono text-slate-300 min-w-[32px] text-right font-bold">
          {item.progress}%
        </span>
      </div>

      {/* Quick Status Bar */}
      {item.status !== 'done' && (
        <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-white/[0.06]" onClick={e => e.stopPropagation()}>
          {(['active', 'paused', 'blocked', 'done'] as const).map(s => {
            const isCurrent = item.status === s
            return (
              <button
                key={s}
                onClick={(e) => setStatus(e, s)}
                className={`text-[9px] uppercase font-mono px-2 py-1 rounded border transition-all cursor-pointer flex-1 text-center font-semibold ${
                  isCurrent 
                    ? 'shadow-md font-bold' 
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isCurrent ? `color-mix(in srgb, ${statusColors[s]} 25%, transparent)` : 'transparent',
                  borderColor: isCurrent ? `color-mix(in srgb, ${statusColors[s]} 60%, transparent)` : 'rgba(255,255,255,0.08)',
                  color: isCurrent ? statusColors[s] : '#94a3b8'
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

