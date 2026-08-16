import React from 'react'
import type { ActionLogEntry, Sector } from '../types'
import { parseChecklist } from './checklist'

export function formatActionLogEntry(entry: ActionLogEntry, sectors: Sector[]): React.ReactNode {
  const { field, old_value, new_value } = entry

  // 1. Next Action / Checklist changes
  if (field === 'next_action') {
    const oldList = parseChecklist(old_value)
    const newList = parseChecklist(new_value)

    // Check if step completed
    const completedStep = newList.find(n => n.completed && !oldList.find(o => o.id === n.id && o.completed))
    if (completedStep) {
      return (
        <div>
          <span className="text-emerald-400 font-bold mr-1.5">✓ Completed step:</span>
          <span className="text-slate-100 font-medium">&ldquo;{completedStep.text}&rdquo;</span>
        </div>
      )
    }

    // Check if step reopened
    const reopenedStep = newList.find(n => !n.completed && oldList.find(o => o.id === n.id && o.completed))
    if (reopenedStep) {
      return (
        <div>
          <span className="text-amber-400 font-bold mr-1.5">↩ Reopened step:</span>
          <span className="text-slate-100 font-medium">&ldquo;{reopenedStep.text}&rdquo;</span>
        </div>
      )
    }

    // Check if step added
    const addedStep = newList.find(n => !oldList.some(o => o.id === n.id))
    if (addedStep) {
      return (
        <div>
          <span className="text-blue-400 font-bold mr-1.5">+ Added step:</span>
          <span className="text-slate-100 font-medium">&ldquo;{addedStep.text}&rdquo;</span>
          {addedStep.effortValue && (
            <span className="ml-2 text-xs font-mono text-slate-400">
              (Est: {addedStep.effortValue} {addedStep.effortUnit || 'hours'})
            </span>
          )}
        </div>
      )
    }

    // Check if step removed
    const removedStep = oldList.find(o => !newList.some(n => n.id === o.id))
    if (removedStep) {
      return (
        <div>
          <span className="text-red-400 font-bold mr-1.5">✕ Removed step:</span>
          <span className="text-slate-400 line-through">&ldquo;{removedStep.text}&rdquo;</span>
        </div>
      )
    }

    // Single text next action update
    if (oldList.length <= 1 && newList.length <= 1) {
      const oldText = oldList[0]?.text || old_value || ''
      const newText = newList[0]?.text || new_value || ''
      if (oldText && newText) {
        return (
          <div>
            <span className="text-slate-300">Updated next action to </span>
            <span className="text-blue-300 font-medium">&ldquo;{newText}&rdquo;</span>
          </div>
        )
      }
    }

    return (
      <div>
        <span className="text-slate-300">Updated checklist ({newList.filter(s => s.completed).length}/{newList.length} done)</span>
      </div>
    )
  }

  // 2. Status change
  if (field === 'status') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-300">Changed status from</span>
        {old_value && (
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.10] text-slate-400 font-bold">
            {old_value}
          </span>
        )}
        <span className="text-slate-400">→</span>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold">
          {new_value}
        </span>
      </div>
    )
  }

  // 3. Progress change
  if (field === 'progress') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-slate-300">Progress updated:</span>
        <span className="font-mono text-xs text-slate-400">{old_value}%</span>
        <span className="text-slate-400">→</span>
        <span className="font-mono text-xs text-blue-400 font-bold">{new_value}%</span>
      </div>
    )
  }

  // 4. Sector change
  if (field === 'sector_id') {
    const oldSector = sectors.find(s => s.id === old_value)
    const newSector = sectors.find(s => s.id === new_value)
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-300">Moved sector from</span>
        <span className="font-semibold text-slate-300">{oldSector?.name || 'Previous Sector'}</span>
        <span className="text-slate-400">→</span>
        <span className="font-semibold text-blue-400">{newSector?.name || 'New Sector'}</span>
      </div>
    )
  }

  // 5. Title change
  if (field === 'title') {
    return (
      <div>
        <span className="text-slate-300">Renamed from </span>
        <span className="text-slate-400 line-through">&ldquo;{old_value}&rdquo;</span>
        <span className="text-slate-300"> to </span>
        <span className="text-slate-100 font-semibold">&ldquo;{new_value}&rdquo;</span>
      </div>
    )
  }

  // 6. Notes change
  if (field === 'notes') {
    return (
      <div>
        <span className="text-slate-300">Updated notes & description</span>
      </div>
    )
  }

  // Fallback
  return (
    <div>
      <span className="text-slate-300">Modified </span>
      <span className="font-mono text-blue-400">{field}</span>
    </div>
  )
}
