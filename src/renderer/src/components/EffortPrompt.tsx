import React, { useState } from 'react'

interface EffortPromptProps {
  itemId: string
  onSave: (amount: number, unit: 'hours' | 'days', note?: string) => Promise<void>
  onSkip?: () => void
}

export const EffortPrompt: React.FC<EffortPromptProps> = ({ itemId, onSave, onSkip }) => {
  const [amount, setAmount] = useState<number | ''>('')
  const [unit, setUnit] = useState<'hours' | 'days'>('hours')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || typeof amount !== 'number') return
    setLoading(true)
    try {
      await onSave(amount, unit, note || undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-raised border border-border p-3 rounded-lg shadow-lg w-full max-w-sm flex flex-col gap-3 z-50">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={e => setAmount(parseFloat(e.target.value) || '')}
          placeholder="0.0"
          className="bg-bg border border-border-soft rounded px-2 py-1 w-20 text-sm outline-none focus:border-ink-dim"
          autoFocus
          required
        />
        <div className="flex bg-bg border border-border-soft rounded overflow-hidden">
          {(['hours', 'days'] as const).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-3 py-1 text-xs transition-colors ${unit === u ? 'bg-border text-ink' : 'text-ink-dim hover:text-ink hover:bg-border-soft'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="What did you do? (optional)"
        className="bg-bg border border-border-soft rounded px-3 py-1.5 text-sm w-full outline-none focus:border-ink-dim"
      />
      
      <div className="flex justify-end gap-2 mt-1">
        {onSkip && (
          <button type="button" onClick={onSkip} className="px-3 py-1 text-sm text-ink-dim hover:text-ink transition-colors">
            Skip
          </button>
        )}
        <button 
          type="submit"
          disabled={!amount || loading}
          className="px-4 py-1 text-sm bg-active text-bg rounded hover:bg-yellow-500 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Log Effort'}
        </button>
      </div>
    </form>
  )
}
