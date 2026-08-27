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

interface ExploreDraft {
  title: string
  notes?: string
  time_estimate_value?: number | null
  time_estimate_unit?: string | null
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

  // Initial step & explore extraction
  const rawInitialSteps = parsedArgs.next_items || parsedArgs.items || parsedArgs.action_steps || parsedArgs.steps || []
  const initialSteps: StepDraft[] = Array.isArray(rawInitialSteps)
    ? rawInitialSteps.map((s: any) => typeof s === 'string' ? { content: s } : { content: s.title || s.content, effort_value: s.time_estimate_value ?? s.effort_value, effort_unit: s.time_estimate_unit ?? s.effort_unit })
    : []

  const rawExploreTopics = parsedArgs.explore_topics || []
  const initialExploreTopics: ExploreDraft[] = Array.isArray(rawExploreTopics)
    ? rawExploreTopics.map((e: any) => {
        if (typeof e === 'string') {
          const clean = e.replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
          return clean ? { title: clean, notes: '' } : null
        }
        if (e && typeof e === 'object') {
          let title = String(e.title || e.topic || e.name || e.content || '').replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
          let notes = String(e.notes || e.description || e.text || '').trim()
          if (!title && notes) {
            const firstLine = notes.split('\n')[0].replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
            title = firstLine.length > 70 ? firstLine.slice(0, 67).trim() + '...' : firstLine
          }
          if (title || notes) {
            return {
              title: title || 'Explore Topic',
              notes: notes || '',
              time_estimate_value: e.time_estimate_value ? Number(e.time_estimate_value) : undefined,
              time_estimate_unit: e.time_estimate_unit || 'hours'
            }
          }
        }
        return null
      }).filter(Boolean) as ExploreDraft[]
    : []

  // Editable fields for items / explore
  const [title, setTitle] = useState<string>(parsedArgs.title || '')
  const [sectorId, setSectorId] = useState<string>(parsedArgs.sector_id || sectors[0]?.id || '')
  const [status, setStatus] = useState<ItemStatus>(parsedArgs.status || 'queued')
  const [progress, setProgress] = useState<number>(parsedArgs.progress !== undefined ? parsedArgs.progress : 0)
  const [notes, setNotes] = useState<string>(parsedArgs.notes || '')
  const [actionSteps, setActionSteps] = useState<StepDraft[]>(initialSteps)
  const [newStepContent, setNewStepContent] = useState('')
  const [exploreTopics, setExploreTopics] = useState<ExploreDraft[]>(initialExploreTopics)
  const [newExploreTitle, setNewExploreTitle] = useState('')
  const [newExploreNotes, setNewExploreNotes] = useState('')

  // Editable fields for edge relationships
  const [fromItemId, setFromItemId] = useState<string>(parsedArgs.from_item_id || items[0]?.id || '')
  const [toItemId, setToItemId] = useState<string>(parsedArgs.to_item_id || items[1]?.id || items[0]?.id || '')
  const [relationType, setRelationType] = useState<string>(parsedArgs.relation_type || 'depends_on')
  const [edgeNote, setEdgeNote] = useState<string>(parsedArgs.note || '')

  const isCreate = action.tool_name === 'items:create' || action.tool_name === 'items_create'
  const isUpdate = action.tool_name === 'items:update' || action.tool_name === 'items_update'
  const isAddSteps = action.tool_name === 'action_steps:create' || action.tool_name === 'action_steps_create' || action.tool_name === 'next_items_create' || action.tool_name === 'next_items:create'
  const isExploreCreate = action.tool_name === 'explore_create' || action.tool_name === 'explore:create' || action.tool_name === 'explore_items_create'
  const isEdgeCreate = action.tool_name === 'edges:create' || action.tool_name === 'edges_create'

