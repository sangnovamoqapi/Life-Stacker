import React, { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item, ItemStatus, ActionLogEntry, EffortEntry, EffortTotal, TabType, TimeBudget, TimeEstimate } from '../types'
import { EffortPrompt } from './EffortPrompt'
import { ParkSwapModal } from './ParkSwapModal'
import { formatEffortBadge } from '../utils/checklist'
import { renderSimpleMarkdown } from '../utils/markdown'
import { formatActionLogEntry } from '../utils/historyFormatter'

type TimeEstimateUnit = NonNullable<TimeEstimate['unit']>

interface StagedDraft {
  id: string
  title: string
  time_estimate_value?: number
  time_estimate_unit: TimeEstimateUnit
}

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
    getNextItems, 
    addNextItem, 
    addNextItemsBatch,
    toggleNextItem, 
    deleteNextItem, 
    updateNextItem,
    promoteToToday,
    demoteFromToday,
    getExploreItems,
    addExploreItem,
    updateExploreItem,
    deleteExploreItem,
    toggleExploreItemClosed
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

  // Time budget
  const initialBudget: TimeBudget | null = existingItem?.time_budget 
    ? (typeof existingItem.time_budget === 'string' ? JSON.parse(existingItem.time_budget) : existingItem.time_budget) 
    : null
  const [budgetValue, setBudgetValue] = useState<number | undefined>(initialBudget?.value)
  const [budgetUnit, setBudgetUnit] = useState<'months' | 'quarters' | 'years'>(initialBudget?.unit || 'months')

  // Next items state
  const existingNext = selectedItemId ? getNextItems(selectedItemId) : []
  const [localNext, setLocalNext] = useState<{ id: string; parent_explore_id?: string | null; title: string; status: 'next' | 'today' | 'done'; time_estimate_value?: number | null; time_estimate_unit?: string | null }[]>([])
  const [newStepText, setNewStepText] = useState('')
  const [newStepEffort, setNewStepEffort] = useState<number | undefined>(undefined)
  const [newStepUnit, setNewStepUnit] = useState<TimeEstimateUnit>('hours')

  // Explore items state
  const existingExplore = selectedItemId ? getExploreItems(selectedItemId) : []
  const [localExplore, setLocalExplore] = useState<{ id: string; title: string; notes: string; closed: boolean; time_estimate_value?: number | null; time_estimate_unit?: string | null }[]>([])
  const [expandedExploreIds, setExpandedExploreIds] = useState<Set<string>>(new Set())
  const [newExploreTitle, setNewExploreTitle] = useState('')
  const [newExploreNotes, setNewExploreNotes] = useState('')
  const [newExploreEffort, setNewExploreEffort] = useState<number | undefined>(undefined)
  const [newExploreUnit, setNewExploreUnit] = useState<TimeEstimateUnit>('hours')
  const [showAddExploreForm, setShowAddExploreForm] = useState(false)

  // Spawning single next item from explore state
  const [spawningExploreId, setSpawningExploreId] = useState<string | null>(null)
  const [spawnNextTitle, setSpawnNextTitle] = useState('')
  const [spawnNextEffort, setSpawnNextEffort] = useState<number | undefined>(undefined)
  const [spawnNextUnit, setSpawnNextUnit] = useState<TimeEstimateUnit>('hours')

  // Phase 3 Staged Next Generation State
  const [stagingExploreId, setStagingExploreId] = useState<string | null>(null)
  const [stagingDrafts, setStagingDrafts] = useState<StagedDraft[]>([])
  const [isGeneratingNext, setIsGeneratingNext] = useState(false)

  // Swap Modal State
  const [showParkSwapModal, setShowParkSwapModal] = useState(false)

  const [isUrgent, setIsUrgent] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const [effortLog, setEffortLog] = useState<EffortEntry[]>([])
  const [effortTotals, setEffortTotals] = useState<EffortTotal | null>(null)
  const [showEffortInline, setShowEffortInline] = useState(false)

  const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5
  const activeCount = items.filter(i => i.status === 'active').length

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
  const displayNext = isNew ? localNext : existingNext
  const displayExplore = isNew ? localExplore : existingExplore

  // Split Next items into standard Next and Today items
  const standardNextItems = displayNext.filter(n => n.status === 'next')
  const todayItems = displayNext.filter(n => n.status === 'today')
  const doneNextItems = displayNext.filter(n => n.status === 'done')

  const handleAddNext = async (e?: React.FormEvent, parentExploreId?: string | null) => {
    if (e) e.preventDefault()
    const trimmed = newStepText.trim()
    if (!trimmed) return

    if (isNew) {
      setLocalNext(prev => [...prev, { 
        id: `temp-${Date.now()}`, 
        parent_explore_id: parentExploreId || null,
        title: trimmed, 
        status: 'next',
        time_estimate_value: newStepEffort,
        time_estimate_unit: newStepEffort ? newStepUnit : undefined
      }])
    } else if (selectedItemId) {
      await addNextItem({
        epic_id: selectedItemId,
        parent_explore_id: parentExploreId || undefined,
        title: trimmed,
        time_estimate_value: newStepEffort,
        time_estimate_unit: newStepEffort ? newStepUnit : undefined
      })
    }
    setNewStepText('')
    setNewStepEffort(undefined)
  }

  const handleSpawnFromExplore = async (exploreId: string) => {
    const trimmed = spawnNextTitle.trim()
    if (!trimmed) return

    if (isNew) {
      setLocalNext(prev => [...prev, {
        id: `temp-${Date.now()}`,
        parent_explore_id: exploreId,
        title: trimmed,
        status: 'next',
        time_estimate_value: spawnNextEffort,
        time_estimate_unit: spawnNextEffort ? spawnNextUnit : undefined
      }])
    } else if (selectedItemId) {
      await addNextItem({
        epic_id: selectedItemId,
        parent_explore_id: exploreId,
        title: trimmed,
        time_estimate_value: spawnNextEffort,
        time_estimate_unit: spawnNextEffort ? spawnNextUnit : undefined
      })
      showToast('Spawned Next action from research finding', 'success')
    }

    setSpawnNextTitle('')
    setSpawnNextEffort(undefined)
    setSpawningExploreId(null)
  }

  // ─── Phase 3 AI Staging Draft Handlers ───
  const handleGenerateNextDrafts = async (exp: { id: string; title: string; notes: string }) => {
    setIsGeneratingNext(true)
    setStagingExploreId(exp.id)
    setSpawningExploreId(null)

    try {
      const rawSuggestions = await window.api.ai.generateNextFromExplore(exp.title, exp.notes)
      if (rawSuggestions && rawSuggestions.length > 0) {
        setStagingDrafts(rawSuggestions.map((s, idx) => ({
          id: `draft-${Date.now()}-${idx}`,
          title: s.title,
          time_estimate_value: s.time_estimate_value,
          time_estimate_unit: (s.time_estimate_unit as any) || 'hours'
        })))
      } else {
        setStagingDrafts([{
          id: `draft-${Date.now()}-0`,
          title: `Action for ${exp.title || 'Research'}`,
          time_estimate_value: 2,
          time_estimate_unit: 'hours'
        }])
      }
    } catch {
      showToast('Could not contact model; added draft row', 'info')
      setStagingDrafts([{
        id: `draft-${Date.now()}-0`,
        title: '',
        time_estimate_value: 1,
        time_estimate_unit: 'hours'
      }])
    } finally {
      setIsGeneratingNext(false)
    }
  }

  const handleAddStagedRow = () => {
    setStagingDrafts(prev => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random()}`,
        title: '',
        time_estimate_value: 1,
        time_estimate_unit: 'hours'
      }
    ])
  }

  const handleUpdateStagedDraft = (draftId: string, changes: Partial<StagedDraft>) => {
    setStagingDrafts(prev => prev.map(d => d.id === draftId ? { ...d, ...changes } : d))
  }

  const handleDeleteStagedDraft = (draftId: string) => {
    setStagingDrafts(prev => prev.filter(d => d.id !== draftId))
  }

  const handleCommitStagedDrafts = async (exploreId: string) => {
    const validDrafts = stagingDrafts.filter(d => d.title.trim().length > 0)
    if (validDrafts.length === 0) {
      setStagingExploreId(null)
      setStagingDrafts([])
      return
    }

    if (isNew) {
      setLocalNext(prev => [
        ...prev,
        ...validDrafts.map(d => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          parent_explore_id: exploreId,
          title: d.title.trim(),
          status: 'next' as const,
          time_estimate_value: d.time_estimate_value,
          time_estimate_unit: d.time_estimate_value ? d.time_estimate_unit : undefined
        }))
      ])
    } else if (selectedItemId) {
      await addNextItemsBatch(validDrafts.map(d => ({
        epic_id: selectedItemId,
        parent_explore_id: exploreId,
        title: d.title.trim(),
        time_estimate_value: d.time_estimate_value,
        time_estimate_unit: d.time_estimate_value ? d.time_estimate_unit : undefined,
        status: 'next'
      })))
    }

    showToast(`Committed ${validDrafts.length} Next action(s) from research`, 'success')
    setStagingExploreId(null)
    setStagingDrafts([])
  }

  const handleCancelStagedDrafts = () => {
    setStagingExploreId(null)
    setStagingDrafts([])
  }

  const handleToggleNext = async (stepId: string) => {
    if (isNew) {
      setLocalNext(prev => prev.map(s => s.id === stepId ? { ...s, status: s.status === 'done' ? 'next' : 'done' } : s))
    } else {
      const target = existingNext.find(s => s.id === stepId)
      const willBeDone = target ? target.status !== 'done' : true
      await toggleNextItem(stepId)
      if (willBeDone && selectedItemId && target) {
        setChecklistEffortPrompt({
          itemId: selectedItemId,
          checklistItem: {
            id: target.id,
            text: target.title,
            completed: true,
            effortValue: target.time_estimate_value ?? undefined,
            effortUnit: (target.time_estimate_unit as any) || undefined
          }
        })
      }
    }
  }

  const handlePromoteToToday = async (stepId: string) => {
    if (isNew) {
      setLocalNext(prev => prev.map(s => s.id === stepId ? { ...s, status: 'today' } : s))
    } else {
      await promoteToToday(stepId)
      showToast('Pulled into Today focus', 'success')
    }
  }

  const handleDemoteFromToday = async (stepId: string) => {
    if (isNew) {
      setLocalNext(prev => prev.map(s => s.id === stepId ? { ...s, status: 'next' } : s))
    } else {
      await demoteFromToday(stepId)
      showToast('Moved back to Next stack', 'info')
    }
  }

  const handleDeleteNext = async (stepId: string) => {
    if (isNew) {
      setLocalNext(prev => prev.filter(s => s.id !== stepId))
    } else {
      await deleteNextItem(stepId)
    }
  }

  const handleUpdateNextTitle = async (stepId: string, text: string) => {
    if (isNew) {
      setLocalNext(prev => prev.map(s => s.id === stepId ? { ...s, title: text } : s))
    } else {
      await updateNextItem(stepId, { title: text })
    }
  }

  // ─── Explore item operations ───
  const toggleExploreExpanded = (id: string) => {
    setExpandedExploreIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddExplore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedTitle = newExploreTitle.trim()
    const trimmedNotes = newExploreNotes.trim()
    if (!trimmedTitle && !trimmedNotes) return

    const titleToSave = trimmedTitle || trimmedNotes.split('\n')[0]

    if (isNew) {
      setLocalExplore(prev => [...prev, {
        id: `temp-exp-${Date.now()}`,
        title: titleToSave,
        notes: trimmedNotes,
        closed: false,
        time_estimate_value: newExploreEffort,
        time_estimate_unit: newExploreEffort ? newExploreUnit : undefined
      }])
    } else if (selectedItemId) {
      await addExploreItem({
        epic_id: selectedItemId,
        title: titleToSave,
        notes: trimmedNotes,
        time_estimate_value: newExploreEffort,
        time_estimate_unit: newExploreEffort ? newExploreUnit : undefined
      })
    }
    setNewExploreTitle('')
    setNewExploreNotes('')
    setNewExploreEffort(undefined)
    setShowAddExploreForm(false)
  }

  const handleToggleExploreClosed = async (expId: string) => {
    if (isNew) {
      setLocalExplore(prev => prev.map(e => e.id === expId ? { ...e, closed: !e.closed } : e))
    } else {
      await toggleExploreItemClosed(expId)
    }
  }

  const handleDeleteExplore = async (expId: string) => {
    if (isNew) {
      setLocalExplore(prev => prev.filter(e => e.id !== expId))
    } else {
      try {
        await deleteExploreItem(expId)
        showToast('Explore topic deleted', 'info')
      } catch (err: any) {
        showToast(err?.message || 'Failed to delete Explore topic', 'warning')
      }
    }
  }

  const getLinkedNextCount = (expId: string) => {
    return displayNext.filter(n => n.parent_explore_id === expId).length
  }

  const getExploreTitle = (expId?: string | null) => {
    if (!expId) return null
    const found = displayExplore.find(e => e.id === expId)
    return found?.title || found?.notes.split('\n')[0] || 'Research Finding'
  }

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

  const handleStatusSelect = (s: ItemStatus) => {
    if (s === 'active' && (!existingItem || existingItem.status !== 'active') && activeCount >= activeCap) {
      setShowParkSwapModal(true)
      return
    }
    setStatus(s)
    if (s === 'done') setProgress(100)
    if (s !== 'done' && progress === 100) setProgress(95)
  }

  const handleConfirmParkSwap = async (epicToParkId: string) => {
    await updateItem(epicToParkId, { status: 'parked' })
    setStatus('active')
    setShowParkSwapModal(false)
    const parkedEpic = items.find(i => i.id === epicToParkId)
    showToast(`Swapped: this epic will be active, "${parkedEpic?.title || 'Epic'}" parked`, 'success')
  }

  const handleSave = async () => {
    if (!title.trim()) return showToast('Title is required', 'warning')
    if (!sectorId) return showToast('Sector is required', 'warning')

    // Completion Rule Check
    if (status === 'done') {
      const openCount = displayNext.filter(n => n.status !== 'done').length
      if (openCount > 0) {
        return showToast(`Cannot mark Epic as Done while ${openCount} open Next item(s) exist.`, 'warning')
      }
    }

    const budgetData: TimeBudget | null = budgetValue ? { value: budgetValue, unit: budgetUnit } : null

    if (isNew) {
      const newItem = await createItem({ 
        title: title.trim(), 
        sector_id: sectorId, 
        status, 
        progress, 
        notes: notes.trim() || undefined,
        time_budget: budgetData || undefined
      })

      // Create explore items
      const exploreIdMap = new Map<string, string>()
      for (const exp of localExplore) {
        if (!exp.title.trim() && !exp.notes.trim()) continue
        const createdExp = await window.api.exploreItems.create({
          epic_id: newItem.id,
          title: exp.title.trim() || exp.notes.split('\n')[0],
          notes: exp.notes.trim(),
          time_estimate_value: exp.time_estimate_value || undefined,
          time_estimate_unit: exp.time_estimate_unit || undefined,
          closed: exp.closed
        })
        exploreIdMap.set(exp.id, createdExp.id)
      }

      // Create next items
      for (const s of localNext) {
        if (!s.title.trim()) continue
        const mappedParentId = s.parent_explore_id ? exploreIdMap.get(s.parent_explore_id) || undefined : undefined
        await window.api.nextItems.create({
          epic_id: newItem.id,
          parent_explore_id: mappedParentId,
          title: s.title.trim(),
          time_estimate_value: s.time_estimate_value || undefined,
          time_estimate_unit: s.time_estimate_unit || undefined,
          status: s.status
        })
      }

      if (isUrgent) {
        await setUrgent(newItem.id)
      }
      showToast('Epic created', 'success')
    } else if (existingItem) {
      const changes: Partial<Omit<Item, 'id' | 'created_at'>> = {}
      if (title.trim() !== existingItem.title) changes.title = title.trim()
      if (sectorId !== existingItem.sector_id) changes.sector_id = sectorId
      if (status !== existingItem.status) changes.status = status
      if (progress !== existingItem.progress) changes.progress = progress
      if (notes !== existingItem.notes) changes.notes = notes
      changes.time_budget = budgetData as any
      
      try {
        await updateItem(existingItem.id, changes)
        showToast('Epic updated', 'success')
      } catch (err: any) {
        showToast(err?.message || 'Failed to update epic', 'warning')
        return
      }
    }
    closeModal()
  }

  const handleDelete = async () => {
    if (existingItem) await deleteItem(existingItem.id)
    showToast('Epic deleted', 'info')
    closeModal()
  }
  
  const handleEffortSave = async (amount: number, unit: 'hours' | 'days', note?: string) => {
    if (!selectedItemId) return
    await addEffort(selectedItemId, amount, unit, note)
    setShowEffortInline(false)
    window.api.effortLog.listForItem(selectedItemId).then(setEffortLog)
    window.api.effortLog.getTotals(selectedItemId).then(res => setEffortTotals(res[0] || null))
  }

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
      active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(168,185,129,0.3)] font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-emerald-500/40 hover:text-slate-200'
    },
    queued: {
      active: 'bg-slate-500/20 text-slate-300 border-slate-500/60 font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
    },
    parked: {
      active: 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)] font-bold',
      inactive: 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-purple-500/40 hover:text-slate-200'
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={closeModal}
    >
      <div 
        className="bg-[#0f141f]/95 border border-white/[0.12] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
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
              {/* Title & Basic Info Row */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Epic title..."
                  className="w-full bg-transparent font-sans text-2xl font-bold text-slate-100 outline-none placeholder:text-slate-600 tracking-tight"
                  autoFocus
                />
              </div>

              {/* Sector, Status & Time Budget Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sector */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Sector</label>
                  <div className="relative">
                    <select
                      value={sectorId}
                      onChange={e => setSectorId(e.target.value)}
                      className="w-full bg-[#121622] border border-white/[0.10] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 cursor-pointer appearance-none"
                    >
                      <option value="" disabled>Select sector...</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
                
                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Status</label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['active', 'paused', 'blocked', 'parked', 'done'] as const).map(s => {
                      const isSelected = status === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStatusSelect(s)}
                          className={`text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected ? statusStyles[s].active : statusStyles[s].inactive
                          }`}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time Budget */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Planning Horizon</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={budgetValue || ''}
                      onChange={e => setBudgetValue(parseInt(e.target.value, 10) || undefined)}
                      placeholder="e.g. 3"
                      className="w-16 bg-[#121622] border border-white/[0.10] rounded-lg px-2.5 py-2 text-xs text-slate-200 outline-none text-center font-mono"
                    />
                    <select
                      value={budgetUnit}
                      onChange={e => setBudgetUnit(e.target.value as any)}
                      className="flex-1 bg-[#121622] border border-white/[0.10] rounded-lg px-2.5 py-2 text-xs text-slate-200 outline-none font-mono"
                    >
                      <option value="months">months</option>
                      <option value="quarters">quarters</option>
                      <option value="years">years</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  TOP ROW: 2 BOARDS (EXPLORE FINDINGS & NEXT ACTIONS)
                 ───────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* ─── BOARD 1: 🔬 Explore Findings ─── */}
                <div className="bg-[#0d101a] border border-purple-500/20 rounded-xl p-3.5 flex flex-col justify-between space-y-3 min-h-[320px]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-500/15">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span>🔬</span> Explore Topics ({displayExplore.length})
                        </span>
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          {displayExplore.filter(e => e.closed).length}/{displayExplore.length} done
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddExploreForm(prev => !prev)}
                        className="text-xs font-mono text-purple-300 hover:text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {showAddExploreForm ? 'Cancel' : '+ New Topic'}
                      </button>
                    </div>

                    {/* Explore List (Collapsed by Default) */}
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {displayExplore.map(exp => {
                        const isExpanded = expandedExploreIds.has(exp.id)
                        const linkedCount = getLinkedNextCount(exp.id)
                        const canDelete = isNew || existingItem?.status === 'done' || linkedCount === 0
                        const isSpawning = spawningExploreId === exp.id
                        const isStaging = stagingExploreId === exp.id

                        return (
                          <div 
                            key={exp.id}
                            className={`rounded-xl border transition-all ${
                              exp.closed 
                                ? 'bg-white/[0.02] border-white/[0.05] opacity-60' 
                                : 'bg-white/[0.04] border-purple-500/20 hover:border-purple-500/40 shadow-sm'
                            }`}
                          >
                            {/* Collapsed Header */}
                            <div 
                              className="flex items-center justify-between p-2.5 cursor-pointer gap-2"
                              onClick={() => toggleExploreExpanded(exp.id)}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleExploreClosed(exp.id)
                                  }}
                                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 transition-all ${
                                    exp.closed 
                                      ? 'bg-purple-500 border-purple-500 text-slate-900 font-bold' 
                                      : 'border-purple-400/50 hover:border-purple-400 bg-[#0f141f]'
                                  }`}
                                  title={exp.closed ? 'Mark open' : 'Mark closed'}
                                >
                                  {exp.closed && '✓'}
                                </button>

                                <span className="text-slate-400 text-xs shrink-0 select-none">
                                  {isExpanded ? '▾' : '▸'}
                                </span>

                                <span className={`text-xs font-semibold text-slate-200 truncate flex-1 ${exp.closed ? 'line-through text-slate-500' : ''}`}>
                                  {exp.title || exp.notes.split('\n')[0] || 'Explore Finding'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                {exp.time_estimate_value && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                    ⏱ {formatEffortBadge(exp.time_estimate_value, (exp.time_estimate_unit as any) || 'hours')}
                                  </span>
                                )}

                                {linkedCount > 0 && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                    ⚡ {linkedCount}
                                  </span>
                                )}

                                <button
                                  type="button"
                                  disabled={!canDelete}
                                  onClick={() => handleDeleteExplore(exp.id)}
                                  className={`text-xs px-1.5 py-0.5 rounded transition-all ${
                                    canDelete
                                      ? 'text-slate-500 hover:text-red-400 hover:bg-white/[0.06] cursor-pointer'
                                      : 'text-slate-700 opacity-40 cursor-not-allowed'
                                  }`}
                                  title={
                                    !canDelete 
                                      ? `Cannot delete: has ${linkedCount} linked Next item(s) while Epic is not Done` 
                                      : 'Delete explore topic'
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {/* Expanded Content View with Notes & Action Spawn */}
                            {isExpanded && (
                              <div className="px-3 pb-3 pt-1 border-t border-white/[0.04] space-y-2.5 bg-black/20 rounded-b-xl">
                                <div>
                                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Topic Title</label>
                                  <input
                                    type="text"
                                    value={exp.title}
                                    onChange={async (e) => {
                                      const val = e.target.value
                                      if (isNew) setLocalExplore(prev => prev.map(item => item.id === exp.id ? { ...item, title: val } : item))
                                      else await updateExploreItem(exp.id, { title: val })
                                    }}
                                    placeholder="Topic title..."
                                    className="w-full bg-[#090b12] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500/50"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Findings & Notes</label>
                                  <textarea
                                    rows={3}
                                    value={exp.notes}
                                    onChange={async (e) => {
                                      const val = e.target.value
                                      if (isNew) setLocalExplore(prev => prev.map(item => item.id === exp.id ? { ...item, notes: val } : item))
                                      else await updateExploreItem(exp.id, { notes: val })
                                    }}
                                    placeholder="Rich findings, references, observations..."
                                    className="w-full bg-[#090b12] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-purple-500/50 resize-y"
                                  />
                                </div>

                                {/* Phase 3 Generate Next Actions Row */}
                                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    disabled={isGeneratingNext}
                                    onClick={() => handleGenerateNextDrafts(exp)}
                                    className="px-2.5 py-1 bg-gradient-to-r from-purple-500/30 to-amber-500/30 hover:from-purple-500/40 hover:to-amber-500/40 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                                  >
                                    <span>✨</span>
                                    <span>{isGeneratingNext && isStaging ? 'Drafting...' : 'Generate Next Items'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSpawningExploreId(isSpawning ? null : exp.id)
                                      setStagingExploreId(null)
                                    }}
                                    className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors"
                                  >
                                    + Manual Step
                                  </button>
                                </div>

                                {/* Phase 3 AI Staging Drafts Box */}
                                {isStaging && (
                                  <div className="p-3 bg-[#111624] border-2 border-amber-500/50 rounded-xl space-y-2.5 shadow-lg animate-fade-in">
                                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                                      <span className="text-[11px] font-mono text-amber-300 font-bold flex items-center gap-1.5">
                                        <span>⚡</span> Staged Draft Actions ({stagingDrafts.length})
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        Atomic Commit
                                      </span>
                                    </div>

                                    <div className="space-y-2">
                                      {stagingDrafts.map((draft) => (
                                        <div key={draft.id} className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/[0.08]">
                                          <input
                                            type="text"
                                            value={draft.title}
                                            onChange={e => handleUpdateStagedDraft(draft.id, { title: e.target.value })}
                                            placeholder="Action title..."
                                            className="flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-600 font-medium"
                                          />
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={draft.time_estimate_value || ''}
                                            onChange={e => handleUpdateStagedDraft(draft.id, { time_estimate_value: parseFloat(e.target.value) || undefined })}
                                            placeholder="Est."
                                            className="w-14 bg-[#1a1f2e] border border-white/[0.10] rounded px-1.5 py-0.5 text-xs text-slate-200 outline-none font-mono text-center"
                                          />
                                          <select
                                            value={draft.time_estimate_unit}
                                            onChange={e => handleUpdateStagedDraft(draft.id, { time_estimate_unit: e.target.value as any })}
                                            className="bg-[#1a1f2e] border border-white/[0.10] rounded px-1.5 py-0.5 text-xs text-slate-300 outline-none font-mono"
                                          >
                                            <option value="mins">mins</option>
                                            <option value="hours">hours</option>
                                            <option value="days">days</option>
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteStagedDraft(draft.id)}
                                            className="text-slate-500 hover:text-red-400 text-xs px-1"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                      <button
                                        type="button"
                                        onClick={handleAddStagedRow}
                                        className="text-[11px] font-mono text-slate-400 hover:text-slate-200"
                                      >
                                        + Add draft row
                                      </button>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={handleCancelStagedDrafts}
                                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCommitStagedDrafts(exp.id)}
                                          className="px-3.5 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1"
                                        >
                                          <span>✓ Commit All ({stagingDrafts.filter(d => d.title.trim()).length})</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Inline Manual Spawn Next Item Form */}
                                {isSpawning && (
                                  <div className="p-2.5 bg-[#121724] border border-amber-500/40 rounded-xl space-y-2 animate-fade-in">
                                    <span className="text-[10px] font-mono text-amber-300 font-bold block">
                                      New Next Action derived from "{exp.title || 'Topic'}"
                                    </span>
                                    <input
                                      type="text"
                                      value={spawnNextTitle}
                                      onChange={e => setSpawnNextTitle(e.target.value)}
                                      placeholder="Concrete next action step..."
                                      className="w-full bg-black/40 border border-white/[0.10] rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-amber-400"
                                      autoFocus
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={spawnNextEffort || ''}
                                          onChange={e => setSpawnNextEffort(parseFloat(e.target.value) || undefined)}
                                          placeholder="Est."
                                          className="w-14 bg-black/40 border border-white/[0.08] rounded-md px-1.5 py-1 text-xs text-slate-200 outline-none font-mono text-center"
                                        />
                                        <select
                                          value={spawnNextUnit}
                                          onChange={e => setSpawnNextUnit(e.target.value as any)}
                                          className="bg-black/40 border border-white/[0.08] rounded-md px-1.5 py-1 text-xs text-slate-300 outline-none font-mono"
                                        >
                                          <option value="mins">mins</option>
                                          <option value="hours">hours</option>
                                          <option value="days">days</option>
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setSpawningExploreId(null)}
                                          className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!spawnNextTitle.trim()}
                                          onClick={() => handleSpawnFromExplore(exp.id)}
                                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                        >
                                          Spawn
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {displayExplore.length === 0 && !showAddExploreForm && (
                        <div className="text-center py-8 text-slate-500 text-xs font-mono italic">
                          No explore topics yet. Click + New Topic to start research.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Explore Topic Form */}
                  {showAddExploreForm && (
                    <form onSubmit={handleAddExplore} className="p-3 bg-[#090b12] border border-purple-500/30 rounded-xl space-y-2">
                      <input
                        type="text"
                        value={newExploreTitle}
                        onChange={e => setNewExploreTitle(e.target.value)}
                        placeholder="Explore topic title (e.g. Research Dublin visa)..."
                        className="w-full bg-transparent text-xs font-semibold text-slate-200 placeholder:text-slate-500 outline-none border-b border-white/[0.06] pb-1.5"
                        autoFocus
                      />
                      <textarea
                        rows={2}
                        value={newExploreNotes}
                        onChange={e => setNewExploreNotes(e.target.value)}
                        placeholder="Key findings, notes, URLs, or hypotheses..."
                        className="w-full bg-transparent text-xs text-slate-300 placeholder:text-slate-600 outline-none resize-none"
                      />
                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={newExploreEffort || ''}
                            onChange={e => setNewExploreEffort(parseFloat(e.target.value) || undefined)}
                            placeholder="Est."
                            className="w-14 bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-1 text-xs text-slate-200 outline-none font-mono text-center"
                          />
                          <select
                            value={newExploreUnit}
                            onChange={e => setNewExploreUnit(e.target.value as any)}
                            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-1 text-xs text-slate-300 outline-none font-mono"
                          >
                            <option value="mins">mins</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={!newExploreTitle.trim() && !newExploreNotes.trim()}
                          className="px-3 py-1 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-slate-900 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          Save Topic
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* ─── BOARD 2: ⚡ Next Action Items ─── */}
                <div className="bg-[#0a0d14]/90 border border-amber-500/20 rounded-xl p-3.5 flex flex-col justify-between space-y-3 min-h-[320px]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-500/15">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚡</span> Next Actions ({standardNextItems.length})
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {doneNextItems.length}/{displayNext.length} total done
                        </span>
                      </div>
                    </div>

                    {/* Standard Next Actions List */}
                    <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                      {standardNextItems.map(step => {
                        const exploreSourceTitle = getExploreTitle(step.parent_explore_id)

                        return (
                          <div 
                            key={step.id} 
                            className="group flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/30 transition-all gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => handleToggleNext(step.id)}
                                className="w-4 h-4 rounded-full border-2 border-amber-400/70 hover:border-amber-300 hover:bg-amber-400/20 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                                title="Mark step done"
                              />

                              <div className="min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={step.title}
                                  onChange={e => handleUpdateNextTitle(step.id, e.target.value)}
                                  className="w-full bg-transparent text-xs font-medium text-slate-100 outline-none"
                                />
                                {exploreSourceTitle && (
                                  <span className="text-[9px] font-mono text-purple-300 flex items-center gap-1 truncate mt-0.5">
                                    <span>🔬</span> from: {exploreSourceTitle}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {step.time_estimate_value && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                                  ⏱ {formatEffortBadge(step.time_estimate_value, (step.time_estimate_unit as any) || 'hours')}
                                </span>
                              )}

                              {/* Pull to Today Button */}
                              <button
                                type="button"
                                onClick={() => handlePromoteToToday(step.id)}
                                className="px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/25 rounded-md transition-colors cursor-pointer"
                                title="Pull into Today focus"
                              >
                                ⭐ Today
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteNext(step.id)}
                                className="text-slate-500 hover:text-red-400 text-xs px-1 transition-colors cursor-pointer"
                                title="Delete step"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {standardNextItems.length === 0 && (
                        <div className="text-center py-8 text-slate-500 text-xs font-mono italic">
                          No pending next actions. Add below or spawn from research.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* + Add Next Action Input */}
                  <form onSubmit={handleAddNext} className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                    <input
                      type="text"
                      value={newStepText}
                      onChange={e => setNewStepText(e.target.value)}
                      placeholder="+ add next action (press Enter)"
                      className="flex-1 bg-[#121622] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-amber-400"
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newStepEffort || ''}
                      onChange={e => setNewStepEffort(parseFloat(e.target.value) || undefined)}
                      placeholder="Est."
                      className="w-14 bg-[#121622] border border-white/[0.08] rounded-lg px-1.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400 font-mono text-center"
                    />
                    <select
                      value={newStepUnit}
                      onChange={e => setNewStepUnit(e.target.value as any)}
                      className="bg-[#121622] border border-white/[0.08] rounded-lg px-1.5 py-1.5 text-xs text-slate-300 outline-none font-mono cursor-pointer"
                    >
                      <option value="mins">mins</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                    <button
                      type="submit"
                      disabled={!newStepText.trim()}
                      className="text-xs text-amber-400 hover:text-amber-300 font-mono px-3 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      + Add
                    </button>
                  </form>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  BOTTOM ROW: BOARD 3 (TODAY'S FOCUS ITEMS)
                 ───────────────────────────────────────────────────────────── */}
              <div className="bg-[#111624] border border-amber-400/30 rounded-xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-amber-400/15 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span>🎯</span> Today's Focus Items ({todayItems.length} / {settings.today_cap ?? 3})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      High-priority actions committed for today's execution
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {todayItems.map(step => {
                    const exploreSourceTitle = getExploreTitle(step.parent_explore_id)

                    return (
                      <div 
                        key={step.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 hover:border-amber-400 transition-all gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleNext(step.id)}
                            className="w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-400/20 hover:bg-amber-400/40 text-black flex items-center justify-center shrink-0 transition-all cursor-pointer"
                            title="Complete today's task"
                          />

                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-100 block truncate">
                              {step.title}
                            </span>
                            {exploreSourceTitle && (
                              <span className="text-[9px] font-mono text-purple-300 flex items-center gap-1 mt-0.5">
                                <span>🔬</span> from: {exploreSourceTitle}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {step.time_estimate_value && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30">
                              ⏱ {formatEffortBadge(step.time_estimate_value, (step.time_estimate_unit as any) || 'hours')}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDemoteFromToday(step.id)}
                            className="text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-md border border-white/[0.08] transition-colors cursor-pointer"
                            title="Move back to Next action stack"
                          >
                            ↩ Back to Next
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {todayItems.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-xs font-mono italic">
                      No actions pulled into Today yet. Click [⭐ Today] on any Next Action item above.
                    </div>
                  )}
                </div>
              </div>

              {/* Rich Notes Editor & Formatted Preview */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider">
                    Epic Notes & Background
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
                    </div>
                    <textarea
                      ref={notesTextareaRef}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add background, links, context..."
                      rows={4}
                      className="w-full bg-[#0a0d14] border border-white/[0.08] rounded-b-lg p-3 text-xs text-slate-200 outline-none focus:border-blue-500 font-mono leading-relaxed resize-y"
                    />
                  </div>
                ) : (
                  <div className="w-full min-h-[100px] bg-[#0a0d14] border border-white/[0.08] rounded-lg p-4 text-xs text-slate-200 leading-relaxed overflow-y-auto max-h-48">
                    {renderSimpleMarkdown(notes || '*No notes added yet.*')}
                  </div>
                )}
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
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">Activity History</h3>
              {actionLog.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-6 text-center">No history logged yet.</div>
              ) : (
                <div className="space-y-2">
                  {actionLog.map(entry => (
                    <div key={entry.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs flex justify-between items-start">
                      <span className="text-slate-200">{formatActionLogEntry(entry, sectors)}</span>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-4">
                        {new Date(entry.changed_at).toLocaleDateString()} {new Date(entry.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Effort Tab */}
          {activeTab === 'effort' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">Effort Tracking</h3>
                <button
                  type="button"
                  onClick={() => setShowEffortInline(prev => !prev)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                >
                  {showEffortInline ? 'Cancel' : '+ Log Effort'}
                </button>
              </div>

              {showEffortInline && (
                <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                  <EffortPrompt
                    itemId={selectedItemId || ''}
                    onSave={handleEffortSave}
                    onSkip={() => setShowEffortInline(false)}
                  />
                </div>
              )}

              {effortTotals && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                    <span className="text-[10px] font-mono text-slate-400 block">Total Hours</span>
                    <span className="text-xl font-bold text-slate-100 font-mono mt-1 block">
                      {effortTotals.total_hours?.toFixed(1) || '0'} hrs
                    </span>
                  </div>
                  <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                    <span className="text-[10px] font-mono text-slate-400 block">Total Days</span>
                    <span className="text-xl font-bold text-slate-100 font-mono mt-1 block">
                      {effortTotals.entries_days || '0'} days
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                {effortLog.map(e => (
                  <div key={e.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-amber-400 mr-2">+{e.amount} {e.unit}</span>
                      {e.note && <span className="text-slate-300 italic">{e.note}</span>}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(e.logged_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex justify-between items-center bg-black/40">
          <div>
            {!isNew && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Delete this epic?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-2.5 py-1 text-xs bg-red-500 text-white font-semibold rounded hover:bg-red-600 transition-colors"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete Epic
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-slate-900 bg-gradient-to-r from-blue-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 rounded-xl shadow-lg transition-all"
            >
              {isNew ? 'Create Epic' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Active Epic Cap Swap Modal */}
      <ParkSwapModal
        isOpen={showParkSwapModal}
        targetEpicTitle={title || 'This Epic'}
        onConfirmSwap={handleConfirmParkSwap}
        onCancel={() => setShowParkSwapModal(false)}
      />
    </div>
  )
}
