import React from 'react'
import { useAppContext } from '../state/AppContext'

export const FocusStrip: React.FC = () => {
  const { items, settings } = useAppContext()

  const totalItems = items.length
  const activeItems = items.filter(i => i.status === 'active')
  const activeCount = activeItems.length
  const completedCount = items.filter(i => i.status === 'done').length

  // Overall progress: average progress of active, paused, blocked items (excludes queued and done)
  const progressCandidates = items.filter(i => 
    i.status === 'active' || i.status === 'paused' || i.status === 'blocked'
  )
  const overallProgress = progressCandidates.length > 0
    ? Math.round(progressCandidates.reduce((sum, i) => sum + i.progress, 0) / progressCandidates.length)
    : 0

  // Current focus: lowest priority_rank among active items
  const currentFocus = activeItems.length > 0
    ? activeItems.reduce((min, i) => i.priority_rank < min.priority_rank ? i : min, activeItems[0])
    : null

  // SVG ring params
  const ringRadius = 12
  const ringCircumference = 2 * Math.PI * ringRadius
  const dashOffset = ringCircumference - (overallProgress / 100) * ringCircumference

  const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5

  return (
    <div data-tour="focus-strip" className="flex gap-3 px-6 py-3 shrink-0">
      {/* Total Items */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-text-secondary font-medium">Total Items</span>
          <span className="text-xs text-text-muted">🗃</span>
        </div>
        <div className="text-2xl font-sans font-bold text-text-primary mt-2 leading-none">{totalItems}</div>
      </div>

      {/* Active / Limit */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-text-secondary font-medium">Active</span>
          <span className="text-xs text-accent">⚡</span>
        </div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`text-2xl font-mono font-bold leading-none ${activeCount > activeCap ? 'text-blocked' : 'text-accent'}`}>
            {activeCount}
          </span>
          <span className="text-sm font-mono text-text-muted font-medium">/ {activeCap}</span>
        </div>
      </div>

      {/* Completed */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-text-secondary font-medium">Completed</span>
          <span className="text-xs text-done">🎯</span>
        </div>
        <div className="text-2xl font-sans font-bold text-done mt-2 leading-none">{completedCount}</div>
      </div>

      {/* Overall Progress Ring */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-text-secondary font-medium">Overall Progress</span>
          <span className="text-xs text-text-muted">⚙</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xl font-mono font-bold text-text-primary">{overallProgress}%</span>
          <svg width={32} height={32} className="-rotate-90">
            <circle
              className="progress-ring-track"
              cx={16}
              cy={16}
              r={ringRadius}
              strokeWidth={3}
            />
            <circle
              className="progress-ring-fill"
              cx={16}
              cy={16}
              r={ringRadius}
              strokeWidth={3}
              stroke="var(--accent)"
              strokeDasharray={ringCircumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
        </div>
      </div>

      {/* Current Focus */}
      <div className="focus-tile flex-[1.4] relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-text-secondary font-medium">Current Focus</span>
          <span className="text-xs text-accent">🔥</span>
        </div>
        {currentFocus ? (
          <div className="mt-1 min-w-0">
            <div className="text-sm font-sans font-semibold text-text-primary truncate">{currentFocus.title}</div>
            <div className="text-[11px] font-mono text-text-muted mt-0.5">#{currentFocus.priority_rank} in stack</div>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic mt-2">No active items</div>
        )}
      </div>
    </div>
  )
}
