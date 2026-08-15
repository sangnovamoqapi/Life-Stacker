import React, { useState } from 'react'
import { useAppContext } from '../state/AppContext'

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, sectors, reorderSectors, openSectorModal, showToast } = useAppContext()
  const [exporting, setExporting] = useState(false)

  const moveSector = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === sectors.length - 1) return
    
    const newOrder = [...sectors]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newOrder[index]
    newOrder[index] = newOrder[targetIndex]
    newOrder[targetIndex] = temp
    
    reorderSectors(newOrder.map(s => s.id))
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await window.api.data.exportSnapshot()
      if (res) showToast('Data exported successfully', 'success')
    } catch (e) {
      showToast('Export failed', 'warning')
    } finally {
      setExporting(false)
    }
  }

  const testNotif = async (sectorId: string) => {
    try {
      await window.api.notifications.test(sectorId)
    } catch (e) {
      showToast('Failed to test notification', 'warning')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-12 pb-20">
        
        <section>
          <h2 className="font-serif text-2xl text-ink mb-6 border-b border-border-soft pb-2">General</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-ink mb-1">Focus Limit</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  min="1" 
                  value={settings.focus_limit}
                  onChange={e => updateSettings('focus_limit', parseInt(e.target.value, 10))}
                  className="bg-bg-raised border border-border-soft rounded px-3 py-1.5 w-24 text-ink outline-none focus:border-ink-dim"
                />
                <span className="text-xs text-ink-dim">Max active items before warnings</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-ink mb-1">Stale Threshold (Days)</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  min="1" 
                  value={settings.stale_threshold_days}
                  onChange={e => updateSettings('stale_threshold_days', parseInt(e.target.value, 10))}
                  className="bg-bg-raised border border-border-soft rounded px-3 py-1.5 w-24 text-ink outline-none focus:border-ink-dim"
                />
                <span className="text-xs text-ink-dim">Days before active/paused items show stale warning</span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer pt-2">
              <input 
                type="checkbox" 
                checked={settings.launch_at_login}
                onChange={e => {
                  updateSettings('launch_at_login', e.target.checked)
                  window.api.app.setLoginItem(e.target.checked)
                }}
                className="accent-active"
              />
              Launch at login
            </label>

          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-ink mb-6 border-b border-border-soft pb-2">Appearance</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-ink mb-2">Background Media</label>
              
              {/* Background Status & Preview Card */}
              <div className="mb-3 p-3 rounded-lg bg-bg-raised/80 border border-border flex items-center gap-4">
                <div className="w-16 h-12 rounded overflow-hidden bg-black/40 border border-border-soft shrink-0 flex items-center justify-center">
                  {settings.background_config?.type === 'image' ? (
                    <img 
                      src={`media://${encodeURIComponent(settings.background_config.value)}`} 
                      alt="Background Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : settings.background_config?.type === 'video' ? (
                    <video 
                      src={`media://${encodeURIComponent(settings.background_config.value)}`} 
                      muted 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full" 
                      style={{ background: settings.background_config?.value || 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), #0b0b0d' }} 
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-ink truncate capitalize">
                    {settings.background_config?.type === 'image' && 'Custom Image'}
                    {settings.background_config?.type === 'video' && 'Custom Video'}
                    {(!settings.background_config?.type || settings.background_config?.type === 'gradient' || settings.background_config?.type === 'color') && 'Default Atmospheric Gradient'}
                  </div>
                  <div className="text-[11px] text-ink-faint truncate">
                    {settings.background_config?.type === 'image' || settings.background_config?.type === 'video' 
                      ? settings.background_config.value.split(/[\\/]/).pop() 
                      : 'Built-in dark theme styling'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <button 
                  onClick={async () => {
                    const res = await window.api.app.pickBackground()
                    if (res) {
                      await updateSettings('background_config', res)
                      showToast(`Background set to ${res.type}!`, 'success')
                    }
                  }}
                  className="bg-bg-raised border border-border text-sm px-4 py-2 rounded hover:border-ink hover:text-active transition-colors"
                >
                  Choose File...
                </button>
                <button 
                  onClick={async () => {
                    await updateSettings('background_config', { type: 'gradient', value: 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' })
                    showToast('Background reset to default gradient', 'info')
                  }}
                  className="text-sm text-ink-dim hover:text-ink px-2 py-1 transition-colors"
                >
                  Reset Default
                </button>
              </div>
              <p className="text-xs text-ink-faint mt-2">
                Images (PNG, JPG, WebP) and videos (MP4, WebM) of any size or resolution are supported.
              </p>
            </div>
            
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer pt-2">
              <input 
                type="checkbox" 
                checked={settings.reduce_transparency}
                onChange={e => updateSettings('reduce_transparency', e.target.checked)}
                className="accent-active"
              />
              Reduce transparency
              <span className="text-xs text-ink-faint ml-1">(disables backdrop blur, pauses video)</span>
            </label>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-6 border-b border-border-soft pb-2">
            <h2 className="font-serif text-2xl text-ink">Sectors</h2>
            <button onClick={() => openSectorModal(null)} className="text-sm bg-bg-raised border border-border px-3 py-1 rounded hover:text-active transition-colors">
              + New Sector
            </button>
          </div>
          
          <div className="bg-bg-raised border border-border rounded-lg overflow-hidden">
            {sectors.map((sector, idx) => (
              <div key={sector.id} className="flex items-center justify-between p-3 border-b border-border-soft last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSector(idx, 'up')} disabled={idx === 0} className="text-ink-faint hover:text-ink disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => moveSector(idx, 'down')} disabled={idx === sectors.length - 1} className="text-ink-faint hover:text-ink disabled:opacity-20 text-xs leading-none">▼</button>
                  </div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${sector.color})` }} />
                  {sector.icon && <span className="text-base select-none">{sector.icon}</span>}
                  <span className="font-medium text-slate-100">{sector.name}</span>
                </div>
                <button 
                  onClick={() => openSectorModal(sector.id)}
                  className="text-xs text-ink-dim hover:text-ink px-2 py-1"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-ink mb-6 border-b border-border-soft pb-2">Notifications</h2>
          <div className="bg-bg-raised border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg border-b border-border-soft text-xs text-ink-dim uppercase font-mono">
                <tr>
                  <th className="px-4 py-2 font-normal">Sector</th>
                  <th className="px-4 py-2 font-normal">Enabled</th>
                  <th className="px-4 py-2 font-normal">Cadence</th>
                  <th className="px-4 py-2 font-normal">Time</th>
                  <th className="px-4 py-2 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {sectors.map(sector => (
                  <tr key={sector.id} className="text-ink">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-${sector.color})` }} />
                      {sector.name}
                    </td>
                    <td className="px-4 py-3">
                      {sector.notif_enabled ? <span className="text-done">On</span> : <span className="text-ink-faint">Off</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {sector.notif_cadence.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{sector.notif_time}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => testNotif(sector.id)} className="text-xs bg-bg border border-border px-2 py-1 rounded hover:border-ink-dim transition-colors">
                        Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-ink mb-6 border-b border-border-soft pb-2">Weekly Stack Review</h2>
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.stack_review_enabled}
                onChange={e => updateSettings('stack_review_enabled', e.target.checked)}
                className="accent-active"
              />
              Enable weekly review notification
            </label>

            {settings.stack_review_enabled && (
              <div className="space-y-3 pl-6 border-l-2 border-border-soft">
                <div>
                  <label className="block text-sm text-ink mb-1">Day</label>
                  <select
                    value={settings.stack_review_day}
                    onChange={e => updateSettings('stack_review_day', parseInt(e.target.value, 10))}
                    className="bg-bg-raised border border-border-soft rounded px-3 py-1.5 text-sm text-ink outline-none"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-ink mb-1">Time</label>
                  <input
                    type="time"
                    value={settings.stack_review_time}
                    onChange={e => updateSettings('stack_review_time', e.target.value)}
                    className="bg-bg-raised border border-border-soft rounded px-3 py-1.5 text-sm text-ink outline-none"
                  />
                </div>
                <p className="text-xs text-ink-faint">
                  Fires a notification highlighting the item across your entire stack that hasn't been touched the longest.
                </p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-ink mb-6 border-b border-border-soft pb-2">Data</h2>
          <div className="flex gap-4">
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="bg-bg-raised border border-border text-sm px-4 py-2 rounded hover:border-ink transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export Snapshot'}
            </button>
            <button 
              onClick={() => {
                if (confirm('Are you absolutely sure you want to reset all data? This cannot be undone.')) {
                  showToast('Reset not yet implemented', 'info')
                }
              }}
              className="bg-blocked-dim text-blocked border border-blocked/30 text-sm px-4 py-2 rounded hover:bg-blocked hover:text-white transition-colors"
            >
              Reset All Data
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
