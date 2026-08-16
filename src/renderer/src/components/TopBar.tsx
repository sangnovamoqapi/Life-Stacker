import React from 'react'
import { useAppContext } from '../state/AppContext'

export const TopBar: React.FC = () => {
  const { viewMode, setViewMode, searchTerm, setSearchTerm, items, settings, openNewItemModal } = useAppContext()

  const activeCount = items.filter(i => i.status === 'active').length
  const overLimit = activeCount > settings.focus_limit

  return (
    <div className="sticky top-0 z-20 bg-[#0d1017]/80 backdrop-blur-md border-b border-white/[0.08] h-14 flex items-center px-6 justify-between shrink-0 gap-4">
      {/* Brand & Active Pill */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h1 className="font-sans text-base font-bold text-slate-100 tracking-tight">Life Stack</h1>
        </div>
        
        <div className={`px-2.5 py-0.5 rounded-full text-xs font-mono border flex items-center gap-1.5 ${
          overLimit 
            ? 'border-red-500/30 bg-red-500/10 text-red-400' 
            : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${overLimit ? 'bg-red-400' : 'bg-blue-400 animate-pulse'}`} />
          <span>Active {activeCount}/{settings.focus_limit}</span>
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="flex items-center flex-1 justify-center max-w-lg">
        <div className="relative w-full flex items-center">
          <span className="absolute left-3.5 text-xs text-slate-400 pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Search titles, sectors, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#131722]/80 hover:bg-[#181d2b]/80 border border-white/[0.08] focus:border-blue-500/50 rounded-full pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-all"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white/[0.06] rounded border border-white/[0.08] pointer-events-none">
            /
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* View Switcher Pill Segment */}
        <div className="flex bg-[#131722]/80 p-1 rounded-full border border-white/[0.08] gap-0.5">
          {(['overview', 'lanes', 'stats'] as const).map(mode => {
            const isActive = viewMode === mode
            const label = mode === 'overview' ? 'Life Stack' : mode === 'lanes' ? 'Lanes' : 'Stats'
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3.5 py-1 text-xs rounded-full font-medium transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Settings Button */}
        <button 
          onClick={() => setViewMode('settings')}
          className={`text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] ${
            viewMode === 'settings' ? 'text-blue-400 bg-white/[0.08] border-white/[0.08]' : ''
          }`}
          title="Settings"
        >
          ⚙
        </button>

        {/* Add Item Button */}
        <button
          onClick={() => openNewItemModal()}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-full text-xs transition-all shadow-md shadow-blue-600/25 flex items-center gap-1.5"
        >
          <span className="text-sm leading-none font-bold">+</span>
          <span>Add item</span>
        </button>
      </div>
    </div>
  )
}
