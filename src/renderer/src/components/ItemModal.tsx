import React, { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item, ItemStatus, ActionLogEntry, EffortEntry, EffortTotal, TabType, ChecklistItem } from '../types'
import { EffortPrompt } from './EffortPrompt'
import { parseChecklist, formatChecklist, formatEffortBadge } from '../utils/checklist'
import { renderSimpleMarkdown } from '../utils/markdown'
import { formatActionLogEntry } from '../utils/historyFormatter'

export const ItemModal: React.FC = () => {
  const { 
    selectedItemId, 
    selectedSectorId,
    closeModal, 
    getItemById, 
    sectors, 
    updateItem, 
    createItem, 
    deleteItem,
    items,
    addEffort,
    showToast,
    setUrgent,
    settings,
    setChecklistEffortPrompt,
    getActionSteps,
    addActionStep,
    toggleActionStep,
    deleteActionStep,
    updateActionStep
  } = useAppContext()

  const existingItem = selectedItemId ? getItemById(selectedItemId) : undefined
  const isNew = !selectedItemId

  const [title, setTitle] = useState(existingItem?.title || '')
  const [sectorId, setSectorId] = useState(existingItem?.sector_id || selectedSectorId || sectors[0]?.id || '')
  const [status, setStatus] = useState<ItemStatus>(existingItem?.status || 'active')
  const [progress, setProgress] = useState(existingItem?.progress || 0)
  const [notes, setNotes] = useState(existingItem?.notes || '')
  const [notesTab, setNotesTab] = useState<'edit' | 'preview'>(isNew || !existingItem?.notes ? 'edit' : 'preview')
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Action steps state
  const existingSteps = selectedItemId ? getActionSteps(selectedItemId) : []
  const [localSteps, setLocalSteps] = useState<{ id: string; content: string; is_done: boolean; effort_value?: number | null; effort_unit?: string | null }[]>([])
  const [newStepText, setNewStepText] = useState('')
  const [newStepEffort, setNewStepEffort] = useState<number | undefined>(undefined)
  const [newStepUnit, setNewStepUnit] = useState<'mins' | 'hours' | 'days'>('hours')
  
  const [isUrgent, setIsUrgent] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const [effortLog, setEffortLog] = useState<EffortEntry[]>([])
  const [effortTotals, setEffortTotals] = useState<EffortTotal | null>(null)
  const [showEffortInline, setShowEffortInline] = useState(false)

  useEffect(() => {
    if (selectedItemId && activeTab === 'history') {
      window.api.actionLog.listForItem(selectedItemId).then(setActionLog)
    }
    if (selectedItemId && activeTab === 'effort') {
      window.api.effortLog.listForItem(selectedItemId).then(setEffortLog)
      window.api.effortLog.getTotals(selectedItemId).then(res => setEffortTotals(res[0] || null))
    }
  }, [selectedItemId, activeTab])

  // Step operations
  const displaySteps = isNew ? localSteps : existingSteps

  const handleAddStep = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newStepText.trim()
    if (!trimmed) return

    const effortOpts = newStepEffort && newStepEffort > 0 ? { effort_value: newStepEffort, effort_unit: newStepUnit } : undefined

    if (isNew) {
      setLocalSteps(prev => [...prev, { 
        id: `temp-${Date.now()}`, 
        content: trimmed, 
        is_done: false,
        effort_value: newStepEffort,
        effort_unit: newStepEffort ? newStepUnit : undefined
      }])
    } else if (selectedItemId) {
      await addActionStep(selectedItemId, trimmed, effortOpts)
    }
    setNewStepText('')
    setNewStepEffort(undefined)
  }

  const handleToggleStep = async (stepId: string, idx: number) => {
    if (isNew) {
      setLocalSteps(prev => prev.map((s, i) => i === idx ? { ...s, is_done: !s.is_done } : s))
    } else {
      const target = existingSteps.find(s => s.id === stepId)
      const willBeDone = target ? !target.is_done : true
      await toggleActionStep(stepId)
      if (willBeDone && selectedItemId && target) {
        setChecklistEffortPrompt({
          itemId: selectedItemId,
          checklistItem: {
            id: target.id,
            text: target.content,
            completed: true,
            effortValue: target.effort_value ?? undefined,
            effortUnit: (target.effort_unit as any) || undefined
          }
        })
      }
    }
  }

  const handleDeleteStep = async (stepId: string, idx: number) => {
    if (isNew) {
      setLocalSteps(prev => prev.filter((_, i) => i !== idx))
    } else {
      await deleteActionStep(stepId)
    }
  }

  const handleUpdateStepText = async (stepId: string, idx: number, text: string) => {
    if (isNew) {
      setLocalSteps(prev => prev.map((s, i) => i === idx ? { ...s, content: text } : s))
    } else {
      await updateActionStep(stepId, { content: text })
    }
  }

  // Rich text formatting helper
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = notesTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = notes.substring(start, end)
    const replacement = `${prefix}${selected || 'text'}${suffix}`
    const updated = notes.substring(0, start) + replacement + notes.substring(end)
    setNotes(updated)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4))
    }, 10)
  }

  const handleSave = async () => {
    if (!title.trim()) return showToast('Title is required', 'warning')
    if (!sectorId) return showToast('Sector is required', 'warning')

    if (isNew) {
      const newItem = await createItem({ 
        title: title.trim(), 
        sector_id: sectorId, 
        status, 
        progress, 
        notes: notes.trim() || undefined
      })
      for (const s of localSteps) {
        if (!s.content.trim()) continue
        const created = await window.api.actionSteps.create(newItem.id, s.content.trim(), {
          effort_value: s.effort_value || undefined,
          effort_unit: s.effort_unit || undefined
        })
        if (s.is_done) {
          await window.api.actionSteps.toggle(created.id)
        }
      }
      if (isUrgent) {
        await setUrgent(newItem.id)
      }
      showToast('Item created', 'success')
    } else if (existingItem) {
      const changes: Partial<Omit<Item, 'id' | 'created_at'>> = {}
      if (title.trim() !== existingItem.title) changes.title = title.trim()
      if (sectorId !== existingItem.sector_id) changes.sector_id = sectorId
      if (status !== existingItem.status) changes.status = status
      if (progress !== existingItem.progress) changes.progress = progress
      if (notes !== existingItem.notes) changes.notes = notes
      
      if (Object.keys(changes).length > 0) {
        await updateItem(existingItem.id, changes)
        showToast('Item updated', 'success')
      }
    }
    closeModal()
  }

  const handleDelete = async () => {
    if (existingItem) await deleteItem(existingItem.id)
    showToast('Item deleted', 'info')
    closeModal()
  }
  
  const handleEffortSave = async (amount: number, unit: 'hours' | 'days', note?: string) => {
    if (!selectedItemId) return
    await addEffort(selectedItemId, amount, unit, note)
    setShowEffortInline(false)
    window.api.effortLog.listForItem(selectedItemId).then(setEffortLog)
    window.api.effortLog.getTotals(selectedItemId).then(res => setEffortTotals(res[0] || null))
  }

  // Active limit check
  const isSettingActive = status === 'active' && (!existingItem || existingItem.status !== 'active')
  const activeCount = items.filter(i => i.status === 'active').length
  const overLimit = isSettingActive && activeCount >= settings.focus_limit

  const statusStyles: Record<ItemStatus, { active: string; inactive: string }> = {
    active: {
      active: 'bg-blue-500/20 text-blue-300 border-blue-500/60 shadow-[0_0_12px_rgba(59,130,246,0.3)] font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-blue-500/40 hover:text-slate-200'
    },
    paused: {
      active: 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-amber-500/40 hover:text-slate-200'
    },
    blocked: {
      active: 'bg-red-500/20 text-red-300 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.3)] font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-red-500/40 hover:text-slate-200'
    },
    done: {
      active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)] font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-emerald-500/40 hover:text-slate-200'
    },
    queued: {
      active: 'bg-slate-500/20 text-slate-300 border-slate-500/60 font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={closeModal}
    >
      <div 
        className="bg-[#0f141f]/95 border border-white/[0.12] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 pt-4 pb-0 bg-white/[0.02]">
          <div className="flex gap-6">
            {(['details', 'history', 'effort'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                disabled={isNew && t !== 'details'}
                className={`pb-3 text-sm font-semibold capitalize border-b-2 transition-all ${
                  activeTab === t 
                    ? 'border-blue-500 text-blue-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } ${isNew && t !== 'details' ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button 
            onClick={closeModal} 
            className="text-slate-400 hover:text-slate-100 pb-3 text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Title */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full bg-transparent font-sans text-2xl font-bold text-slate-100 outline-none placeholder:text-slate-600 tracking-tight"
                  autoFocus
                />
              </div>

              {/* Next Action Steps Spine List (Amendment 12) */}
              <div className="bg-[#0a0d14]/80 border border-white/[0.08] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                      Next Action Steps
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                      {displaySteps.filter(s => s.is_done).length}/{displaySteps.length} done
                    </span>
                  </div>
                  {displaySteps.length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {Math.round((displaySteps.filter(s => s.is_done).length / displaySteps.length) * 100)}%
                    </span>
                  )}
                </div>

                {/* Steps Spine List */}
                <div className="space-y-0 relative pl-1">
                  {displaySteps.map((step, idx) => {
                    const isDone = step.is_done
                    const isFirstUndone = !isDone && displaySteps.slice(0, idx).every(s => s.is_done)

                    return (
                      <div key={step.id} className="group relative flex items-center gap-3 py-2">
                        {/* Vertical Spine Line */}
                        {idx < displaySteps.length - 1 && (
                          <div 
                            className="absolute left-[8px] top-6 bottom-[-8px] w-0.5 transition-colors duration-200"
                            style={{
                              backgroundColor: isDone ? '#e8b23d' : 'rgba(255, 255, 255, 0.10)'
                            }}
                          />
                        )}

                        {/* Node (Circle) */}
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id, idx)}
                          className={`w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center transition-all duration-200 z-10 cursor-pointer ${
                            isDone
                              ? 'bg-amber-400 border-2 border-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                              : isFirstUndone
                              ? 'border-2 border-amber-400 bg-[#0f141f] shadow-[0_0_8px_rgba(251,191,36,0.3)] hover:scale-110'
                              : 'border-2 border-slate-600 bg-[#0f141f] hover:border-slate-400'
                          }`}
                          title={isDone ? 'Mark step undone' : 'Mark step done'}
                        >
                          {isDone && <span className="text-[10px] font-bold leading-none">✓</span>}
                        </button>

                        {/* Step Content Input */}
                        <input
                          type="text"
                          value={step.content}
                          onChange={e => handleUpdateStepText(step.id, idx, e.target.value)}
                          className={`flex-1 bg-transparent text-sm outline-none transition-all ${
                            isDone 
                              ? 'line-through text-slate-500' 
                              : isFirstUndone 
                              ? 'font-semibold text-slate-100' 
                              : 'text-slate-300'
                          }`}
                        />

                        {step.effort_value && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (selectedItemId) {
                                setChecklistEffortPrompt({
                                  itemId: selectedItemId,
                                  checklistItem: {
                                    id: step.id,
                                    text: step.content,
                                    completed: step.is_done,
                                    effortValue: step.effort_value ?? undefined,
                                    effortUnit: (step.effort_unit as any) || undefined
                                  }
                                })
                              }
                            }}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0 hover:bg-blue-500/25 transition-colors cursor-pointer"
                            title="Click to log effort"
                          >
                            ⏱ {formatEffortBadge(step.effort_value, (step.effort_unit as any) || 'hours')}
                          </button>
                        )}

                        {isFirstUndone && (
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0">
                            Up Next
                          </span>
                        )}

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteStep(step.id, idx)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-xs px-1.5 transition-opacity cursor-pointer"
                          title="Delete step"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* + add step input form with optional effort estimate */}
                <form onSubmit={handleAddStep} className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-dashed border-slate-600 shrink-0 flex items-center justify-center text-[10px] text-slate-500">
                    +
                  </div>
                  <input
                    type="text"
                    value={newStepText}
                    onChange={e => setNewStepText(e.target.value)}
                    placeholder="+ add step (press Enter)"
                    className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:placeholder:text-slate-400 py-1"
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={newStepEffort || ''}
                    onChange={e => setNewStepEffort(parseFloat(e.target.value) || undefined)}
                    placeholder="Est."
                    className="w-14 bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-1 text-xs text-slate-200 outline-none focus:border-amber-400 font-mono text-center"
                    title="Estimated effort"
                  />
                  <select
                    value={newStepUnit}
                    onChange={e => setNewStepUnit(e.target.value as any)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-1 text-xs text-slate-300 outline-none font-mono cursor-pointer"
                  >
                    <option value="mins">mins</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                  <button
                    type="submit"
                    className="text-xs text-amber-400 hover:text-amber-300 font-mono px-2.5 py-1 rounded bg-amber-400/10 border border-amber-400/20 cursor-pointer transition-colors"
                  >
                    + Add
                  </button>
                </form>
              </div>

              {/* Sector & Status 2-Column Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Sector */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Sector</label>
                  <div className="relative">
                    <select
                      value={sectorId}
                      onChange={e => setSectorId(e.target.value)}
                      className="w-full bg-[#121622] border border-white/[0.10] rounded-lg px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 cursor-pointer appearance-none"
                    >
                      <option value="" disabled>Select sector...</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                      ▼
                    </div>
                  </div>
                </div>
                
                {/* Status */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Status</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['active', 'paused', 'blocked', 'done'] as const).map(s => {
                      const isSelected = status === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setStatus(s)
                            if (s === 'done') setProgress(100)
                            if (s !== 'done' && progress === 100) setProgress(95)
                          }}
                          className={`text-[10px] font-mono uppercase tracking-wider py-2 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected ? statusStyles[s].active : statusStyles[s].inactive
                          }`}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {isNew && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isUrgent}
                      onChange={e => setIsUrgent(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>⚡ This is urgent — put it at #1 priority in stack</span>
                  </label>
                </div>
              )}

              {overLimit && (
                <div className="bg-red-500/10 text-red-300 p-3 rounded-xl text-xs border border-red-500/30 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Setting this to Active will exceed your focus limit of {settings.focus_limit}.</span>
                </div>
              )}

              {/* Progress Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-mono text-slate-400">Progress</label>
                  <span className="text-xs font-mono font-bold text-blue-400">{progress}%</span>
                </div>
                <div className="relative h-2 bg-white/[0.08] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-200 bg-blue-500" 
                    style={{ width: `${progress}%` }} 
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progress}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10)
                      setProgress(val)
                      if (val === 100) setStatus('done')
                      else if (status === 'done' && val < 100) setStatus('active')
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title={`Progress: ${progress}%`}
                  />
                </div>
              </div>

              {/* Rich Notes Editor & Formatted Preview */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider">
                    Notes & Description
                  </label>
                  <div className="flex gap-1 bg-[#121622] p-0.5 rounded-lg border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setNotesTab('preview')}
                      className={`text-[10px] font-mono px-3 py-1 rounded transition-colors ${
                        notesTab === 'preview' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesTab('edit')}
                      className={`text-[10px] font-mono px-3 py-1 rounded transition-colors ${
                        notesTab === 'edit' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>

                {notesTab === 'edit' ? (
                  <div className="space-y-1.5">
                    {/* Rich text formatting toolbar */}
                    <div className="flex items-center gap-1 p-1 bg-[#121622] border border-white/[0.08] rounded-t-lg">
                      <button
                        type="button"
                        onClick={() => insertFormatting('**', '**')}
                        className="px-2 py-0.5 text-xs font-bold text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('*', '*')}
                        className="px-2 py-0.5 text-xs italic font-serif text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('### ')}
                        className="px-2 py-0.5 text-xs font-mono text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Heading"
                      >
                        H
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('- ')}
                        className="px-2 py-0.5 text-xs text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Bullet list"
                      >
                        • List
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('1. ')}
                        className="px-2 py-0.5 text-xs text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Numbered list"
                      >
                        1. List
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('- [ ] ')}
                        className="px-2 py-0.5 text-xs text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Checklist item"
                      >
                        ✓ Task
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('`', '`')}
                        className="px-2 py-0.5 text-xs font-mono text-slate-300 hover:bg-white/[0.08] rounded"
                        title="Inline code"
                      >
                        &lt;&gt;
                      </button>
                    </div>

                    <textarea
                      ref={notesTextareaRef}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add detailed notes, markdown notes, context, or instructions..."
                      className="w-full h-36 bg-[#0a0d14] border border-white/[0.08] rounded-b-lg p-3 text-sm text-slate-200 outline-none focus:border-blue-500 resize-y font-sans leading-relaxed"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => setNotesTab('edit')} 
                    className="w-full min-h-[128px] max-h-64 overflow-y-auto bg-[#0a0d14] hover:bg-[#0d121f] border border-white/[0.08] hover:border-white/[0.15] rounded-lg p-3.5 cursor-pointer transition-all group"
                    title="Click to edit notes"
                  >
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-white/[0.04]">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Formatted Markdown Preview</span>
                      <span className="text-[10px] font-mono text-blue-400 group-hover:underline">Click to Edit ✏️</span>
                    </div>
                    {renderSimpleMarkdown(notes)}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 relative pl-4 border-l-2 border-white/[0.08]">
              {actionLog.map(entry => (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="text-sm text-slate-200 mb-0.5">
                    {formatActionLogEntry(entry, sectors)}
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    {new Date(entry.changed_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {actionLog.length === 0 && (
                <div className="text-slate-500 text-sm italic">No history recorded yet.</div>
              )}
            </div>
          )}

          {activeTab === 'effort' && (
            <div className="space-y-6">
              {effortTotals && (
                <div className="bg-[#0a0d14] p-4 rounded-xl border border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">Total Effort Logged</span>
                  <span className="font-mono text-lg font-bold text-blue-400">
                    {effortTotals.entries_hours}h {effortTotals.entries_days > 0 ? `, ${effortTotals.entries_days}d` : ''}
                  </span>
                </div>
              )}
              
              {!showEffortInline ? (
                <button 
                  type="button"
                  onClick={() => setShowEffortInline(true)}
                  className="w-full py-2.5 border border-dashed border-white/[0.15] text-slate-300 text-xs font-mono uppercase rounded-xl hover:border-blue-500 hover:text-blue-400 transition-colors"
                >
                  + Log Effort Manually
                </button>
              ) : (
                <EffortPrompt 
                  itemId={selectedItemId!} 
                  onSave={handleEffortSave} 
                  onSkip={() => setShowEffortInline(false)} 
                />
              )}

              <div className="space-y-2">
                {effortLog.map(entry => (
                  <div key={entry.id} className="flex justify-between items-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <div>
                      <div className="text-sm text-slate-200 font-medium">{entry.note || 'Logged effort'}</div>
                      <div className="text-xs font-mono text-slate-500">{new Date(entry.logged_at).toLocaleString()}</div>
                    </div>
                    <div className="font-mono text-blue-400 text-sm font-semibold">
                      +{entry.amount} {entry.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'details' && (
          <div className="p-4 border-t border-white/[0.08] bg-white/[0.02] flex justify-between items-center">
            {!isNew ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400 font-medium font-mono">Delete item?</span>
                  <button 
                    type="button"
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Confirm
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1.5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Delete Task
                </button>
              )
            ) : <div/>}
            
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={closeModal} 
                className="text-slate-400 hover:text-slate-200 px-4 py-2 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-lg text-xs transition-colors shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
