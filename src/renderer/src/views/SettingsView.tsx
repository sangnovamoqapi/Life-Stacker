import React, { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../state/AppContext'

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, sectors, reorderSectors, openSectorModal, showToast, openHelpModal, startTour } = useAppContext()
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
      // Prompt for permission if needed
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

  // Manage mini preview camera stream
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
                  className="bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 w-24 text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">Max concurrently active in-flight epics</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                Today Focus Cap
              </label>
              <div className="flex gap-3 items-center">
                <input 
                  type="number" 
                  min="1" 
                  step="any"
                  value={settings.today_cap ?? 3}
                  onChange={e => updateSettings('today_cap', parseInt(e.target.value, 10) || 3)}
                  className="bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 w-24 text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">Max high-priority actions in Today's focus</span>
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
                  step="any"
                  value={settings.stale_threshold_days}
                  onChange={e => updateSettings('stale_threshold_days', parseInt(e.target.value, 10))}
                  className="bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 w-24 text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">Days before items highlight as stale</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
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
                  className="bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 w-24 text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">Hours/week for personal projects (excl. work/school)</span>
              </div>
            </div>

            <div className="pt-2 space-y-2.5 border-t border-white/[0.06]">
              <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.burn_tracking_enabled !== false}
                  onChange={e => updateSettings('burn_tracking_enabled', e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
                <div>
                  <span className="font-medium">Enable Pace & Burn Tracking</span>
                  <p className="text-xs text-slate-400">Shows informational velocity, weekly burn hours, and horizon pace.</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={openHelpModal}
                  className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>❓</span>
                  <span>View Workflow & Methodology Guide</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Local AI & Ollama Configuration */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="font-sans text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>✦</span> Local AI & Models (Ollama)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure local LLM models for ✦ Chat assistant and Explore research synthesis.</p>
            </div>
            
            <button 
              type="button"
              onClick={fetchOllamaInfo}
              disabled={isLoadingModels}
              className="text-xs font-mono bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 px-3 py-1.5 rounded-lg border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoadingModels ? '🔄 Refreshing...' : '🔄 Refresh Models'}</span>
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            {/* Connection Status Badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${ollamaStatus ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse' : 'bg-rose-500'}`} />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    {ollamaStatus ? 'Ollama Connected' : 'Ollama Offline or Not Ready'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 block">
                    http://127.0.0.1:11434
                  </span>
                </div>
              </div>

              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                ollamaStatus ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}>
                {ollamaStatus ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {ollamaError && !ollamaStatus && (
              <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-500/20 p-2.5 rounded-lg">
                ⚠️ {ollamaError}
              </p>
            )}

            {/* Chat & Synthesis Model Picker */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                Active Chat & Synthesis Model
              </label>
              
              {!isCustomModel ? (
                <div className="space-y-2">
                  <div className="relative">
                    <select
                      value={settings.chat_model ?? 'llama3.2:3b'}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setIsCustomModel(true)
                          setCustomModelTag(settings.chat_model || '')
                        } else {
                          updateSettings('chat_model', e.target.value)
                          showToast(`Active AI model set to "${e.target.value}"`, 'success')
                        }
                      }}
                      className="w-full bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500 font-mono cursor-pointer appearance-none"
                    >
                      {installedModels.length > 0 ? (
                        installedModels
                          .filter(m => !m.toLowerCase().includes('embed'))
                          .map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))
                      ) : (
                        <option value={settings.chat_model ?? 'llama3.2:3b'}>
                          {settings.chat_model ?? 'llama3.2:3b'} (Auto-detected)
                        </option>
                      )}
                      <option value="__custom__">✏️ Custom Model Tag...</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Used for ✦ Chat assistant conversations and AI synthesis of Explore research into Next actions.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customModelTag}
                      onChange={e => setCustomModelTag(e.target.value)}
                      placeholder="e.g. gemma4:e2b, qwen2.5:7b, mistral..."
                      className="flex-1 bg-[#121622]/90 border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = customModelTag.trim()
                        if (trimmed) {
                          updateSettings('chat_model', trimmed)
                          showToast(`Custom model set to "${trimmed}"`, 'success')
                          setIsCustomModel(false)
                        }
                      }}
                      disabled={!customModelTag.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCustomModel(false)}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Type any model tag pulled in your local Ollama library (e.g. <code className="text-amber-300 font-mono">gemma4:e2b</code>).
                  </p>
                </div>
              )}
            </div>

            {/* Vector Embedding Model Status */}
            <div className="p-3 rounded-xl bg-black/20 border border-white/[0.06] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Vector Embeddings:</span>
                <span className="text-xs font-mono text-purple-300 font-bold">nomic-embed-text</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Computes 768-dim embeddings for SQLite hybrid memory search. Run <code className="text-amber-300 font-mono">ollama pull nomic-embed-text</code> if missing.
              </p>
            </div>
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
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/50 border border-white/[0.10] shrink-0 flex items-center justify-center relative">
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
                      key="preview-gradient"
                      className="w-full h-full" 
                      style={{ background: settings.background_config?.value || 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), #0b0b0d' }} 
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-100 truncate capitalize flex items-center gap-1.5">
                    {settings.background_config?.type === 'camera' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Camera Feed</span>
                      </>
                    )}
                    {settings.background_config?.type === 'image' && 'Custom Image'}
                    {settings.background_config?.type === 'video' && 'Custom Video'}
                    {(!settings.background_config?.type || settings.background_config?.type === 'gradient' || settings.background_config?.type === 'color') && 'Default Atmospheric Gradient'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    {settings.background_config?.type === 'camera' 
                      ? (cameraDevices.find(c => c.deviceId === settings.background_config.value)?.label || 'Active webcam stream')
                      : settings.background_config?.type === 'image' || settings.background_config?.type === 'video' 
                      ? settings.background_config.value.split(/[\\/]/).pop() 
                      : 'Built-in dark theme styling'}
                  </div>
                </div>
              </div>

              {/* Camera device selector if multiple cameras available */}
              {settings.background_config?.type === 'camera' && cameraDevices.length > 1 && (
                <div className="mb-3 space-y-1">
                  <label className="block text-[11px] font-mono text-slate-300">Select Camera</label>
                  <select
                    value={settings.background_config.value}
                    onChange={e => updateSettings('background_config', { type: 'camera', value: e.target.value })}
                    className="w-full bg-[#121622] border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                  >
                    {cameraDevices.map((cam, idx) => (
                      <option key={cam.deviceId || idx} value={cam.deviceId}>
                        {cam.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Background Selection Buttons */}
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={enableCameraMode}
                  className={`font-semibold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-md ${
                    settings.background_config?.type === 'camera'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/50'
                      : 'bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.10]'
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
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors shadow-md flex items-center gap-1.5"
                >
                  <span>📁</span>
                  <span>Choose File...</span>
                </button>

                <button 
                  onClick={async () => {
                    await updateSettings('background_config', { type: 'gradient', value: 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' })
                    showToast('Background reset to default gradient', 'info')
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  Reset Default
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Live webcam, images (PNG, JPG, WebP), and videos (MP4, WebM) are supported.
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

        {/* Feature Flags & Onboarding Tour */}
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-sans text-xl font-bold text-slate-100 border-b border-white/[0.08] pb-3 flex items-center justify-between">
            <span>✦ Feature Flags & Onboarding</span>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Experimental
            </span>
          </h2>
          <div className="space-y-4 max-w-lg">
            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.feature_interactive_tour !== false}
                onChange={e => updateSettings('feature_interactive_tour', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
              <span>Enable Interactive UI Walkthrough Tour</span>
            </label>
            <p className="text-xs text-slate-400 pl-6.5">
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
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>🚀</span>
                <span>Launch Interactive Tour Now</span>
              </button>
            </div>
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
            {showResetConfirm ? (
              <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-red-300 font-mono">Reset all data permanently?</span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false)
                    showToast('Reset not yet implemented', 'info')
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                >
                  Confirm Reset
                </button>
                <button 
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-sm px-4 py-2 rounded-xl transition-colors"
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
