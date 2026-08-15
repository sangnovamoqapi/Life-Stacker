import React, { useRef } from 'react'
import type { Item, Sector, ItemStatus } from '../types'
import { useAppContext } from '../state/AppContext'

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
  active: 'var(--color-active)',
  paused: 'var(--color-paused)',
  blocked: 'var(--color-blocked)',
  done: 'var(--color-done)',
  queued: 'var(--color-queued)'
}

const statusPillClass: Record<ItemStatus, string> = {
  active: 'status-pill-active',
  paused: 'status-pill-paused',
  blocked: 'status-pill-blocked',
  done: 'status-pill-done',
  queued: 'status-pill-queued'
}

export const Card: React.FC<CardProps> = ({ item, sector, isDominant = false }) => {
  const { updateItem, openItemModal, settings, setEffortPrompt } = useAppContext()
  const progressRef = useRef<HTMLInputElement>(null)
  
  const daysUntouched = daysSince(item.updated_at)
  const isStale = (item.status === 'active' || item.status === 'paused') && daysUntouched >= settings.stale_threshold_days
  const sectorColor = `var(--color-${sector.color})`
  const rankLabel = `#${item.priority_rank}`

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
        className={`card-compact group ${item.status === 'done' ? 'opacity-50' : ''}`}
      >
        <span className="text-[10px] font-mono text-slate-500 w-6 shrink-0">{rankLabel}</span>
        <div 
          className="w-[5px] h-[5px] rounded-full shrink-0" 
          style={{ backgroundColor: statusColors[item.status] }} 
        />
        <span className={`text-[12px] text-slate-200 truncate flex-1 ${item.status === 'done' ? 'line-through text-slate-500' : ''}`}>
          {item.title}
        </span>
        <div className="w-[40px] h-1 rounded-full overflow-hidden shrink-0 bg-white/[0.08]">
          <div className="h-full rounded-full transition-all" style={{ width: `${item.progress}%`, backgroundColor: statusColors[item.status] || sectorColor }} />
        </div>
        <span className="text-[9px] font-mono text-slate-400 shrink-0 w-[28px] text-right">
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
        '--sector-glow': `${sectorColor}20` 
      } as React.CSSProperties}
    >
      {/* Top row: Rank + Status Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-xs select-none">⠿</span>
          <span className="text-xs font-mono font-medium text-slate-300">{rankLabel}</span>
        </div>
        
        {/* Status Badge */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${statusColors[item.status]} 15%, transparent)`,
            borderColor: `color-mix(in srgb, ${statusColors[item.status]} 35%, transparent)`,
            color: statusColors[item.status]
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[item.status] }} />
          <span>{item.status}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className={`font-sans text-base font-semibold text-slate-100 leading-snug mb-1.5 ${item.status === 'done' ? 'line-through text-slate-500' : ''}`}>
        {item.title}
      </h3>

      {/* Prominent Next Action (Right below title, expands card naturally for long text) */}
      {item.next_action && (
        <div className="text-xs text-blue-300 font-normal italic mb-2.5 leading-relaxed bg-blue-500/10 border border-blue-500/20 rounded-md px-2.5 py-1.5">
          → {item.next_action}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2.5">
        <span className="font-mono text-[11px] font-medium" style={{ color: sectorColor }}>
          {sector.icon ? `${sector.icon} ` : ''}{sector.name}
        </span>
        <span className="text-slate-600">·</span>
        <span className="font-mono text-[11px]">{relativeTime(item.updated_at)}</span>
        {isStale && (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-red-400 font-mono text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded">
              stale {daysUntouched}d
            </span>
          </>
        )}
      </div>

      {/* Single Sleek Progress Bar */}
      <div className="flex items-center gap-3 mb-2.5" onClick={e => e.stopPropagation()}>
        <div className="relative flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
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
            title={`Progress: ${item.progress}% (drag to update)`}
          />
        </div>
        <span className="text-xs font-mono text-slate-300 min-w-[32px] text-right font-medium">
          {item.progress}%
        </span>
      </div>

      {/* Quick Status Bar */}
      {item.status !== 'done' && (
        <div className="flex gap-1.5 mt-2.5 pt-1.5 border-t border-white/[0.04]" onClick={e => e.stopPropagation()}>
          {(['active', 'paused', 'blocked', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={(e) => setStatus(e, s)}
              className={`status-pill flex-1 text-center py-0.5 ${item.status === s ? statusPillClass[s] : 'status-pill-inactive'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
