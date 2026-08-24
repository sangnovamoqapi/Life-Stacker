import React, { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '../state/AppContext'

interface TourStep {
  title: string
  badge: string
  content: string
  targetSelector?: string
  viewMode?: 'lanes' | 'overview' | 'chat' | 'settings'
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to LifeStack 2.0',
    badge: '🌊 4-TIER WORKFLOW',
    content: 'LifeStack is a local-first life operating system designed to separate open-ended research discovery from rapid, crisp execution: Sectors → Active Epics (with planning horizons) → Explore Research → Next Actions → Today\'s Commitment.',
    position: 'center'
  },
  {
    title: 'Top Navigation & Focus Strip',
    badge: '⚡ SYSTEM COCKPIT',
    targetSelector: '[data-tour="topbar"]',
    content: 'Instantly search tasks & semantic memory (/), switch views, monitor your active epic cap (5 max), and see real-time local Ollama AI health.',
    position: 'bottom'
  },
  {
    title: 'Lanes View & Life Sectors',
    badge: '🌐 DOMAIN ORGANIZER',
    viewMode: 'lanes',
    targetSelector: '[data-tour="lanes-view"]',
    content: 'View and prioritize Epics grouped by life sectors (Career, Health, Learning, Side Projects). Priority #1 dominant cards take top focus in each lane.',
    position: 'center'
  },
  {
    title: '2×2 Tactical Command Grid',
    badge: '🎯 UNIFIED OVERVIEW',
    viewMode: 'overview',
    targetSelector: '[data-tour="overview-grid"]',
    content: 'Your tactical dashboard: Active Epics (top-left) with Dual Progress meters, Explore Research (top-right) sorted by staleness, Next Actions (bottom-left), and Today\'s Top-3 daily focus (bottom-right).',
    position: 'center'
  },
  {
    title: 'Explore 🔬 vs. Next ⚡ Workflow',
    badge: '🔬 RESEARCH SYNTHESIS',
    viewMode: 'overview',
    targetSelector: '[data-tour="explore-panel"]',
    content: 'Never clutter your daily todo list with vague research tasks. Put hypotheses and questions in Explore cards, then click "Generate Next Items" to let local AI distill them into concrete actionable steps.',
    position: 'center'
  },
  {
    title: '✦ Local AI Co-Pilot & Diff Cards',
    badge: '🤖 ASSISTANT & SAFETY',
    viewMode: 'chat',
    targetSelector: '[data-tour="chat-view"]',
    content: 'Chat with your local AI co-pilot. Ask it to break down complex goals, select your local model in Settings, review interactive diff cards, edit proposed explore/next tasks, and confirm changes before anything touches your database.',
    position: 'center'
  }
]

export const InteractiveTour: React.FC = () => {
  const { isTourActive, stopTour, setViewMode, updateSettings, settings } = useAppContext()
  const [currentStepIdx, setCurrentStepIdx] = useState(0)

  // Exit tour safely
  const handleExit = useCallback(() => {
    updateSettings('has_completed_tour', true)
    stopTour()
  }, [updateSettings, stopTour])

  // Step navigation
  const handleNext = useCallback(() => {
    if (currentStepIdx < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIdx + 1
      setCurrentStepIdx(nextIdx)
      const nextStep = TOUR_STEPS[nextIdx]
      if (nextStep.viewMode) {
        setViewMode(nextStep.viewMode)
      }
    } else {
      handleExit()
    }
  }, [currentStepIdx, setViewMode, handleExit])

  const handlePrev = useCallback(() => {
    if (currentStepIdx > 0) {
      const prevIdx = currentStepIdx - 1
      setCurrentStepIdx(prevIdx)
      const prevStep = TOUR_STEPS[prevIdx]
      if (prevStep.viewMode) {
        setViewMode(prevStep.viewMode)
      }
    }
  }, [currentStepIdx, setViewMode])

  // Keyboard navigation
  useEffect(() => {
    if (!isTourActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleExit()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTourActive, handleNext, handlePrev, handleExit])

  // If tour is active, initialize view mode for first step
  useEffect(() => {
    if (isTourActive) {
      setCurrentStepIdx(0)
      if (TOUR_STEPS[0].viewMode) {
        setViewMode(TOUR_STEPS[0].viewMode)
      }
    }
  }, [isTourActive, setViewMode])

  if (!isTourActive || !settings.feature_interactive_tour) return null

  const step = TOUR_STEPS[currentStepIdx]
  const isLast = currentStepIdx === TOUR_STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto flex items-center justify-center p-4">
      {/* Translucent Dimmed Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-[6px] transition-opacity duration-300"
        onClick={handleExit}
      />

      {/* Floating Card */}
      <div 
        className="relative z-10 w-full max-w-lg bg-[#0e1320]/95 border border-white/[0.22] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-6 text-slate-100 flex flex-col gap-4 animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {step.badge}
          </span>
          <span className="text-xs font-mono text-slate-400">
            Step <strong className="text-slate-200">{currentStepIdx + 1}</strong> of {TOUR_STEPS.length}
          </span>
        </div>

        {/* Title & Body */}
        <div className="space-y-2">
          <h3 className="font-serif text-xl font-bold text-slate-100">
            {step.title}
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">
            {step.content}
          </p>
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center gap-1.5 pt-1">
          {TOUR_STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStepIdx 
                  ? 'w-6 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
                  : i < currentStepIdx 
                    ? 'w-2 bg-blue-500/70' 
                    : 'w-2 bg-white/15'
              }`}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.10]">
          <button
            onClick={handleExit}
            className="text-xs font-mono text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Skip Tour (Esc)
          </button>

          <div className="flex items-center gap-2">
            {currentStepIdx > 0 && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.12] transition-colors cursor-pointer"
              >
                ◂ Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-1.5 text-xs font-mono font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_2px_12px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{isLast ? 'Finish & Start Stacking 🚀' : 'Next ▸'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