  // Look up target item if update or addSteps or explore
  const targetItemId = isUpdate ? parsedArgs.id : (isAddSteps || isExploreCreate ? (parsedArgs.epic_id || parsedArgs.item_id) : null)
  const targetItem = targetItemId ? items.find(i => i.id === targetItemId) : null
  const targetSector = sectors.find(s => s.id === (isEditing ? sectorId : (parsedArgs.sector_id || targetItem?.sector_id)))

  // Look up items for edge relationships
  const fromItem = items.find(i => i.id === (isEditing ? fromItemId : parsedArgs.from_item_id))
  const toItem = items.find(i => i.id === (isEditing ? toItemId : parsedArgs.to_item_id))
  const fromSector = sectors.find(s => s.id === fromItem?.sector_id)
  const toSector = sectors.find(s => s.id === toItem?.sector_id)

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

  const handleAddExplore = () => {
    const trimmedTitle = newExploreTitle.trim()
    if (!trimmedTitle) return
    setExploreTopics(prev => [...prev, { title: trimmedTitle, notes: newExploreNotes.trim() }])
    setNewExploreTitle('')
    setNewExploreNotes('')
  }

  const handleRemoveExplore = (index: number) => {
    setExploreTopics(prev => prev.filter((_, i) => i !== index))
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
        if (exploreTopics.length > 0) {
          overrides.explore_topics = exploreTopics.map(e => ({
            title: e.title.trim() || e.notes?.slice(0, 60) || 'Explore Topic',
            notes: e.notes || '',
            time_estimate_value: e.time_estimate_value,
            time_estimate_unit: e.time_estimate_unit
          }))
        }
        if (actionSteps.length > 0) {
          overrides.next_items = actionSteps.filter(s => s.content.trim()).map(s => ({
            title: s.content.trim(),
            time_estimate_value: s.effort_value,
            time_estimate_unit: s.effort_unit
          }))
        }
      } else if (isExploreCreate) {
        if (title.trim()) overrides.title = title.trim()
        if (notes !== undefined) overrides.notes = notes
      } else if (isAddSteps) {
        overrides.items = actionSteps.filter(s => s.content.trim()).map(s => ({
          title: s.content.trim(),
          time_estimate_value: s.effort_value,
          time_estimate_unit: s.effort_unit
        }))
        overrides.steps = actionSteps.filter(s => s.content.trim())
      } else if (isUpdate) {
        if (title.trim() && title !== targetItem?.title) overrides.title = title.trim()
        if (sectorId && sectorId !== targetItem?.sector_id) overrides.sector_id = sectorId
        if (status) overrides.status = status
        if (progress !== undefined) overrides.progress = progress
        if (notes !== undefined) overrides.notes = notes
      } else if (isEdgeCreate) {
        if (fromItemId === toItemId) {
          setError('Cannot create a relationship from an item to itself.')
          setIsSubmitting(false)
          return
        }
        overrides.from_item_id = fromItemId
        overrides.to_item_id = toItemId
        overrides.relation_type = relationType
        overrides.note = edgeNote
      }

