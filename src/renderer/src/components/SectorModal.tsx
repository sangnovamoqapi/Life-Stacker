import React, { useState } from 'react'
import { useAppContext } from '../state/AppContext'

const swatches = Array.from({length: 8}).map((_, i) => `sector-${i}`)
const emojiPresets = ['💼', '🎓', '💚', '🚀', '👥', '🏠', '⚡', '🎯', '📚', '💡', '💰', '🎨', '🛠️', '⭐', '🔥', '🧘']

export const SectorModal: React.FC = () => {
  const { selectedSectorId, closeModal, getSectorById, createSector, updateSector, deleteSector, sectors, showToast } = useAppContext()
  
  const existingSector = selectedSectorId ? getSectorById(selectedSectorId) : undefined
  const isNew = !selectedSectorId

  const [name, setName] = useState(existingSector?.name || '')
  const [icon, setIcon] = useState(existingSector?.icon || '💼')
  const [color, setColor] = useState(existingSector?.color || 'sector-0')
  const [notifEnabled, setNotifEnabled] = useState(!!existingSector?.notif_enabled)
  const [notifCadence, setNotifCadence] = useState(existingSector?.notif_cadence || 'daily')
  const [notifIntervalDays, setNotifIntervalDays] = useState(existingSector?.notif_interval_days || 2)
  
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    if (existingSector?.notif_weekdays) {
      try { return JSON.parse(existingSector.notif_weekdays) } catch { return [] }
    }
    return []
  })
  const [notifTime, setNotifTime] = useState(existingSector?.notif_time || '09:00')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [moveToSector, setMoveToSector] = useState<string>('')

  const handleSave = async () => {
    if (!name.trim()) return showToast('Name is required', 'warning')
    
    const data = {
      name: name.trim(),
      icon: icon.trim() || null,
      color,
      notif_enabled: notifEnabled ? 1 : 0,
      notif_cadence: notifCadence,
      notif_interval_days: notifCadence === 'every_n_days' ? notifIntervalDays : null,
      notif_weekdays: notifCadence === 'weekdays' ? JSON.stringify(weekdays) : null,
      notif_time: notifTime
    }

    if (isNew) {
      await createSector(data)
      showToast('Sector created', 'success')
    } else if (existingSector) {
      await updateSector(existingSector.id, data)
      showToast('Sector updated', 'success')
    }
    closeModal()
  }

  const handleDelete = async () => {
    if (!existingSector) return
    if (!moveToSector) return showToast('Please select a destination sector', 'warning')
    await deleteSector(existingSector.id, moveToSector)
    showToast('Sector deleted', 'info')
    closeModal()
  }

  const toggleWeekday = (day: number) => {
    setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  if (showDeleteConfirm) {
    const otherSectors = sectors.filter(s => s.id !== existingSector?.id)
    return (
      <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-bg-raised border border-border w-full max-w-md rounded-xl p-6 shadow-2xl flex flex-col gap-4">
          <h2 className="font-serif text-xl text-blocked">Delete Sector</h2>
          <p className="text-sm text-ink-dim">
            What should we do with the items in <strong>{existingSector?.name}</strong>?
          </p>
          <select
            value={moveToSector}
            onChange={e => setMoveToSector(e.target.value)}
            className="w-full bg-bg border border-border-soft rounded px-3 py-2 text-sm text-ink outline-none focus:border-ink-dim"
          >
            <option value="" disabled>Move items to...</option>
            {otherSectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-1.5 text-sm text-ink-dim hover:text-ink">Cancel</button>
            <button onClick={handleDelete} className="bg-blocked text-white px-4 py-1.5 rounded text-sm hover:bg-red-600 transition-colors">
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-raised border border-border w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border-soft flex justify-between items-center">
          <h2 className="font-serif text-xl text-ink">{isNew ? 'New Sector' : 'Edit Sector'}</h2>
          <button onClick={closeModal} className="text-ink-dim hover:text-ink">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Emoji & Name row */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Category Icon & Name</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                maxLength={4}
                className="w-14 text-center text-xl bg-[#121622] border border-white/[0.10] rounded-lg px-2 py-1.5 text-slate-100 outline-none focus:border-blue-500"
                title="Category Emoji"
              />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Career, Health, Learning..."
                className="flex-1 bg-[#121622] border border-white/[0.10] rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Quick Emoji Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {emojiPresets.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setIcon(preset)}
                  className={`w-7 h-7 text-sm rounded flex items-center justify-center transition-all ${
                    icon === preset 
                      ? 'bg-blue-600/30 border border-blue-500 scale-110' 
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-ink-dim mb-2">Color</label>
            <div className="flex gap-2">
              {swatches.map(swatch => (
                <button
                  key={swatch}
                  onClick={() => setColor(swatch)}
                  className={`w-8 h-8 rounded-full transition-transform ${color === swatch ? 'scale-110 ring-2 ring-active ring-offset-2 ring-offset-bg-raised' : 'hover:scale-105'}`}
                  style={{ backgroundColor: `var(--color-${swatch})` }}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border-soft pt-4">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer mb-4">
              <input 
                type="checkbox" 
                checked={notifEnabled} 
                onChange={e => setNotifEnabled(e.target.checked)}
                className="accent-active"
              />
              Enable Notifications
            </label>

            {notifEnabled && (
              <div className="space-y-4 pl-6 border-l-2 border-border-soft">
                <div>
                  <label className="block text-xs font-mono text-ink-dim mb-1">Cadence</label>
                  <select
                    value={notifCadence}
                    onChange={e => setNotifCadence(e.target.value as any)}
                    className="w-full bg-bg border border-border-soft rounded px-3 py-1.5 text-sm text-ink outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="every_n_days">Every N Days</option>
                    <option value="weekdays">Specific Weekdays</option>
                  </select>
                </div>

                {notifCadence === 'every_n_days' && (
                  <div>
                    <label className="block text-xs font-mono text-ink-dim mb-1">Interval (days)</label>
                    <input
                      type="number"
                      min="2"
                      value={notifIntervalDays}
                      onChange={e => setNotifIntervalDays(parseInt(e.target.value, 10))}
                      className="w-full bg-bg border border-border-soft rounded px-3 py-1.5 text-sm text-ink outline-none"
                    />
                  </div>
                )}

                {notifCadence === 'weekdays' && (
                  <div>
                    <label className="block text-xs font-mono text-ink-dim mb-1">Days</label>
                    <div className="flex gap-1">
                      {['S','M','T','W','T','F','S'].map((d, i) => (
                        <button
                          key={i}
                          onClick={() => toggleWeekday(i)}
                          className={`w-8 h-8 rounded text-sm transition-colors ${weekdays.includes(i) ? 'bg-active text-bg' : 'bg-bg text-ink-dim border border-border-soft hover:border-ink'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-ink-dim mb-1">Time</label>
                  <input
                    type="time"
                    value={notifTime}
                    onChange={e => setNotifTime(e.target.value)}
                    className="w-full bg-bg border border-border-soft rounded px-3 py-1.5 text-sm text-ink outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border-soft flex justify-between items-center bg-bg rounded-b-xl">
          {!isNew ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
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
      </div>
    </div>
  )
}
