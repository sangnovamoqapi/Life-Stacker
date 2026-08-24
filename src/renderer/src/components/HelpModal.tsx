import React, { useState } from 'react'
import { useAppContext } from '../state/AppContext'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

type GuideTab = 'workflow' | 'rules' | 'shortcuts'

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { startTour, settings } = useAppContext()
  const [activeTab, setActiveTab] = useState<GuideTab>('workflow')

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-[#0f1422] border border-white/[0.18] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[88vh] text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.10] bg-[#141a2c]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
              ⚡
            </div>
            <div>
              <h2 className="font-sans text-base font-bold text-slate-100">Life Stack Workflow & Methodology</h2>
              <p className="text-xs text-slate-400">High-cognitive focus, structured research synthesis, and rapid execution.</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors p-1.5 rounded-lg hover:bg-white/[0.08] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 pt-3 border-b border-white/[0.08] bg-[#0c101c] gap-6">
          {(['workflow', 'rules', 'shortcuts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-mono font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'border-blue-500 text-blue-400 font-bold' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'workflow' ? '🌊 The 4-Tier Workflow' : tab === 'rules' ? '⚖️ Core Principles' : '⌨️ Keyboard & Tips'}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-[#0f1422]">
          
          {/* TAB 1: 🌊 The 4-Tier Workflow */}
          {activeTab === 'workflow' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 bg-[#161c2e] border border-blue-500/30 rounded-xl space-y-1 shadow-sm">
                  <span className="text-2xl block">🌐</span>
                  <strong className="text-xs text-blue-300 block font-bold">1. Sectors</strong>
                  <p className="text-[11px] text-slate-300">Broad life domains (Career, Health, Learning).</p>
                </div>

                <div className="p-3.5 bg-[#161c2e] border border-amber-500/30 rounded-xl space-y-1 shadow-sm">
                  <span className="text-2xl block">⚡</span>
                  <strong className="text-xs text-amber-300 block font-bold">2. Active Epics</strong>
                  <p className="text-[11px] text-slate-300">Max 5 in-flight initiatives with planning horizons.</p>
                </div>

                <div className="p-3.5 bg-[#161c2e] border border-purple-500/30 rounded-xl space-y-1 shadow-sm">
                  <span className="text-2xl block">🔬</span>
                  <strong className="text-xs text-purple-300 block font-bold">3. Explore</strong>
                  <p className="text-[11px] text-slate-300">Research topics, questions & unstructured findings.</p>
                </div>

                <div className="p-3.5 bg-[#161c2e] border border-emerald-500/30 rounded-xl space-y-1 shadow-sm">
                  <span className="text-2xl block">🎯</span>
                  <strong className="text-xs text-emerald-300 block font-bold">4. Next & Today</strong>
                  <p className="text-[11px] text-slate-300">Refined execution steps & Top-3 daily focus.</p>
                </div>
              </div>

              {/* Deep Dive Breakdown */}
              <div className="space-y-4">
                <div className="p-4 bg-[#141a2c] rounded-xl border border-white/[0.08] space-y-2">
                  <h3 className="text-xs font-bold font-mono uppercase text-purple-300 flex items-center gap-2">
                    <span>🔬</span> Explore (Research) vs. <span>⚡</span> Next (Execution)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Most todo lists fail because they treat <em>"Research visa options"</em> the same as <em>"Upload passport scan"</em>. 
                    In LifeStack, <strong>Explore Cards</strong> hold findings, notes, and questions. When you're ready, click <strong>"✨ Generate Next Items"</strong> to synthesize concrete Next actions with AI.
                  </p>
                </div>

                <div className="p-4 bg-[#141a2c] rounded-xl border border-white/[0.08] space-y-2">
                  <h3 className="text-xs font-bold font-mono uppercase text-amber-300 flex items-center gap-2">
                    <span>🎯</span> The Today Focus Pipeline
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The <strong>Today panel</strong> holds up to <strong>3 high-priority actions</strong>. Pull them directly from your Next backlog or from refined research findings. When completed, 1-click checking logs your effort and keeps your focus clear.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ⚖️ Core Principles */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#141a2c] border border-white/[0.08] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🅿️</span>
                    <h4 className="text-xs font-bold text-slate-100">5-Epic Cap & Park Swap</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    To prevent burnout and maintain focus, only 5 epics can be active at once. Attempting to activate a 6th prompts you to park one in the icebox.
                  </p>
                </div>

                <div className="p-4 bg-[#141a2c] border border-white/[0.08] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎯</span>
                    <h4 className="text-xs font-bold text-slate-100">Today Cap (3 Items)</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Today is intentionally small. Promoting a 4th action prompts you to bump an existing item back to the backlog.
                  </p>
                </div>

                <div className="p-4 bg-[#141a2c] border border-white/[0.08] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <h4 className="text-xs font-bold text-slate-100">Atomic Action Generation</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    AI-drafted Next items enter a staging sandbox where you can adjust titles and effort before committing atomically.
                  </p>
                </div>

                <div className="p-4 bg-[#141a2c] border border-white/[0.08] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <h4 className="text-xs font-bold text-slate-100">Completion Safeguards</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    An Epic cannot be marked Done while open Next actions remain, and Explore topics with linked tasks cannot be deleted accidentally.
                  </p>
                </div>

                <div className="p-4 bg-[#141a2c] border border-white/[0.08] rounded-xl space-y-1.5 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏳</span>
                    <h4 className="text-xs font-bold text-slate-100">Discretionary Personal Time (Weekly Hours)</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The <code className="text-amber-300 font-mono text-[11px]">weekly_personal_hours</code> setting (default: 28 hrs/week) is explicitly designed to capture <strong>discretionary time for personal projects</strong> — excluding compulsory 9-to-5 job, school, or college commitments. This baseline ensures pace and horizon trackers reflect your true capacity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ⌨️ Keyboard & Tips */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-[#141a2c] rounded-xl border border-white/[0.08] space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Quick Navigation</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <span className="text-slate-300">Global Hybrid Search</span>
                    <kbd className="px-2 py-0.5 font-mono text-slate-200 bg-white/[0.08] rounded border border-white/[0.12]">/</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <span className="text-slate-300">Close Drawer or Modal</span>
                    <kbd className="px-2 py-0.5 font-mono text-slate-200 bg-white/[0.08] rounded border border-white/[0.12]">Esc</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <span className="text-slate-300">Reorder Today Items</span>
                    <span className="font-mono text-slate-400 text-[11px]">Drag ⠿ handle</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-300">AI Vector Memory & Conversational Help</span>
                    <span className="font-mono text-blue-400 text-[11px]">✦ Chat View</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.10] flex justify-between items-center bg-[#141a2c]">
          <span className="text-[11px] font-mono text-slate-400">
            Life Stack 2.0 • Focus • Synthesize • Execute
          </span>
          <div className="flex items-center gap-3">
            {settings.feature_interactive_tour !== false && (
              <button
                type="button"
                onClick={startTour}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>Start Interactive Tour</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
