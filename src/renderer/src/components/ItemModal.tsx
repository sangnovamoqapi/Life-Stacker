import React, { useState, useEffect } from 'react'
import { useAppContext } from '../state/AppContext'
import type { Item, ItemStatus, ActionLogEntry, EffortEntry, EffortTotal, TabType, NewItem } from '../types'
import { EffortPrompt } from './EffortPrompt'

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
    settings
  } = useAppContext()

  const existingItem = selectedItemId ? getItemById(selectedItemId) : undefined
  const isNew = !selectedItemId

  const [title, setTitle] = useState(existingItem?.title || '')
  const [sectorId, setSectorId] = useState(existingItem?.sector_id || selectedSectorId || sectors[0]?.id || '')
  const [status, setStatus] = useState<ItemStatus>(existingItem?.status || 'active')
  const [progress, setProgress] = useState(existingItem?.progress || 0)
  const [notes, setNotes] = useState(existingItem?.notes || '')
  const [nextAction, setNextAction] = useState(existingItem?.next_action || '')
  const [isUrgent, setIsUrgent] = useState(false)
  
  const [activeTab, setActiveTab] = useState<TabType>('details')
  
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

  const handleSave = async () => {
    if (!title.trim()) return showToast('Title is required', 'warning')
    if (!sectorId) return showToast('Sector is required', 'warning')

    if (isNew) {
      const newItem = await createItem({ title, sector_id: sectorId, status, progress, notes, next_action: nextAction } as any)
      if (isUrgent) {
        await setUrgent(newItem.id)
      }
      showToast('Item created', 'success')
    } else if (existingItem) {
      const changes: Partial<Omit<Item, 'id' | 'created_at'>> = {}
      if (title !== existingItem.title) changes.title = title
      if (sectorId !== existingItem.sector_id) changes.sector_id = sectorId
      if (status !== existingItem.status) changes.status = status
      if (progress !== existingItem.progress) changes.progress = progress
      if (notes !== existingItem.notes) changes.notes = notes
      if (nextAction !== existingItem.next_action) changes.next_action = nextAction
      
      if (Object.keys(changes).length > 0) {
        await updateItem(existingItem.id, changes)
        showToast('Item updated', 'success')
      }
    }
    closeModal()
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this item?')) {
      if (existingItem) await deleteItem(existingItem.id)
      showToast('Item deleted', 'info')
      closeModal()
    }
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

  return (
    <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="modal-glass w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Tabs */}
        <div className="flex border-b border-border-soft px-4 pt-4 gap-4">
          {(['details', 'history', 'effort'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              disabled={isNew && t !== 'details'}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === t ? 'border-active text-ink' : 'border-transparent text-ink-dim hover:text-ink'
              } ${isNew && t !== 'details' ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              {t}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={closeModal} className="text-ink-dim hover:text-ink pb-3">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full bg-transparent font-serif text-2xl text-ink outline-none placeholder:text-ink-faint"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-ink-dim mb-1">Next Action</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={e => setNextAction(e.target.value)}
                  placeholder="What's the one concrete next step?"
                  className="w-full bg-bg border border-border-soft rounded px-3 py-2 text-sm text-ink outline-none focus:border-ink-dim"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-ink-dim mb-1">Sector</label>
                  <select
                    value={sectorId}
                    onChange={e => setSectorId(e.target.value)}
                    className="w-full bg-bg border border-border-soft rounded px-3 py-2 text-sm text-ink outline-none focus:border-ink-dim"
                  >
                    <option value="" disabled>Select sector...</option>
                    {sectors.map(s => (
                      <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-mono text-ink-dim mb-1">Status</label>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {(['active', 'paused', 'blocked', 'done'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          setStatus(s)
                          if (s === 'done') setProgress(100)
                          if (s !== 'done' && progress === 100) setProgress(95)
                        }}
                        className={`status-pill ${
                          status === s 
                            ? `status-pill-${s}` 
                            : 'status-pill-inactive'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {isNew && (
                    <div className="mt-3">
                      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isUrgent}
                          onChange={e => setIsUrgent(e.target.checked)}
                          className="accent-active"
                        />
                        This is urgent — put it at #1
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {overLimit && (
                <div className="bg-blocked-dim text-ink p-3 rounded text-sm border border-blocked/30">
                  ⚠️ Setting this to Active will exceed your focus limit of {settings.focus_limit}.
                </div>
              )}

              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-xs font-mono text-ink-dim">Progress</label>
                  <span className="text-sm font-mono text-ink">{progress}%</span>
                </div>
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
                  className="w-full accent-ink h-2 bg-border rounded-full appearance-none cursor-ew-resize"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-ink-dim mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Next concrete step, blocker, anything future-you needs..."
                  className="w-full h-32 bg-bg border border-border-soft rounded p-3 text-sm text-ink outline-none focus:border-ink-dim resize-y font-sans"
                />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 relative pl-4 border-l-2 border-border-soft">
              {actionLog.map(entry => (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-border" />
                  <div className="text-sm text-ink mb-0.5">
                    Changed <span className="font-mono text-active">{entry.field}</span>
                    {entry.old_value && <span className="text-ink-dim"> from {entry.old_value}</span>}
                    {entry.new_value && <span> to {entry.new_value}</span>}
                  </div>
                  <div className="text-xs font-mono text-ink-faint">
                    {new Date(entry.changed_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {actionLog.length === 0 && (
                <div className="text-ink-dim text-sm italic">No history available.</div>
              )}
            </div>
          )}

          {activeTab === 'effort' && (
            <div className="space-y-6">
              {effortTotals && (
                <div className="bg-bg p-4 rounded border border-border-soft flex items-center justify-between">
                  <span className="text-sm font-mono text-ink-dim">Total Effort</span>
                  <span className="font-serif text-lg text-ink">
                    {effortTotals.entries_hours}h {effortTotals.entries_days > 0 ? `, ${effortTotals.entries_days}d` : ''}
                  </span>
                </div>
              )}
              
              {!showEffortInline ? (
                <button 
                  onClick={() => setShowEffortInline(true)}
                  className="w-full py-2 border border-dashed border-border text-ink-dim text-sm rounded hover:border-ink hover:text-ink transition-colors"
                >
                  + Log effort
                </button>
              ) : (
                <EffortPrompt 
                  itemId={selectedItemId!} 
                  onSave={handleEffortSave} 
                  onSkip={() => setShowEffortInline(false)} 
                />
              )}

              <div className="space-y-3">
                {effortLog.map(entry => (
                  <div key={entry.id} className="flex justify-between items-center py-2 border-b border-border-soft last:border-0">
                    <div>
                      <div className="text-sm text-ink">{entry.note || 'Logged effort'}</div>
                      <div className="text-xs font-mono text-ink-faint">{new Date(entry.logged_at).toLocaleString()}</div>
                    </div>
                    <div className="font-mono text-active text-sm">
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
          <div className="p-4 border-t flex justify-between items-center rounded-b-xl" style={{ borderColor: 'var(--glass-border)' }}>
            {!isNew ? (
              <button 
                onClick={handleDelete}
                className="text-blocked text-sm px-4 py-1.5 rounded hover:bg-blocked-dim transition-colors"
              >
                Delete
              </button>
            ) : <div/>}
            
            <div className="flex gap-2">
              <button onClick={closeModal} className="text-ink-dim hover:text-ink px-4 py-1.5 text-sm transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="bg-active hover:bg-yellow-500 text-bg font-medium px-6 py-1.5 rounded text-sm transition-colors"
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
