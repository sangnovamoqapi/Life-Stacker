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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleSkip}
    >
      <div 
        className="bg-[#121622] border border-white/[0.12] w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-lg">✓</span>
            <h3 className="font-sans text-base font-bold text-slate-100">Step Completed</h3>
          </div>
          <button onClick={handleSkip} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>

        {/* Completed Step Details */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">{item?.title || 'Task'}</div>
          <div className="text-sm text-slate-200 font-medium">{checklistItem.text}</div>
          {checklistItem.effortValue && (
            <div className="text-xs text-blue-400 font-mono">
              Estimated: {checklistItem.effortValue} {checklistItem.effortUnit || 'hours'}
            </div>
          )}
        </div>

        {/* Effort input */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-slate-300">
            Log time spent on this step:
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-[#0a0d14] border border-white/[0.10] rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500 font-mono"
              autoFocus
            />
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as 'hours' | 'days')}
              className="bg-[#0a0d14] border border-white/[0.10] rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500 font-mono cursor-pointer"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>

        {/* Note input */}
        <div className="space-y-1">
          <label className="block text-xs font-mono text-slate-400">Note (optional):</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add note for effort log..."
            className="w-full bg-[#0a0d14] border border-white/[0.10] rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/[0.06]">
          <button
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg transition-colors"
          >
            Skip Logging
          </button>
          <button
            onClick={handleSaveEffort}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-md"
          >
            Log Effort & Save
          </button>
        </div>
      </div>
    </div>
  )
}
