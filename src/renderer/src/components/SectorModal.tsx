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
      if (Array.isArray(existingSector.notif_weekdays)) return existingSector.notif_weekdays
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
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-modal border border-border-subtle w-full max-w-md rounded-2xl p-6 shadow-modal flex flex-col gap-4 text-text-primary">
          <h2 className="font-sans font-bold text-xl text-blocked">Delete Sector</h2>
          <p className="text-sm text-text-secondary">
            What should we do with the items in <strong>{existingSector?.name}</strong>?
          </p>
          <select
            value={moveToSector}
            onChange={e => setMoveToSector(e.target.value)}
            className="w-full bg-surface-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="" disabled>Move items to...</option>
            {otherSectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-1.5 text-sm text-text-muted hover:text-text-primary">Cancel</button>
            <button onClick={handleDelete} className="bg-blocked text-white px-4 py-1.5 rounded-lg text-sm hover:opacity-90 transition-opacity">
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-modal border border-border-subtle w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[90vh] text-text-primary overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-surface-subtle">
          <h2 className="font-sans font-bold text-lg text-text-primary">{isNew ? 'New Sector' : 'Edit Sector'}</h2>
          <button onClick={closeModal} className="text-text-muted hover:text-text-primary text-base">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Emoji & Name row */}
          <div>
            <label className="block text-xs font-mono text-text-muted mb-1">Category Icon & Name</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                maxLength={4}
                className="w-14 text-center text-xl bg-surface-input border border-border-subtle rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-accent"
                title="Category Emoji"
              />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Career, Health, Learning..."
                className="flex-1 bg-surface-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
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
                  className={`w-7 h-7 text-sm rounded-lg flex items-center justify-center transition-all ${
                    icon === preset 
                      ? 'bg-accent/20 border border-accent scale-105' 
                      : 'bg-surface-subtle hover:bg-surface-raised border border-border-subtle'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-text-muted mb-2">Color</label>
            <div className="flex gap-2">
              {swatches.map(swatch => (
                <button
                  key={swatch}
                  onClick={() => setColor(swatch)}
                  className={`w-8 h-8 rounded-full transition-transform ${color === swatch ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-surface-modal' : 'hover:scale-105'}`}
                  style={{ backgroundColor: `var(--color-${swatch})` }}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer mb-4">
              <input 
                type="checkbox" 
                checked={notifEnabled} 
                onChange={e => setNotifEnabled(e.target.checked)}
                className="accent-accent"
              />
              Enable Notifications
            </label>

            {notifEnabled && (
              <div className="space-y-4 pl-6 border-l-2 border-border-subtle">
                <div>
                  <label className="block text-xs font-mono text-text-muted mb-1">Cadence</label>
                  <select
                    value={notifCadence}
                    onChange={e => setNotifCadence(e.target.value as any)}
                    className="w-full bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="every_n_days">Every N Days</option>
                    <option value="weekdays">Specific Weekdays</option>
                  </select>
                </div>

                {notifCadence === 'every_n_days' && (
                  <div>
                    <label className="block text-xs font-mono text-text-muted mb-1">Interval (days)</label>
                    <input
                      type="number"
                      min="2"
                      value={notifIntervalDays}
                      onChange={e => setNotifIntervalDays(parseInt(e.target.value, 10))}
                      className="w-full bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                    />
                  </div>
                )}

                {notifCadence === 'weekdays' && (
                  <div>
                    <label className="block text-xs font-mono text-text-muted mb-1">Days</label>
                    <div className="flex gap-1">
                      {['S','M','T','W','T','F','S'].map((d, i) => (
                        <button
                          key={i}
                          onClick={() => toggleWeekday(i)}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${weekdays.includes(i) ? 'bg-accent text-white' : 'bg-surface-subtle text-text-muted border border-border-subtle hover:border-border-strong'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-text-muted mb-1">Time</label>
                  <input
                    type="time"
                    value={notifTime}
                    onChange={e => setNotifTime(e.target.value)}
                    className="w-full bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle flex justify-between items-center bg-surface-raised">
          {!isNew ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="text-blocked text-sm px-4 py-1.5 rounded-lg hover:bg-blocked-dim transition-colors font-medium"
            >
              Delete
            </button>
          ) : <div/>}
          
          <div className="flex gap-2">
            <button onClick={closeModal} className="text-text-muted hover:text-text-primary px-4 py-1.5 text-sm transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-1.5 rounded-lg text-sm shadow-soft transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
