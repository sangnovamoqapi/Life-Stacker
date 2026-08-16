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
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        
        {/* General Settings Glass Card */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-sans text-xl font-bold text-slate-100 border-b border-white/[0.08] pb-3">
            General
          </h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                Focus Limit
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="1" 
                  value={settings.focus_limit}
                  onChange={e => updateSettings('focus_limit', parseInt(e.target.value, 10))}
                  className="bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 w-24 text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">Max active items before warnings</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                Stale Threshold (Days)
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="1" 
                  value={settings.stale_threshold_days}
                  onChange={e => updateSettings('stale_threshold_days', parseInt(e.target.value, 10))}
                  className="bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 w-24 text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">Days before active/paused items show stale warning</span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer pt-2">
              <input 
                type="checkbox" 
                checked={settings.launch_at_login}
                onChange={e => {
                  updateSettings('launch_at_login', e.target.checked)
                  window.api.app.setLoginItem(e.target.checked)
                }}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
              <span>Launch at login</span>
            </label>
          </div>
        </section>

        {/* Appearance Glass Card (Live Preview) */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-sans text-xl font-bold text-slate-100 border-b border-white/[0.08] pb-3">
            Appearance
          </h2>
          <div className="space-y-5 max-w-lg">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-2 uppercase tracking-wider">
                Background Media
              </label>
              
              {/* Background Status & Preview Card */}
              <div className="mb-3 p-3 rounded-xl bg-black/30 border border-white/[0.08] flex items-center gap-4">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/50 border border-white/[0.10] shrink-0 flex items-center justify-center">
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
                  <div className="text-xs font-semibold text-slate-100 truncate capitalize">
                    {settings.background_config?.type === 'image' && 'Custom Image'}
                    {settings.background_config?.type === 'video' && 'Custom Video'}
                    {(!settings.background_config?.type || settings.background_config?.type === 'gradient' || settings.background_config?.type === 'color') && 'Default Atmospheric Gradient'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
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
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-md"
                >
                  Choose File...
                </button>
                <button 
                  onClick={async () => {
                    await updateSettings('background_config', { type: 'gradient', value: 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' })
                    showToast('Background reset to default gradient', 'info')
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg transition-colors"
                >
                  Reset Default
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Images (PNG, JPG, WebP) and videos (MP4, WebM) are supported.
              </p>
            </div>
            
            {/* Glass Intensity Live Slider (Amendment 6) */}
            <div className="pt-3 border-t border-white/[0.08] space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-mono text-slate-200 font-semibold uppercase tracking-wider">
                  Glass Intensity
                </label>
                <span className="text-xs font-mono text-blue-400 font-bold px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30">
                  {settings.glass_intensity ?? 65}%
                </span>
              </div>
              <div className="space-y-1">
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.glass_intensity ?? 65}
                  onChange={e => updateSettings('glass_intensity', parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer h-2 bg-white/[0.08] rounded-full"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Solid (Opaque)</span>
                  <span>Frosted (Translucent)</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Controls the linked opacity and background blur depth across all cards, modals, and panels in real-time.
              </p>
            </div>
          </div>
        </section>

        {/* Sectors Glass Card */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
            <h2 className="font-sans text-xl font-bold text-slate-100">Sectors</h2>
            <button 
              onClick={() => openSectorModal(null)} 
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg transition-colors shadow"
            >
              + New Sector
            </button>
          </div>
          
          <div className="bg-black/30 border border-white/[0.08] rounded-xl overflow-hidden divide-y divide-white/[0.05]">
            {sectors.map((sector, idx) => (
              <div key={sector.id} className="flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSector(idx, 'up')} disabled={idx === 0} className="text-slate-500 hover:text-slate-200 disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => moveSector(idx, 'down')} disabled={idx === sectors.length - 1} className="text-slate-500 hover:text-slate-200 disabled:opacity-20 text-xs leading-none">▼</button>
                  </div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${sector.color})` }} />
                  {sector.icon && <span className="text-base select-none">{sector.icon}</span>}
                  <span className="font-medium text-slate-100 text-sm">{sector.name}</span>
                </div>
                <button 
                  onClick={() => openSectorModal(sector.id)}
                  className="text-xs text-slate-400 hover:text-blue-400 px-2.5 py-1 rounded hover:bg-white/[0.04] transition-colors"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Notifications Glass Card */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-sans text-xl font-bold text-slate-100 border-b border-white/[0.08] pb-3">
            Notifications
          </h2>
          <div className="bg-black/30 border border-white/[0.08] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-xs text-slate-400 uppercase font-mono">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Sector</th>
                  <th className="px-4 py-2.5 font-normal">Enabled</th>
                  <th className="px-4 py-2.5 font-normal">Cadence</th>
                  <th className="px-4 py-2.5 font-normal">Time</th>
                  <th className="px-4 py-2.5 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sectors.map(sector => (
                  <tr key={sector.id} className="text-slate-200 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-${sector.color})` }} />
                      <span className="font-medium">{sector.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {sector.notif_enabled ? <span className="text-emerald-400 font-mono text-xs">On</span> : <span className="text-slate-500 font-mono text-xs">Off</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {sector.notif_cadence.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{sector.notif_time}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => testNotif(sector.id)} className="text-xs bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 px-2.5 py-1 rounded-lg transition-colors">
                        Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Weekly Stack Review Glass Card */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-sans text-xl font-bold text-slate-100 border-b border-white/[0.08] pb-3">
            Weekly Stack Review
          </h2>
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.stack_review_enabled}
                onChange={e => updateSettings('stack_review_enabled', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
              <span>Enable weekly review notification</span>
            </label>

            {settings.stack_review_enabled && (
              <div className="space-y-3 pl-6 border-l-2 border-white/[0.10]">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Day</label>
                  <select
                    value={settings.stack_review_day}
                    onChange={e => updateSettings('stack_review_day', parseInt(e.target.value, 10))}
                    className="bg-[#121622] border border-white/[0.10] rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={settings.stack_review_time}
                    onChange={e => updateSettings('stack_review_time', e.target.value)}
                    className="bg-[#121622] border border-white/[0.10] rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Fires a notification highlighting the item across your entire stack that hasn't been touched the longest.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Data Management Glass Card */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-sans text-xl font-bold text-slate-100 border-b border-white/[0.08] pb-3">
            Data
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-sm text-slate-200 px-4 py-2 rounded-xl transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export Snapshot'}
            </button>
            <button 
              onClick={() => {
                if (confirm('Are you absolutely sure you want to reset all data? This cannot be undone.')) {
                  showToast('Reset not yet implemented', 'info')
                }
              }}
              className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-sm px-4 py-2 rounded-xl transition-colors"
            >
              Reset All Data
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
