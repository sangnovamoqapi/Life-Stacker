import React, { useState } from 'react'
import { useAppContext } from '../state/AppContext'

export const ChecklistEffortModal: React.FC = () => {
  const { checklistEffortPrompt, setChecklistEffortPrompt, addEffort, getItemById, showToast } = useAppContext()
  
  if (!checklistEffortPrompt) return null

  const { itemId, checklistItem } = checklistEffortPrompt
  const item = getItemById(itemId)

  // Default effort from estimated if provided, or default to 1 hour
  const defaultAmount = checklistItem.effortValue ?? 1
  const defaultUnit = (checklistItem.effortUnit === 'mins' ? 'hours' : checklistItem.effortUnit) || 'hours'

  const [amount, setAmount] = useState<number>(defaultAmount)
  const [unit, setUnit] = useState<'hours' | 'days'>(defaultUnit === 'days' ? 'days' : 'hours')
  const [note, setNote] = useState<string>(`Completed: ${checklistItem.text}`)

  const handleSaveEffort = async () => {
    if (amount > 0) {
      await addEffort(itemId, amount, unit, note)
      showToast(`Logged ${amount} ${unit} for '${checklistItem.text}'`, 'success')
    }
    setChecklistEffortPrompt(null)
  }

  const handleSkip = () => {
    setChecklistEffortPrompt(null)
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleSkip}
    >
      <div 
        className="bg-surface-modal border border-border-subtle w-full max-w-md rounded-2xl shadow-modal p-6 flex flex-col space-y-4 text-text-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <span className="text-done text-lg">✓</span>
            <h3 className="font-sans text-base font-bold text-text-primary">Step Completed</h3>
          </div>
          <button onClick={handleSkip} className="text-text-muted hover:text-text-primary text-sm">✕</button>
        </div>

        {/* Completed Step Details */}
        <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3 space-y-1">
          <div className="text-xs text-text-muted font-mono uppercase tracking-wider">{item?.title || 'Task'}</div>
          <div className="text-sm text-text-primary font-medium">{checklistItem.text}</div>
          {checklistItem.effortValue && (
            <div className="text-xs text-accent font-mono">
              Estimated: {checklistItem.effortValue} {checklistItem.effortUnit || 'hours'}
            </div>
          )}
        </div>

        {/* Effort input */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-text-secondary">
            Log time spent on this step:
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-surface-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent font-mono"
              autoFocus
            />
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as 'hours' | 'days')}
              className="bg-surface-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent font-mono cursor-pointer"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>

        {/* Note input */}
        <div className="space-y-1">
          <label className="block text-xs font-mono text-text-muted">Note (optional):</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add note for effort log..."
            className="w-full bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end items-center gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSaveEffort}
            className="bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-all shadow-soft"
          >
            Save Effort
          </button>
        </div>
      </div>
    </div>
  )
}