      const res = await window.api.chat.acceptAction(action.id, overrides)
      if (res.success) {
        showToast(
          isCreate 
            ? `Created Epic "${title || parsedArgs.title}"` 
            : isExploreCreate
              ? `Created Explore topic "${title || parsedArgs.title}"`
              : isAddSteps 
                ? 'Added Next actions' 
                : isEdgeCreate
                  ? `Linked "${fromItem?.title || 'Item'}" → "${toItem?.title || 'Item'}"`
                  : 'Updated Epic', 
          'success'
        )
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
    <div className="mt-3 rounded-xl border border-border-subtle bg-surface-card p-3.5 shadow-soft space-y-2.5 transition-all text-xs font-sans text-text-primary">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider ${
            isCreate 
              ? 'bg-accent/15 text-accent border border-accent/30' 
              : isExploreCreate
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                : isAddSteps
                  ? 'bg-done/15 text-done border border-done/30'
                  : isEdgeCreate
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'bg-surface-subtle text-text-secondary border border-border-subtle'
          }`}>
            {isCreate 
              ? '+ Create Epic' 
              : isExploreCreate 
                ? '🔬 + Explore Topic' 
                : isAddSteps 
                  ? '⚡ + Add Next Actions' 
                  : isEdgeCreate
                    ? '🔗 Proposed Relationship'
                    : '✎ Update Epic'}
          </span>
          {targetSector && !isEdgeCreate && (
            <span 
              className="flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle"
              style={{ color: `var(--color-${targetSector.color})` }}
            >
              <span>{targetSector.icon || '📁'}</span>
              <span>{targetSector.name}</span>
            </span>
          )}
        </div>

        {/* Resolved Badge */}
        {action.status === 'accepted' && (
          <span className="text-[10px] font-mono uppercase font-bold text-done bg-done/15 border border-done/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            ✓ Accepted
          </span>
        )}
        {action.status === 'rejected' && (
          <span className="text-[10px] font-mono uppercase font-bold text-text-muted bg-surface-subtle border border-border-subtle px-2 py-0.5 rounded-full flex items-center gap-1">
            ✕ Rejected
          </span>
        )}
      </div>

      {/* Content View / Edit Mode */}
      {!isEditing ? (
        <div className="space-y-2 pl-1">
          {/* Edge Creation Preview */}
          {isEdgeCreate && (
            <div className="space-y-2.5 py-1">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-subtle border border-border-subtle">
                {/* Source Item */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Source Item</div>
                  <div className="font-bold text-text-primary truncate">{fromItem?.title || parsedArgs.from_item_id}</div>
                  {fromSector && (
                    <span className="text-[10px] font-mono" style={{ color: `var(--color-${fromSector.color})` }}>
                      {fromSector.icon} {fromSector.name}
                    </span>
                  )}
                </div>

                {/* Directional Relation Pill */}
                <div className="flex flex-col items-center shrink-0 px-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent-subtle text-accent border border-accent/30 capitalize">
                    {parsedArgs.relation_type ? String(parsedArgs.relation_type).replace(/_/g, ' ') : 'relates to'}
                  </span>
                  <span className="text-text-muted text-xs">──▶</span>
                </div>

                {/* Target Item */}
                <div className="flex-1 min-w-0 text-right">
                  <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Target Item</div>
                  <div className="font-bold text-text-primary truncate">{toItem?.title || parsedArgs.to_item_id}</div>
                  {toSector && (
                    <span className="text-[10px] font-mono" style={{ color: `var(--color-${toSector.color})` }}>
                      {toSector.icon} {toSector.name}
                    </span>
                  )}
                </div>
              </div>

              {parsedArgs.note && (
                <div className="text-xs text-text-secondary italic">
                  <span className="text-text-muted font-medium not-italic">Note: </span>
                  {parsedArgs.note}
                </div>
              )}
            </div>
          )}

          {/* Epic Creation Preview */}
          {isCreate && (
            <div>
              <span className="text-text-muted font-medium">Epic Title: </span>
              <span className="font-bold text-text-primary">{parsedArgs.title}</span>
            </div>
          )}
          {isExploreCreate && (
            <div>
              <span className="text-text-muted font-medium">Research Topic: </span>
              <span className="font-bold text-purple-400">{parsedArgs.title}</span>
            </div>
          )}
          {(isUpdate || isAddSteps || isExploreCreate) && targetItem && (
            <div>
              <span className="text-text-muted font-medium">Parent Epic: </span>
              <span className="font-bold text-text-primary">{targetItem.title}</span>
            </div>
          )}
          {!isEdgeCreate && parsedArgs.status && (
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted font-medium">Status: </span>
              <span className="font-mono text-text-primary capitalize bg-surface-subtle px-1.5 py-0.2 rounded font-semibold border border-border-subtle">
                {parsedArgs.status}
              </span>
            </div>
          )}
          {!isEdgeCreate && parsedArgs.progress !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted font-medium">Progress: </span>
              <span className="font-mono text-accent font-bold">{parsedArgs.progress}%</span>
            </div>
          )}
          {!isEdgeCreate && parsedArgs.notes && (
            <div>
              <span className="text-text-muted font-medium">{isExploreCreate ? 'Findings / Notes: ' : 'Notes: '}</span>
              <span className="text-text-secondary italic">{parsedArgs.notes}</span>
            </div>
          )}

          {/* Explore Topics List View */}
          {exploreTopics.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-purple-400 font-medium flex items-center gap-1 font-mono text-[11px]">
                <span>🔬</span> Explore Topics ({exploreTopics.length}):
              </span>
              <div className="space-y-1.5 pl-2.5 border-l-2 border-purple-500/40">
                {exploreTopics.map((exp, idx) => (
                  <div key={idx} className="text-text-primary bg-surface-subtle p-2 rounded-lg border border-purple-500/20">
                    <span className="font-semibold text-purple-400">{exp.title}</span>
                    {exp.notes && <p className="text-[11px] text-text-secondary italic mt-0.5">{exp.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Steps Checklist View */}
          {actionSteps.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-accent font-medium flex items-center gap-1 font-mono text-[11px]">
                <span>⚡</span> Next Actions ({actionSteps.length}):
              </span>
              <div className="space-y-1 pl-2.5 border-l-2 border-accent/40">
                {actionSteps.map((step, idx) => (
                  <div key={idx} className="flex items-baseline gap-2 text-text-primary">
                    <span className="text-[10px] font-mono text-accent font-bold shrink-0">#{idx + 1}</span>
                    <span className="leading-snug">{step.content}</span>
                    {step.effort_value && (
                      <span className="text-[9px] font-mono text-text-muted bg-surface-subtle border border-border-subtle px-1.5 py-0.2 rounded shrink-0">
                        ⏱ {step.effort_value} {step.effort_unit || 'hr'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCreate && exploreTopics.length === 0 && actionSteps.length === 0 && (
            <div className="text-[11px] text-text-muted italic bg-surface-subtle p-2 rounded-lg border border-dashed border-border-subtle">
              No Explore topics or Next actions attached yet. Click <strong className="text-text-primary">Edit ✎</strong> below to add research questions or action steps!
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-2.5 pt-1 border-t border-border-subtle">
          {/* Edge Edit Form */}
          {isEdgeCreate && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Source Item (From)</label>
                  <select
                    value={fromItemId}
                    onChange={e => setFromItemId(e.target.value)}
                    className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-accent cursor-pointer"
                  >
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Target Item (To)</label>
                  <select
                    value={toItemId}
                    onChange={e => setToItemId(e.target.value)}
                    className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-accent cursor-pointer"
                  >
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Relation Type</label>
                <select
                  value={relationType}
                  onChange={e => setRelationType(e.target.value)}
                  className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-accent font-mono cursor-pointer"
                >
                  {['depends_on', 'supports', 'contradicts', 'relates_to'].map(rt => (
                    <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Rationale / Note (Optional)</label>
                <textarea
                  value={edgeNote}
                  onChange={e => setEdgeNote(e.target.value)}
                  rows={2}
                  placeholder="Why does this relationship exist..."
                  className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-accent resize-none"
                />
              </div>
            </div>
          )}

          {isExploreCreate && (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] uppercase font-mono text-purple-400 mb-0.5">Explore Topic Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-purple-400 mb-0.5">Findings / Research Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-purple-400 resize-none"
                />
              </div>
            </div>
          )}

          {isCreate && (
            <div>
              <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Epic Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-accent font-semibold"
              />
            </div>
          )}

          {isCreate && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Sector</label>
                <select
                  value={sectorId}
                  onChange={e => setSectorId(e.target.value)}
                  className="w-full bg-surface-input border border-border-subtle rounded-lg px-2 py-1 text-text-primary text-xs outline-none cursor-pointer"
                >
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as ItemStatus)}
                  className="w-full bg-surface-input border border-border-subtle rounded-lg px-2 py-1 text-text-primary text-xs outline-none cursor-pointer"
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
              <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Progress: {progress}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                className="w-full progress-range accent-accent"
              />
            </div>
          )}

          {/* Explore Topics Editor */}
          {isCreate && (
            <div className="space-y-2 p-2.5 rounded-xl bg-surface-subtle border border-purple-500/20">
              <label className="block text-[10px] uppercase font-mono text-purple-400 font-bold flex items-center gap-1">
                <span>🔬</span> Explore Topics (Research & Discovery)
              </label>
              
              {exploreTopics.length > 0 && (
                <div className="space-y-1.5">
                  {exploreTopics.map((exp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-purple-500/20 text-xs">
                      <div>
                        <span className="font-semibold text-purple-400">{exp.title}</span>
                        {exp.notes && <p className="text-[11px] text-text-secondary italic mt-0.5">{exp.notes}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExplore(idx)}
                        className="text-text-muted hover:text-blocked px-1 text-xs cursor-pointer"
                        title="Remove explore topic"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Explore Topic Form */}
              <div className="space-y-1.5 pt-1">
                <input
                  type="text"
                  value={newExploreTitle}
                  onChange={e => setNewExploreTitle(e.target.value)}
                  placeholder="Explore topic title (e.g. Research visa options)..."
                  className="w-full bg-surface-input border border-purple-500/20 rounded-lg px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-purple-400 font-mono"
                />
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newExploreNotes}
                    onChange={e => setNewExploreNotes(e.target.value)}
                    placeholder="Findings / questions (optional)..."
                    className="flex-1 bg-surface-input border border-purple-500/20 rounded-lg px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-purple-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddExplore}
                    disabled={!newExploreTitle.trim()}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    + Add Explore
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Steps Editor */}
          {(isCreate || isAddSteps) && (
            <div className="space-y-2 p-2.5 rounded-xl bg-surface-subtle border border-accent/20">
              <label className="block text-[10px] uppercase font-mono text-accent font-bold flex items-center gap-1">
                <span>⚡</span> Next Actions (Execution Steps)
              </label>
              <div className="space-y-1.5">
                {actionSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-accent font-bold shrink-0">#{idx + 1}</span>
                    <input
                      type="text"
                      value={step.content}
                      onChange={e => handleUpdateStepContent(idx, e.target.value)}
                      className="flex-1 bg-surface-input border border-border-subtle rounded-lg px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="text-text-muted hover:text-blocked px-1 text-xs cursor-pointer"
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
                    placeholder="Add action step and press Enter..."
                    className="flex-1 bg-surface-input border border-border-subtle rounded-lg px-2 py-0.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleAddStep}
                    disabled={!newStepContent.trim()}
                    className="px-2 py-0.5 rounded-lg bg-surface-raised hover:bg-surface-subtle border border-border-subtle disabled:opacity-40 text-text-secondary text-xs font-mono cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {isCreate && (
            <div>
              <label className="block text-[10px] uppercase font-mono text-text-muted mb-0.5">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-surface-input border border-border-subtle rounded-lg px-2.5 py-1 text-text-primary text-xs outline-none focus:border-accent resize-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="text-[11px] text-blocked bg-blocked-dim border border-blocked/30 p-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Action Buttons for Pending Status */}
      {action.status === 'pending' && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
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
            className="px-2.5 py-1 rounded-lg text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-strong font-mono text-[11px] transition-colors cursor-pointer"
          >
            {isEditing ? 'Cancel Edit' : 'Edit ✎'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="px-3 py-1 rounded-lg bg-surface-subtle hover:bg-surface-raised text-text-secondary border border-border-subtle font-semibold text-[11px] transition-colors cursor-pointer"
          >
            Reject ✕
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isSubmitting}
            className="px-3.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold text-[11px] transition-all shadow-soft active:scale-95 cursor-pointer"
          >
            {isSubmitting ? 'Applying...' : 'Accept ✓'}
          </button>
        </div>
      )}
    </div>
  )
}
