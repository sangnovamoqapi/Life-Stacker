import React from 'react'
import type { Item, Sector, ItemStatus } from '../types'
import { useAppContext } from '../state/AppContext'
import { formatEffortBadge } from '../utils/checklist'

interface CardProps {
  item: Item
  sector: Sector
  isDominant?: boolean
  isSemanticMatch?: boolean
  onReactivate?: (item: Item) => void
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
  active: 'var(--accent)',
  paused: '#b88628',
  blocked: '#e05244',
  done: '#2e9e6b',
  queued: 'var(--text-muted)',
  parked: '#8e6ec2'
}

export const Card: React.FC<CardProps> = ({ 
  item, 
  sector, 
  isDominant = false, 
  isSemanticMatch = false,
  onReactivate
}) => {
  const { 
    updateItem, 
    openItemModal, 
    settings, 
    setChecklistEffortPrompt, 
    getNextItems, 
    toggleNextItem,
    getResearchProgress,
    getExecutionProgress,
    getEpicStage,
    items
  } = useAppContext()
  
  const daysUntouched = daysSince(item.updated_at)
  const isStale = (item.status === 'active' || item.status === 'paused') && daysUntouched >= settings.stale_threshold_days
  const sectorColor = `var(--color-${sector.color})`
  const rankLabel = `#${item.priority_rank}`

  const researchProgress = getResearchProgress(item.id)
  const executionProgress = getExecutionProgress(item.id)
  const stage = getEpicStage(item.id)

  const isParked = item.status === 'parked'

  const handleStatusChange = async (e: React.MouseEvent, newStatus: ItemStatus) => {
    e.stopPropagation()
    if (newStatus === item.status) return

    // If attempting to activate, check active cap
    const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5
    const activeCount = items.filter(i => i.status === 'active').length
    if (newStatus === 'active' && item.status !== 'active' && activeCount >= activeCap) {
      if (onReactivate) {
        onReactivate(item)
        return
      }
    }

    await updateItem(item.id, { status: newStatus })
  }

  // ─── Compact mode: single-line row ───
  if (!isDominant) {
    return (
      <div 
        onClick={() => openItemModal(item.id)}
        className={`card-compact group cursor-pointer transition-all ${
          item.status === 'done' ? 'opacity-50' : isParked ? 'opacity-70 border-dashed border-purple-500/40' : ''
        }`}
      >
        <span className="text-[10px] font-mono text-text-muted w-6 shrink-0">{rankLabel}</span>
        <div 
          className="w-2 h-2 rounded-full shrink-0 shadow-xs" 
          style={{ backgroundColor: statusColors[item.status] }} 
        />
        <span className={`text-[12px] font-medium text-text-primary truncate flex-1 ${item.status === 'done' ? 'line-through text-text-muted' : ''}`}>
          {item.title}
        </span>

        {/* Stage Badge Compact */}
        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle text-text-secondary border border-border-subtle shrink-0">
          {stage.label}
        </span>

        {/* Dual Mini Progress Bars */}
        <div className="flex flex-col gap-0.5 w-[38px] shrink-0" title={`Research: ${researchProgress}% | Execution: ${executionProgress}%`}>
          <div className="h-1 rounded-full bg-surface-subtle overflow-hidden">
            <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${researchProgress}%` }} />
          </div>
          <div className="h-1 rounded-full bg-surface-subtle overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${executionProgress}%` }} />
          </div>
        </div>

        <span className="text-[10px] font-mono text-text-muted shrink-0 w-[24px] text-right font-medium">
          {executionProgress}%
        </span>
      </div>
    )
  }

  // ─── Dominant mode: expanded top card ───
  return (
    <div 
      onClick={() => openItemModal(item.id)}
      className={`card-dominant cursor-pointer transition-all ${
        item.status === 'done' ? 'opacity-60' : isParked ? 'opacity-75 border-dashed border-purple-500/40' : ''
      }`}
      style={{ 
        borderLeft: `3px solid ${isParked ? '#8e6ec2' : sectorColor}`
      }}
    >
      {/* Top row: Rank + Stage + Status Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-xs select-none">⠿</span>
          <span className="text-xs font-mono font-bold text-text-secondary">{rankLabel}</span>
          
          {/* Stage Indicator Badge */}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-border-subtle font-semibold flex items-center gap-1">
            {stage.hasOpenExplore && stage.hasOpenNext ? '✨' : stage.hasOpenExplore ? '🔬' : stage.hasOpenNext ? '⚡' : '✓'}
            <span>{stage.label}</span>
          </span>

          {isSemanticMatch && (
            <span 
              className="text-[10px] font-bold text-accent bg-accent-subtle px-1.5 py-0.2 rounded border border-accent/30 cursor-help"
              title="related to your search"
            >
              ✦
            </span>
          )}
        </div>
        
        {/* Status Badge */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${statusColors[item.status]} 15%, transparent)`,
            borderColor: `color-mix(in srgb, ${statusColors[item.status]} 40%, transparent)`,
            color: statusColors[item.status]
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[item.status] }} />
          <span>{item.status}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className={`font-sans text-sm font-bold text-text-primary leading-snug mb-2 ${item.status === 'done' ? 'line-through text-text-muted' : ''}`}>
        {item.title}
      </h3>

      {/* Compact Step-Card Up-Next Line for Dominant Card */}
      {(() => {
        const itemSteps = getNextItems(item.id)
        const total = itemSteps.length
        const doneCount = itemSteps.filter(s => s.status === 'done').length
        const currentStep = itemSteps.find(s => s.status !== 'done')

        if (total === 0) return null

        return (
          <div 
            className="mb-3 bg-surface-subtle border border-border-subtle hover:border-accent/40 rounded-lg p-2.5 transition-all"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-1.5">
              <span className="uppercase tracking-wider text-accent font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Up Next
              </span>
              <span className="font-medium text-text-muted">{doneCount}/{total} done</span>
            </div>

            {currentStep ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    const toggled = await toggleNextItem(currentStep.id)
                    if (toggled.status === 'done') {
                      setChecklistEffortPrompt({
                        itemId: item.id,
                        checklistItem: {
                          id: currentStep.id,
                          text: currentStep.title,
                          completed: true,
                          effortValue: currentStep.time_estimate_value ?? undefined,
                          effortUnit: (currentStep.time_estimate_unit as any) || undefined
                        }
                      })
                    }
                  }}
                  className="w-4 h-4 rounded-full border-2 border-accent hover:bg-accent/20 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                  title="Click to complete step"
                />
                <span className="text-xs font-medium text-text-primary truncate flex-1">
                  {currentStep.title}
                </span>
                {currentStep.time_estimate_value && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-surface-raised text-text-secondary border border-border-subtle shrink-0">
                    ⏱ {formatEffortBadge(currentStep.time_estimate_value, (currentStep.time_estimate_unit as any) || 'hours')}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-done font-medium">
                <span>✓</span>
                <span>All next steps completed</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-2.5">
        <span className="font-mono text-[11px] font-semibold" style={{ color: sectorColor }}>
          {sector.icon ? `${sector.icon} ` : ''}{sector.name}
        </span>
        <span>·</span>
        <span className="font-mono text-[11px]">{relativeTime(item.updated_at)}</span>
        {isStale && (
          <>
            <span>·</span>
            <span className="text-blocked font-mono text-[10px] bg-blocked-dim border border-blocked/30 px-1.5 py-0.5 rounded font-semibold">
              stale {daysUntouched}d
            </span>
          </>
        )}
      </div>

      {/* Dual Stacked Progress Bars (Research & Execution) */}
      <div className="space-y-1.5 mb-3 bg-surface-subtle p-2 rounded-lg border border-border-subtle" onClick={e => e.stopPropagation()}>
        {/* Research Progress */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-1">
            <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
              <span>🔬</span> Research
            </span>
            <span className="font-bold text-text-secondary">{researchProgress}%</span>
          </div>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${researchProgress}%` }}
            />
          </div>
        </div>

        {/* Execution Progress */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-1">
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
              <span>⚡</span> Execution
            </span>
            <span className="font-bold text-text-secondary">{executionProgress}%</span>
          </div>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${executionProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Status Bar / Reactivate Button */}
      {isParked ? (
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] font-mono text-purple-400">Parked Epic</span>
          <button
            type="button"
            onClick={e => handleStatusChange(e, 'active')}
            className="px-3 py-1 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            ⚡ Reactivate
          </button>
        </div>
      ) : item.status !== 'done' && (
        <div className="flex gap-1.5 mt-1 pt-2 border-t border-border-subtle" onClick={e => e.stopPropagation()}>
          {(['active', 'paused', 'blocked', 'parked', 'done'] as const).map(s => {
            const isCurrent = item.status === s
            return (
              <button
                key={s}
                onClick={(e) => handleStatusChange(e, s)}
                className={`text-[9px] uppercase font-mono px-2 py-1 rounded border transition-all cursor-pointer flex-1 text-center font-semibold ${
                  isCurrent 
                    ? 'font-bold' 
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isCurrent ? `color-mix(in srgb, ${statusColors[s]} 18%, transparent)` : 'transparent',
                  borderColor: isCurrent ? `color-mix(in srgb, ${statusColors[s]} 50%, transparent)` : 'var(--border-subtle)',
                  color: isCurrent ? statusColors[s] : 'var(--text-muted)'
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
