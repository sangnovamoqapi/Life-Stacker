import React, { useState, useEffect } from 'react'
import { useAppContext } from '../state/AppContext'

export const TopBar: React.FC = () => {
  const { 
    viewMode, 
    setViewMode, 
    searchTerm, 
    setSearchTerm, 
    items, 
    settings, 
    openNewItemModal, 
    openHelpModal,
    themeMode,
    toggleTheme 
  } = useAppContext()
  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const checkAi = async () => {
      try {
        const ready = await window.api.ai.checkStatus()
        const lastErr = await window.api.ai.getLastError()
        if (isMounted) {
          setAiReady(ready)
          setAiError(lastErr)
        }
      } catch (err: any) {
        if (isMounted) {
          setAiReady(false)
          setAiError(err?.message || 'Cannot reach AI service')
        }
      }
    }

    checkAi()
    const interval = setInterval(checkAi, 5000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const activeCap = settings.active_epic_cap ?? settings.focus_limit ?? 5
  const activeCount = items.filter(i => i.status === 'active').length
  const overLimit = activeCount > activeCap

  const getStatusTooltip = () => {
    if (aiReady) {
      return 'AI: Ready (nomic-embed-text connected)'
    }
    if (aiError) {
      return `AI: Offline — ${aiError}`
    }
    return 'AI: Checking connection...'
  }

  return (
    <div data-tour="topbar" className="sticky top-0 z-20 bg-surface-raised border-b border-border-subtle h-14 flex items-center px-6 justify-between shrink-0 gap-4 transition-colors">
      {/* Brand & Active Pill */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-center text-accent">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h1 className="font-sans text-base font-bold text-text-primary tracking-tight">Life Stack</h1>
        </div>
        
        <div className={`px-2.5 py-0.5 rounded-full text-xs font-mono border flex items-center gap-1.5 ${
          overLimit 
            ? 'border-blocked/30 bg-blocked-dim text-blocked' 
            : 'border-border-subtle bg-surface-subtle text-text-secondary'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${overLimit ? 'bg-blocked' : 'bg-accent'}`} />
          <span>Active {activeCount}/{activeCap}</span>
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="flex items-center flex-1 justify-center max-w-lg">
        <div className="relative w-full flex items-center">
          <span className="absolute left-3.5 text-xs text-text-muted pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Search titles, sectors, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-input hover:bg-surface-card border border-border-subtle focus:border-accent rounded-lg pl-9 pr-8 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition-all shadow-sm"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface-subtle rounded border border-border-subtle pointer-events-none">
            /
          </kbd>
        </div>
      </div>

      {/* Actions & Status */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Minimal AI Status Indicator with dynamic error tooltip */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border border-border-subtle bg-surface-subtle select-none cursor-help transition-all"
          title={getStatusTooltip()}
        >
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
            aiReady 
              ? 'bg-done' 
              : 'bg-blocked'
          }`} />
          <span className={aiReady ? 'text-text-secondary font-medium' : 'text-text-muted'}>
            AI {aiReady ? 'Ready' : 'Offline'}
          </span>
        </div>

        {/* View Switcher Pill Segment */}
        <div className="flex bg-surface-subtle p-1 rounded-lg border border-border-subtle gap-0.5">
          {(['overview', 'lanes', 'calendar', 'journal', 'chat', 'stats'] as const).map(mode => {
            const isActive = viewMode === mode
            const label = mode === 'overview' 
              ? 'Life Stack' 
              : mode === 'lanes' 
              ? 'Lanes' 
              : mode === 'calendar'
              ? 'Calendar'
              : mode === 'journal'
              ? 'Journal'
              : mode === 'chat' 
              ? '✦ Chat' 
              : 'Stats'
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  isActive 
                    ? 'bg-surface-card text-text-primary shadow-soft font-bold border border-border-subtle' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Theme Toggle Button (☀️ / 🌙) */}
        <button 
          onClick={toggleTheme}
          className="text-text-muted hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-subtle border border-transparent hover:border-border-subtle"
          title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {themeMode === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Workflow Guide Button */}
        <button 
          onClick={openHelpModal}
          className="text-text-muted hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-subtle border border-transparent hover:border-border-subtle"
          title="Workflow & Guide"
        >
          ❓
        </button>

        {/* Settings Button */}
        <button 
          onClick={() => setViewMode('settings')}
          className={`text-text-muted hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-subtle border border-transparent hover:border-border-subtle ${
            viewMode === 'settings' ? 'text-accent bg-surface-subtle border-border-subtle' : ''
          }`}
          title="Settings"
        >
          ⚙
        </button>

        {/* Add Item Button */}
        <button
          onClick={() => openNewItemModal()}
          className="bg-accent hover:bg-accent-hover active:opacity-90 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-soft flex items-center gap-1.5"
        >
          <span className="text-sm leading-none font-bold">+</span>
          <span>Add item</span>
        </button>
      </div>
    </div>
  )
}
