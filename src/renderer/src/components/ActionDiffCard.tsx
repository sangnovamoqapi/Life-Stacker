import React, { useState } from 'react'
import type { PendingAction, ItemStatus } from '../types'
import { useAppContext } from '../state/AppContext'

interface ActionDiffCardProps {
  action: PendingAction
  onResolved?: () => void
}

interface StepDraft {
  content: string
  effort_value?: number | null
  effort_unit?: string | null
}

export const ActionDiffCard: React.FC<ActionDiffCardProps> = ({ action, onResolved }) => {
  const { sectors, items, refreshAll, showToast } = useAppContext()
  
  let parsedArgs: any = {}
  try {
    parsedArgs = JSON.parse(action.arguments)
  } catch {
    parsedArgs = {}
  }

  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial step extraction
  const rawInitialSteps = parsedArgs.action_steps || parsedArgs.steps || []
  const initialSteps: StepDraft[] = Array.isArray(rawInitialSteps)
    ? rawInitialSteps.map((s: any) => typeof s === 'string' ? { content: s } : { content: s.content, effort_value: s.effort_value, effort_unit: s.effort_unit })
    : []

  // Editable fields
  const [title, setTitle] = useState<string>(parsedArgs.title || '')
  const [sectorId, setSectorId] = useState<string>(parsedArgs.sector_id || sectors[0]?.id || '')
  const [status, setStatus] = useState<ItemStatus>(parsedArgs.status || 'queued')
  const [progress, setProgress] = useState<number>(parsedArgs.progress !== undefined ? parsedArgs.progress : 0)
  const [notes, setNotes] = useState<string>(parsedArgs.notes || '')
  const [actionSteps, setActionSteps] = useState<StepDraft[]>(initialSteps)
  const [newStepContent, setNewStepContent] = useState('')

  const isCreate = action.tool_name === 'items:create' || action.tool_name === 'items_create'
  const isUpdate = action.tool_name === 'items:update' || action.tool_name === 'items_update'
  const isAddSteps = action.tool_name === 'action_steps:create' || action.tool_name === 'action_steps_create'

  // Look up target item if update or addSteps
  const targetItemId = isUpdate ? parsedArgs.id : (isAddSteps ? parsedArgs.item_id : null)
  const targetItem = targetItemId ? items.find(i => i.id === targetItemId) : null
  const targetSector = sectors.find(s => s.id === (isEditing ? sectorId : (parsedArgs.sector_id || targetItem?.sector_id)))

  const handleAddStep = () => {
    const trimmed = newStepContent.trim()
    if (!trimmed) return
    setActionSteps(prev => [...prev, { content: trimmed }])
    setNewStepContent('')
  }

  const handleRemoveStep = (index: number) => {
    setActionSteps(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateStepContent = (index: number, val: string) => {
    setActionSteps(prev => prev.map((s, i) => i === index ? { ...s, content: val } : s))
  }

  const handleAccept = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement)?.blur()
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const overrides: Record<string, any> = {}
      if (isCreate) {
        overrides.title = title.trim()
        overrides.sector_id = sectorId
        overrides.status = status
        overrides.notes = notes
        overrides.action_steps = actionSteps.filter(s => s.content.trim())
      } else if (isAddSteps) {
        overrides.steps = actionSteps.filter(s => s.content.trim())
      } else if (isUpdate) {
        if (title.trim() && title !== targetItem?.title) overrides.title = title.trim()
        if (sectorId && sectorId !== targetItem?.sector_id) overrides.sector_id = sectorId
        if (status) overrides.status = status
        if (progress !== undefined) overrides.progress = progress
        if (notes !== undefined) overrides.notes = notes
      }

      const res = await window.api.chat.acceptAction(action.id, overrides)
      if (res.success) {
        showToast(isCreate ? `Created item "${title || parsedArgs.title}"` : isAddSteps ? 'Added action steps' : 'Updated item', 'success')
        await refreshAll()
        if (onResolved) onResolved()
      } else {
        setError(res.error || 'Failed to accept action')
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing action')
    } finally {
      setIsSubmitting(false)
      window.focus()
    }
  }

  const handleReject = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement)?.blur()
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await window.api.chat.rejectAction(action.id)
      showToast('Action rejected', 'info')
      if (onResolved) onResolved()
    } catch (err: any) {
      setError(err?.message || 'Error rejecting action')
    } finally {
      setIsSubmitting(false)
      window.focus()
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-white/[0.12] bg-slate-900/75 backdrop-blur-md p-3.5 shadow-lg space-y-2.5 transition-all text-xs font-sans">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider ${
            isCreate 
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
              : isAddSteps
                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
          }`}>
            {isCreate ? '+ Create Item' : isAddSteps ? '+ Add Next Steps' : '✎ Update Item'}
          </span>
          {targetSector && (
            <span 
              className="flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]"
              style={{ color: `var(--color-${targetSector.color})` }}
            >
              <span>{targetSector.icon || '📁'}</span>
              <span>{targetSector.name}</span>
            </span>
          )}
        </div>

        {/* Resolved Badge */}
        {action.status === 'accepted' && (
          <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            ✓ Accepted
          </span>
        )}
        {action.status === 'rejected' && (
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 bg-slate-400/15 border border-slate-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            ✕ Rejected
          </span>
        )}
      </div>

      {/* Content View / Edit Mode */}
      {!isEditing ? (
        <div className="space-y-2 pl-1">
          {isCreate && (
            <div>
              <span className="text-slate-400 font-medium">Title: </span>
              <span className="font-bold text-slate-100">{parsedArgs.title}</span>
            </div>
          )}
          {(isUpdate || isAddSteps) && targetItem && (
            <div>
              <span className="text-slate-400 font-medium">Target: </span>
              <span className="font-bold text-slate-100">{targetItem.title}</span>
            </div>
          )}
          {parsedArgs.status && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Status: </span>
              <span className="font-mono text-slate-200 capitalize bg-white/[0.06] px-1.5 py-0.2 rounded font-semibold">
                {parsedArgs.status}
              </span>
            </div>
          )}
          {parsedArgs.progress !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Progress: </span>
              <span className="font-mono text-amber-300 font-bold">{parsedArgs.progress}%</span>
            </div>
          )}
          {parsedArgs.notes && (
            <div>
              <span className="text-slate-400 font-medium">Notes: </span>
              <span className="text-slate-300 italic">{parsedArgs.notes}</span>
            </div>
          )}

          {/* Action Steps Checklist View */}
          {actionSteps.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-slate-400 font-medium block">Action Steps ({actionSteps.length}):</span>
              <div className="space-y-1 pl-2.5 border-l-2 border-amber-400/40">
                {actionSteps.map((step, idx) => (
                  <div key={idx} className="flex items-baseline gap-2 text-slate-200">
                    <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0">#{idx + 1}</span>
                    <span className="leading-snug">{step.content}</span>
                    {step.effort_value && (
                      <span className="text-[9px] font-mono text-slate-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.2 rounded shrink-0">
                        ⏱ {step.effort_value} {step.effort_unit || 'hr'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-2.5 pt-1 border-t border-white/[0.08]">
          {isCreate && (
            <div>
              <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-950/70 border border-white/[0.15] rounded px-2.5 py-1 text-slate-100 text-xs outline-none focus:border-amber-400/50"
              />
            </div>
          )}

          {isCreate && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Sector</label>
                <select
                  value={sectorId}
                  onChange={e => setSectorId(e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/[0.15] rounded px-2 py-1 text-slate-100 text-xs outline-none"
                >
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as ItemStatus)}
                  className="w-full bg-slate-950/70 border border-white/[0.15] rounded px-2 py-1 text-slate-100 text-xs outline-none"
                >
                  {(['queued', 'active', 'paused', 'blocked', 'done'] as ItemStatus[]).map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isUpdate && (
            <div>
              <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Progress: {progress}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                className="w-full progress-range accent-amber-400"
              />
            </div>
          )}

          {/* Action Steps Editor */}
          {(isCreate || isAddSteps) && (
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono text-slate-400">Action Steps</label>
              <div className="space-y-1.5">
                {actionSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0">#{idx + 1}</span>
                    <input
                      type="text"
                      value={step.content}
                      onChange={e => handleUpdateStepContent(idx, e.target.value)}
                      className="flex-1 bg-slate-950/70 border border-white/[0.12] rounded px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-amber-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="text-slate-400 hover:text-red-400 px-1 text-xs"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Add Step Input */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newStepContent}
                    onChange={e => setNewStepContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep() } }}
                    placeholder="Add step and press Enter..."
                    className="flex-1 bg-slate-950/40 border border-white/[0.08] rounded px-2 py-0.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-400/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddStep}
                    disabled={!newStepContent.trim()}
                    className="px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-30 text-slate-300 text-xs font-mono"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {isCreate && (
            <div>
              <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-950/70 border border-white/[0.15] rounded px-2.5 py-1 text-slate-100 text-xs outline-none focus:border-amber-400/50 resize-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="text-[11px] text-red-400 bg-red-500/15 border border-red-500/30 p-2 rounded">
          {error}
        </div>
      )}

      {/* Action Buttons for Pending Status */}
      {action.status === 'pending' && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              setIsEditing(!isEditing)
            }}
            disabled={isSubmitting}
            className="px-2.5 py-1 rounded text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:border-white/[0.20] font-mono text-[11px] transition-colors"
          >
            {isEditing ? 'Cancel Edit' : 'Edit ✎'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="px-3 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-white/[0.10] font-semibold text-[11px] transition-colors"
          >
            Reject ✕
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isSubmitting}
            className="px-3.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all shadow-md active:scale-95"
          >
            {isSubmitting ? 'Applying...' : 'Accept ✓'}
          </button>
        </div>
      )}
    </div>
  )
}
