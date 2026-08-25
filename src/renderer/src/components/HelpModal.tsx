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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-surface-modal border border-border-subtle rounded-2xl shadow-modal overflow-hidden flex flex-col max-h-[88vh] text-text-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle bg-surface-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent text-white font-bold flex items-center justify-center shadow-soft">
              ⚡
            </div>
            <div>
              <h2 className="font-sans text-base font-bold text-text-primary">Life Stack Workflow & Methodology</h2>
              <p className="text-xs text-text-muted">High-cognitive focus, structured research synthesis, and rapid execution.</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg transition-colors p-1.5 rounded-lg hover:bg-surface-raised cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 pt-3 border-b border-border-subtle bg-surface-raised gap-6">
          {(['workflow', 'rules', 'shortcuts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-mono font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'border-accent text-accent font-bold' 
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab === 'workflow' ? '🌊 The 4-Tier Workflow' : tab === 'rules' ? '⚖️ Core Principles' : '⌨️ Keyboard & Tips'}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-surface-modal">
          
          {/* TAB 1: 🌊 The 4-Tier Workflow */}
          {activeTab === 'workflow' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 bg-surface-card border border-border-subtle rounded-xl space-y-1 shadow-soft">
                  <span className="text-2xl block">🌐</span>
                  <strong className="text-xs text-text-primary block font-bold">1. Sectors</strong>
                  <p className="text-[11px] text-text-muted">Broad life domains (Career, Health, Learning).</p>
                </div>

                <div className="p-3.5 bg-surface-card border border-accent/30 rounded-xl space-y-1 shadow-soft">
                  <span className="text-2xl block">⚡</span>
                  <strong className="text-xs text-accent block font-bold">2. Active Epics</strong>
                  <p className="text-[11px] text-text-muted">Max 5 in-flight initiatives with planning horizons.</p>
                </div>

                <div className="p-3.5 bg-surface-card border border-purple-500/30 rounded-xl space-y-1 shadow-soft">
                  <span className="text-2xl block">🔬</span>
                  <strong className="text-xs text-purple-400 block font-bold">3. Explore</strong>
                  <p className="text-[11px] text-text-muted">Research topics, questions & findings.</p>
                </div>

                <div className="p-3.5 bg-surface-card border border-done/30 rounded-xl space-y-1 shadow-soft">
                  <span className="text-2xl block">🎯</span>
                  <strong className="text-xs text-done block font-bold">4. Next & Today</strong>
                  <p className="text-[11px] text-text-muted">Refined execution steps & Top-3 daily focus.</p>
                </div>
              </div>

              {/* Deep Dive Breakdown */}
              <div className="space-y-4">
                <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-2">
                  <h3 className="text-xs font-bold font-mono uppercase text-purple-400 flex items-center gap-2">
                    <span>🔬</span> Explore (Research) vs. <span>⚡</span> Next (Execution)
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Don't mix exploratory questions with task execution. Create <strong>Explore topics</strong> to log links, architecture experiments, and uncertainty notes. When ready, click <strong>✨ Synthesize to Next</strong> or ask the AI assistant to turn findings into concrete actionable tasks.
                  </p>
                </div>

                <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-2">
                  <h3 className="text-xs font-bold font-mono uppercase text-accent flex items-center gap-2">
                    <span>🎯</span> Today Focus Cap (Top 3)
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    The <strong>Today Focus</strong> column is limited to a strict maximum of 3 items. Promoting a 4th item prompts you to swap out or complete an existing task, preventing cognitive overload.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ⚖️ Core Principles */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-2">
                <h3 className="text-xs font-bold font-mono uppercase text-accent flex items-center gap-2">
                  <span>⚡</span> Active Epic Limit (Max 5)
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Context switching destroys productivity. You can have at most 5 active epics across all life sectors at once. If you want to start a new initiative, you must complete or <strong>Park</strong> an existing epic via the 1-click Park Swap modal.
                </p>
              </div>

              <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-2">
                <h3 className="text-xs font-bold font-mono uppercase text-text-primary flex items-center gap-2">
                  <span>📅</span> Planning Horizons & Informational Velocity
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Epics track their planning horizon (e.g. 3 months, 2 quarters) and log elapsed pace based on your logged effort and discretionary capacity (default: 28 personal hours/week).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ⌨️ Keyboard & Tips */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted font-bold">Quick Navigation</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border-subtle">
                    <span className="text-text-secondary">Global Hybrid Search</span>
                    <kbd className="px-2 py-0.5 font-mono text-text-primary bg-surface-subtle rounded border border-border-subtle">/</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border-subtle">
                    <span className="text-text-secondary">Close Drawer or Modal</span>
                    <kbd className="px-2 py-0.5 font-mono text-text-primary bg-surface-subtle rounded border border-border-subtle">Esc</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border-subtle">
                    <span className="text-text-secondary">Reorder Today Items</span>
                    <span className="font-mono text-text-muted text-[11px]">Drag ⠿ handle</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-text-secondary">AI Vector Memory & Conversational Help</span>
                    <span className="font-mono text-accent text-[11px]">✦ Chat View</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border-subtle flex justify-between items-center bg-surface-raised">
          <span className="text-[11px] font-mono text-text-muted">
            Life Stack 2.0 • Focus • Synthesize • Execute
          </span>
          <div className="flex items-center gap-3">
            {settings.feature_interactive_tour !== false && (
              <button
                type="button"
                onClick={startTour}
                className="px-4 py-2 bg-surface-card hover:bg-surface-subtle text-accent border border-accent/40 font-bold text-xs rounded-lg shadow-soft transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>Start Interactive Tour</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-lg shadow-soft transition-all cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
