import React, { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../state/AppContext'

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    sectors, 
    reorderSectors, 
    openSectorModal, 
    showToast, 
    openHelpModal, 
    startTour,
    themeMode,
    setThemeMode
  } = useAppContext()
  const [exporting, setExporting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null)
  const [ollamaError, setOllamaError] = useState<string | null>(null)
  const [installedModels, setInstalledModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [customModelTag, setCustomModelTag] = useState('')
  const [isCustomModel, setIsCustomModel] = useState(false)
  const previewCameraRef = useRef<HTMLVideoElement>(null)

  const fetchOllamaInfo = async () => {
    setIsLoadingModels(true)
    try {
      const [status, err, models] = await Promise.all([
        window.api.ai.checkStatus(),
        window.api.ai.getLastError(),
        window.api.ai.listModels()
      ])
      setOllamaStatus(status)
      setOllamaError(err)
      setInstalledModels(models)
    } catch (e: any) {
      setOllamaStatus(false)
      setOllamaError(e?.message || 'Failed to communicate with local Ollama')
    } finally {
      setIsLoadingModels(false)
    }
  }

  useEffect(() => {
    fetchOllamaInfo()
  }, [])

  const loadCameras = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      stream.getTracks().forEach(t => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter(d => d.kind === 'videoinput')
      setCameraDevices(cams)
      return cams
    } catch (e) {
      console.error('Camera access failed:', e)
      return []
    }
  }

  useEffect(() => {
    if (settings.background_config?.type === 'camera') {
      loadCameras()
    }
  }, [settings.background_config?.type])

  useEffect(() => {
    let activeStream: MediaStream | null = null
    if (settings.background_config?.type === 'camera') {
      const targetDeviceId = settings.background_config.value && settings.background_config.value !== 'default'
        ? { exact: settings.background_config.value }
        : undefined

      navigator.mediaDevices.getUserMedia({
        video: targetDeviceId ? { deviceId: targetDeviceId } : true,
        audio: false
      }).then(stream => {
        activeStream = stream
        if (previewCameraRef.current) {
          previewCameraRef.current.srcObject = stream
          previewCameraRef.current.play().catch(() => {})
        }
      }).catch(() => {})
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop())
      }
      if (previewCameraRef.current) {
        previewCameraRef.current.srcObject = null
      }
    }
  }, [settings.background_config?.type, settings.background_config?.value])

  const enableCameraMode = async () => {
    try {
      const cams = await loadCameras()
      const defaultId = cams[0]?.deviceId || 'default'
      await updateSettings('background_config', { type: 'camera', value: defaultId })
      showToast('Live camera background enabled!', 'success')
    } catch {
      showToast('Could not access camera', 'warning')
    }
  }

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
    <div className="flex-1 overflow-y-auto p-8 text-text-primary">
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        
        {/* Appearance & Theme Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <h2 className="font-sans text-xl font-bold text-text-primary border-b border-border-subtle pb-3">
            Appearance & Theme
          </h2>
          
          <div className="space-y-5 max-w-lg">
            {/* Theme Switcher Toggle */}
            <div>
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                Theme Appearance
              </label>
              <div className="flex bg-surface-subtle p-1 rounded-xl border border-border-subtle gap-1 max-w-xs">
                {(['dark', 'light'] as const).map(mode => {
                  const isSel = themeMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setThemeMode(mode)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-surface-card text-text-primary shadow-soft border border-border-subtle font-bold'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <span>{mode === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                Flat, warm-neutral palette with WCAG AA compliant contrast.
              </p>
            </div>

            {/* Background Media */}
            <div className="pt-3 border-t border-border-subtle">
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                Custom Background Media (Optional)
              </label>
              
              {/* Background Status & Preview Card */}
              <div className="mb-3 p-3 rounded-xl bg-surface-subtle border border-border-subtle flex items-center gap-4">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-surface-raised border border-border-subtle shrink-0 flex items-center justify-center relative">
                  {settings.background_config?.type === 'camera' ? (
                    <video 
                      key="preview-camera"
                      ref={previewCameraRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : settings.background_config?.type === 'image' ? (
                    <img 
                      key={`preview-img-${settings.background_config.value}`}
                      src={`media://app/${encodeURIComponent(settings.background_config.value)}`} 
                      alt="Background Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : settings.background_config?.type === 'video' ? (
                    <video 
                      key={`preview-vid-${settings.background_config.value}`}
                      src={`media://app/${encodeURIComponent(settings.background_config.value)}`} 
                      autoPlay
                      loop
                      muted 
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      key="preview-flat"
                      className="w-full h-full bg-surface-bg" 
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text-primary truncate capitalize flex items-center gap-1.5">
                    {settings.background_config?.type === 'camera' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-done animate-pulse" />
                        <span>Live Camera Feed</span>
                      </>
                    )}
                    {settings.background_config?.type === 'image' && 'Custom Image'}
                    {settings.background_config?.type === 'video' && 'Custom Video'}
                    {(!settings.background_config?.type || settings.background_config?.type === 'gradient' || settings.background_config?.type === 'color') && 'Flat Minimal Neutral'}
                  </div>
                  <div className="text-[11px] font-mono text-text-muted truncate mt-0.5">
                    {settings.background_config?.type === 'camera' 
                      ? (cameraDevices.find(c => c.deviceId === settings.background_config.value)?.label || 'Active webcam stream')
                      : settings.background_config?.type === 'image' || settings.background_config?.type === 'video' 
                      ? settings.background_config.value.split(/[\\/]/).pop() 
                      : 'Solid warm surface background'}
                  </div>
                </div>
              </div>

              {/* Background Selection Buttons */}
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={enableCameraMode}
                  className={`font-semibold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    settings.background_config?.type === 'camera'
                      ? 'bg-done text-white'
                      : 'bg-surface-subtle hover:bg-surface-raised text-text-secondary border border-border-subtle'
                  }`}
                >
                  <span>📷</span>
                  <span>Live Camera</span>
                </button>

                <button 
                  onClick={async () => {
                    const res = await window.api.app.pickBackground()
                    if (res) {
                      await updateSettings('background_config', res)
                      showToast(`Background set to ${res.type}!`, 'success')
                    }
                  }}
                  className="bg-accent hover:bg-accent-hover text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors shadow-soft flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📁</span>
                  <span>Choose File...</span>
                </button>

                <button 
                  onClick={async () => {
                    await updateSettings('background_config', { type: 'color', value: 'var(--surface-bg)' })
                    showToast('Background reset to clean flat surface', 'info')
                  }}
                  className="text-xs text-text-muted hover:text-text-primary px-3 py-2 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* General Settings Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <h2 className="font-sans text-xl font-bold text-text-primary border-b border-border-subtle pb-3">
            General
          </h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1.5 uppercase tracking-wider">
                Active Epic Cap
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="1" 
                  step="any"
                  value={settings.active_epic_cap ?? settings.focus_limit ?? 5}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10) || 5
                    updateSettings('active_epic_cap', val)
                    updateSettings('focus_limit', val)
                  }}
                  className="bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 w-24 text-text-primary outline-none focus:border-accent font-mono"
                />
                <span className="text-xs text-text-muted">Max concurrently active in-flight epics</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1.5 uppercase tracking-wider">
                Today Focus Cap
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="1" 
                  step="any"
                  value={settings.today_cap ?? 3}
                  onChange={e => updateSettings('today_cap', parseInt(e.target.value, 10) || 3)}
                  className="bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 w-24 text-text-primary outline-none focus:border-accent font-mono"
                />
                <span className="text-xs text-text-muted">Max high-priority actions in Today's focus</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1.5 uppercase tracking-wider">
                Stale Threshold (Days)
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="1" 
                  step="any"
                  value={settings.stale_threshold_days}
                  onChange={e => updateSettings('stale_threshold_days', parseInt(e.target.value, 10))}
                  className="bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 w-24 text-text-primary outline-none focus:border-accent font-mono"
                />
                <span className="text-xs text-text-muted">Days before items highlight as stale</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1.5 uppercase tracking-wider">
                Weekly Personal Hours (Discretionary Time)
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="0" 
                  max="168"
                  step="1"
                  value={settings.weekly_personal_hours ?? 28}
                  onChange={e => updateSettings('weekly_personal_hours', parseFloat(e.target.value) || 0)}
                  className="bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 w-24 text-text-primary outline-none focus:border-accent font-mono"
                />
                <span className="text-xs text-text-muted">Hours/week for personal projects (excl. work/school)</span>
              </div>
            </div>

            <div className="pt-2 space-y-2.5 border-t border-border-subtle">
              <label className="flex items-center gap-2.5 text-sm text-text-primary cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.burn_tracking_enabled !== false}
                  onChange={e => updateSettings('burn_tracking_enabled', e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
                <div>
                  <span className="font-medium">Enable Pace & Burn Tracking</span>
                  <p className="text-xs text-text-muted">Shows informational velocity, weekly burn hours, and horizon pace.</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-text-primary cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.launch_at_login}
                  onChange={e => {
                    updateSettings('launch_at_login', e.target.checked)
                    window.api.app.setLoginItem(e.target.checked)
                  }}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
                <span>Launch at login</span>
              </label>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={openHelpModal}
                  className="w-full py-2 bg-surface-subtle hover:bg-surface-raised border border-border-subtle text-text-secondary rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>❓</span>
                  <span>View Workflow & Methodology Guide</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Local AI & Ollama Configuration */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <div className="flex justify-between items-center border-b border-border-subtle pb-3">
            <div>
              <h2 className="font-sans text-xl font-bold text-text-primary flex items-center gap-2">
                <span>✦</span> Local AI & Models (Ollama)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Configure local LLM models for ✦ Chat assistant and Explore research synthesis.</p>
            </div>
            
            <button 
              type="button"
              onClick={fetchOllamaInfo}
              disabled={isLoadingModels}
              className="text-xs font-mono bg-surface-subtle hover:bg-surface-raised text-text-secondary px-3 py-1.5 rounded-lg border border-border-subtle transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoadingModels ? '🔄 Refreshing...' : '🔄 Refresh Models'}</span>
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            {/* Connection Status Badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${ollamaStatus ? 'bg-done animate-pulse' : 'bg-blocked'}`} />
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    {ollamaStatus ? 'Ollama Connected' : 'Ollama Offline or Not Ready'}
                  </span>
                  <span className="text-[11px] font-mono text-text-muted block">
                    http://127.0.0.1:11434
                  </span>
                </div>
              </div>

              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                ollamaStatus ? 'bg-done/15 text-done border-done/30' : 'bg-blocked-dim text-blocked border-blocked/30'
              }`}>
                {ollamaStatus ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Model Selector Dropdown & Tag Input */}
            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1.5 uppercase tracking-wider">
                Chat & Synthesis Model
              </label>
              
              {!isCustomModel ? (
                <div className="space-y-2">
                  <select
                    value={settings.chat_model || 'llama3.2:3b'}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomModel(true)
                        setCustomModelTag(settings.chat_model || '')
                      } else {
                        updateSettings('chat_model', e.target.value)
                        showToast(`Model set to ${e.target.value}`, 'success')
                      }
                    }}
                    className="w-full bg-surface-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent font-mono cursor-pointer"
                  >
                    {installedModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!installedModels.includes(settings.chat_model || 'llama3.2:3b') && (
                      <option value={settings.chat_model || 'llama3.2:3b'}>{settings.chat_model || 'llama3.2:3b'} (Current)</option>
                    )}
                    <option value="__custom__">+ Enter Custom Model Tag...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="e.g. gemma4:e2b or mistral"
                    value={customModelTag}
                    onChange={e => setCustomModelTag(e.target.value)}
                    className="flex-1 bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const trimmed = customModelTag.trim()
                      if (trimmed) {
                        await updateSettings('chat_model', trimmed)
                        setIsCustomModel(false)
                        showToast(`Model set to ${trimmed}`, 'success')
                      }
                    }}
                    className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold font-mono hover:bg-accent-hover transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomModel(false)}
                    className="px-2 py-1.5 text-xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sectors Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <div className="flex justify-between items-center border-b border-border-subtle pb-3">
            <h2 className="font-sans text-xl font-bold text-text-primary">Sectors</h2>
            <button 
              onClick={() => openSectorModal(null)} 
              className="text-xs font-semibold bg-accent hover:bg-accent-hover text-white px-3.5 py-1.5 rounded-lg transition-colors shadow-soft cursor-pointer"
            >
              + New Sector
            </button>
          </div>
          
          <div className="bg-surface-subtle border border-border-subtle rounded-xl overflow-hidden divide-y divide-border-subtle">
            {sectors.map((sector, idx) => (
              <div key={sector.id} className="flex items-center justify-between p-3 hover:bg-surface-raised transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSector(idx, 'up')} disabled={idx === 0} className="text-text-muted hover:text-text-primary disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => moveSector(idx, 'down')} disabled={idx === sectors.length - 1} className="text-text-muted hover:text-text-primary disabled:opacity-20 text-xs leading-none">▼</button>
                  </div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${sector.color})` }} />
                  {sector.icon && <span className="text-base select-none">{sector.icon}</span>}
                  <span className="font-medium text-text-primary text-sm">{sector.name}</span>
                </div>
                <button 
                  onClick={() => openSectorModal(sector.id)}
                  className="text-xs text-text-muted hover:text-accent px-2.5 py-1 rounded hover:bg-surface-raised transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Notifications Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <h2 className="font-sans text-xl font-bold text-text-primary border-b border-border-subtle pb-3">
            Notifications
          </h2>
          <div className="bg-surface-subtle border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised border-b border-border-subtle text-xs text-text-muted uppercase font-mono">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Sector</th>
                  <th className="px-4 py-2.5 font-normal">Enabled</th>
                  <th className="px-4 py-2.5 font-normal">Cadence</th>
                  <th className="px-4 py-2.5 font-normal">Time</th>
                  <th className="px-4 py-2.5 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sectors.map(sector => (
                  <tr key={sector.id} className="text-text-primary hover:bg-surface-raised/50">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-${sector.color})` }} />
                      <span className="font-medium">{sector.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {sector.notif_enabled ? <span className="text-done font-mono text-xs">On</span> : <span className="text-text-muted font-mono text-xs">Off</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {sector.notif_cadence.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{sector.notif_time}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => testNotif(sector.id)} className="text-xs bg-surface-card hover:bg-surface-raised border border-border-subtle text-text-secondary px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
                        Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Weekly Stack Review Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <h2 className="font-sans text-xl font-bold text-text-primary border-b border-border-subtle pb-3">
            Weekly Stack Review
          </h2>
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-2.5 text-sm text-text-primary cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.stack_review_enabled}
                onChange={e => updateSettings('stack_review_enabled', e.target.checked)}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
              <span>Enable weekly review notification</span>
            </label>

            {settings.stack_review_enabled && (
              <div className="space-y-3 pl-6 border-l-2 border-border-subtle">
                <div>
                  <label className="block text-xs font-mono text-text-secondary mb-1">Day</label>
                  <select
                    value={settings.stack_review_day}
                    onChange={e => updateSettings('stack_review_day', parseInt(e.target.value, 10))}
                    className="bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-text-secondary mb-1">Time</label>
                  <input
                    type="time"
                    value={settings.stack_review_time}
                    onChange={e => updateSettings('stack_review_time', e.target.value)}
                    className="bg-surface-input border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Fires a notification highlighting the item across your entire stack that hasn't been touched the longest.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Feature Flags & Onboarding Tour */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <h2 className="font-sans text-xl font-bold text-text-primary border-b border-border-subtle pb-3 flex items-center justify-between">
            <span>✦ Feature Flags & Onboarding</span>
            <span className="text-xs font-mono font-bold text-accent bg-accent-subtle px-2.5 py-0.5 rounded-full border border-accent/30">
              Experimental
            </span>
          </h2>
          <div className="space-y-4 max-w-lg">
            <label className="flex items-center gap-2.5 text-sm text-text-primary cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.feature_interactive_tour !== false}
                onChange={e => updateSettings('feature_interactive_tour', e.target.checked)}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
              <span>Enable Interactive UI Walkthrough Tour</span>
            </label>
            <p className="text-xs text-text-muted pl-6.5">
              Provides step-by-step interactive spotlights explaining LifeStack 2.0's 4-tier system, 2×2 tactical cockpit, and local AI assistant.
            </p>

            <div className="pt-2 pl-6.5">
              <button
                type="button"
                onClick={() => {
                  startTour()
                  showToast('Interactive Tour Started!', 'info')
                }}
                disabled={settings.feature_interactive_tour === false}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-lg shadow-soft transition-all cursor-pointer flex items-center gap-2"
              >
                <span>🚀</span>
                <span>Launch Interactive Tour Now</span>
              </button>
            </div>
          </div>
        </section>

        {/* Data Management Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-soft">
          <h2 className="font-sans text-xl font-bold text-text-primary border-b border-border-subtle pb-3">
            Data
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="bg-surface-subtle hover:bg-surface-raised border border-border-subtle text-sm text-text-secondary px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {exporting ? 'Exporting...' : 'Export Snapshot'}
            </button>
            {showResetConfirm ? (
              <div className="flex items-center gap-2 bg-blocked-dim border border-blocked/30 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-blocked font-mono">Reset all data permanently?</span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false)
                    showToast('Reset not yet implemented', 'info')
                  }}
                  className="bg-blocked hover:opacity-90 text-white text-xs font-bold px-3 py-1 rounded-lg transition-opacity cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button 
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="text-text-muted hover:text-text-primary text-xs px-2 py-1 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="bg-blocked-dim hover:bg-blocked-dim/80 text-blocked border border-blocked/30 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer font-medium"
              >
                Reset All Data
              </button>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
