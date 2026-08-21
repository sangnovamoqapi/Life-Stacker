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
  const ringSize = 36
  const strokeWidth = 3.5
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (overallProgress / 100) * circumference

  return (
    <div className="flex gap-3 px-6 py-3 shrink-0">
      {/* Total Items */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-slate-400 font-medium">Total Items</span>
          <span className="text-xs text-slate-500">🗃</span>
        </div>
        <div className="text-2xl font-sans font-bold text-slate-100 mt-2 leading-none">{totalItems}</div>
      </div>

      {/* Active / Limit */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-slate-400 font-medium">Active</span>
          <span className="text-xs text-blue-400">⚡</span>
        </div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`text-2xl font-mono font-bold leading-none ${activeCount > (settings.active_epic_cap ?? settings.focus_limit) ? 'text-red-400' : 'text-blue-400'}`}>
            {activeCount}
          </span>
          <span className="text-sm font-mono text-slate-500 font-medium">/ {settings.active_epic_cap ?? settings.focus_limit}</span>
        </div>
      </div>

      {/* Completed */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-slate-400 font-medium">Completed</span>
          <span className="text-xs text-emerald-400">🎯</span>
        </div>
        <div className="text-2xl font-sans font-bold text-emerald-400 mt-2 leading-none">{completedCount}</div>
      </div>

      {/* Overall Progress Ring */}
      <div className="focus-tile flex-1 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-slate-400 font-medium">Overall Progress</span>
          <span className="text-xs text-slate-500">⚙</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xl font-mono font-bold text-slate-100">{overallProgress}%</span>
          <svg width={32} height={32} className="-rotate-90">
            <circle
              className="progress-ring-track"
              cx={16}
              cy={16}
              r={12}
              strokeWidth={3}
            />
            <circle
              className="progress-ring-fill"
              cx={16}
              cy={16}
              r={12}
              strokeWidth={3}
              stroke="#3b82f6"
              strokeDasharray={2 * Math.PI * 12}
              strokeDashoffset={(2 * Math.PI * 12) - (overallProgress / 100) * (2 * Math.PI * 12)}
            />
          </svg>
        </div>
      </div>

      {/* Current Focus */}
      <div className="focus-tile flex-[1.4] relative group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-sans text-slate-400 font-medium">Current Focus</span>
          <span className="text-xs text-amber-400">🔥</span>
        </div>
        {currentFocus ? (
          <div className="mt-1 min-w-0">
            <div className="text-sm font-sans font-semibold text-slate-100 truncate">{currentFocus.title}</div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">#{currentFocus.priority_rank} in stack</div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic mt-2">No active items</div>
        )}
      </div>
    </div>
  )
}
