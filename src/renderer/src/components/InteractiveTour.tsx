import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAppContext } from '../state/AppContext'

interface TourStep {
  title: string
  badge: string
  content: string
  targetSelector?: string
  viewMode?: 'lanes' | 'overview' | 'chat' | 'settings'
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to LifeStack 2.0',
    badge: '🌊 4-TIER WORKFLOW',
    content: 'LifeStack separates open-ended discovery from rapid execution across 4 distinct levels: Sectors → Active Epics (with planning horizons) → Explore Research → Next Actions → Today\'s Commitment.',
    preferredPlacement: 'center'
  },
  {
    title: 'Top Navigation & Active Limits',
    badge: '⚡ SYSTEM COCKPIT',
    targetSelector: '[data-tour="topbar"]',
    content: 'Instantly search tasks & notes (/), switch views, monitor your active epic capacity limit (5 max), and see real-time local Ollama AI status.',
    preferredPlacement: 'bottom'
  },
  {
    title: 'Focus Strip & Velocity Meters',
    badge: '📊 DAILY VELOCITY',
    viewMode: 'lanes',
    targetSelector: '[data-tour="focus-strip"]',
    content: 'Summary tiles showing total stack size, active initiatives vs focus limit, overall completion progress ring, and your #1 top focus item.',
    preferredPlacement: 'bottom'
  },
  {
    title: '2×2 Tactical Command Grid',
    badge: '🎯 UNIFIED OVERVIEW',
    viewMode: 'overview',
    targetSelector: '[data-tour="overview-grid"]',
    content: 'Your tactical cockpit: Active Epics (top-left) with Dual Progress meters, Explore Research (top-right), Next Actions backlog (bottom-left), and Today\'s Top-3 focus (bottom-right).',
    preferredPlacement: 'center'
  },
  {
    title: 'Explore 🔬 Research Panel',
    badge: '🔬 DISCOVERY FIRST',
    viewMode: 'overview',
    targetSelector: '[data-tour="explore-panel"]',
    content: 'Put hypotheses, questions, and notes here, sorted by staleness. Click any Explore card to synthesize concrete Next actions with AI!',
    preferredPlacement: 'left'
  },
  {
    title: 'Today\'s 🎯 Commitment (Max 3)',
    badge: '⭐ DAILY EXECUTION',
    viewMode: 'overview',
    targetSelector: '[data-tour="today-panel"]',
    content: 'Hold up to 3 high-priority actions for today. Pull directly from Next items or promote research steps with 1 click.',
    preferredPlacement: 'left'
  },
  {
    title: '✦ Local AI Co-Pilot & Diff Cards',
    badge: '🤖 ASSISTANT & SAFETY',
    viewMode: 'chat',
    targetSelector: '[data-tour="chat-view"]',
    content: 'Chat with your local AI co-pilot. Propose goals, auto-generate research topics, review interactive diff cards, edit proposed explore/next tasks, and confirm changes before anything touches your database.',
    preferredPlacement: 'center'
  }
]

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

export const InteractiveTour: React.FC = () => {
  const { isTourActive, stopTour, setViewMode, updateSettings, settings } = useAppContext()
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

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

  // Update target element coordinates
  const updateTargetPosition = useCallback(() => {
    const step = TOUR_STEPS[currentStepIdx]
    if (!step.targetSelector) {
      setTargetRect(null)
      return
    }

    const el = document.querySelector(step.targetSelector)
    if (el) {
      const r = el.getBoundingClientRect()
      // Add generous margin around element
      const padding = 6
      setTargetRect({
        top: Math.max(0, r.top - padding),
        left: Math.max(0, r.left - padding),
        width: r.width + padding * 2,
        height: r.height + padding * 2,
        bottom: r.bottom + padding,
        right: r.right + padding
      })
    } else {
      setTargetRect(null)
    }
  }, [currentStepIdx])

  // Measure after view mode switch & DOM render
  useEffect(() => {
    if (!isTourActive) return
    updateTargetPosition()

    // Re-check after view animation/render
    const timer1 = setTimeout(updateTargetPosition, 80)
    const timer2 = setTimeout(updateTargetPosition, 250)

    window.addEventListener('resize', updateTargetPosition)
    window.addEventListener('scroll', updateTargetPosition, true)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      window.removeEventListener('resize', updateTargetPosition)
      window.removeEventListener('scroll', updateTargetPosition, true)
    }
  }, [isTourActive, currentStepIdx, updateTargetPosition])

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

  // Initialize on tour start
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

  // Compute card position based on target rect and preferred placement
  const getCardStyle = (): React.CSSProperties => {
    const cardWidth = 460
    const cardHeight = 220
    const margin = 16

    if (!targetRect || step.preferredPlacement === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${cardWidth}px`,
        zIndex: 10001
      }
    }

    let top = 0
    let left = 0

    if (step.preferredPlacement === 'bottom') {
      top = Math.min(window.innerHeight - cardHeight - margin, targetRect.bottom + 12)
      left = Math.max(margin, Math.min(window.innerWidth - cardWidth - margin, targetRect.left + (targetRect.width - cardWidth) / 2))
    } else if (step.preferredPlacement === 'top') {
      top = Math.max(margin, targetRect.top - cardHeight - 12)
      left = Math.max(margin, Math.min(window.innerWidth - cardWidth - margin, targetRect.left + (targetRect.width - cardWidth) / 2))
    } else if (step.preferredPlacement === 'left') {
      // Place to the left if space exists, otherwise inside or to the right
      if (targetRect.left > cardWidth + margin + 12) {
        left = targetRect.left - cardWidth - 16
        top = Math.max(margin, Math.min(window.innerHeight - cardHeight - margin, targetRect.top + (targetRect.height - cardHeight) / 2))
      } else {
        // Fallback below or centered inside
        top = Math.min(window.innerHeight - cardHeight - margin, targetRect.bottom - cardHeight - 20)
        left = Math.max(margin, targetRect.left + 20)
      }
    } else if (step.preferredPlacement === 'right') {
      if (window.innerWidth - targetRect.right > cardWidth + margin + 12) {
        left = targetRect.right + 16
        top = Math.max(margin, Math.min(window.innerHeight - cardHeight - margin, targetRect.top + (targetRect.height - cardHeight) / 2))
      } else {
        top = Math.min(window.innerHeight - cardHeight - margin, targetRect.bottom - cardHeight - 20)
        left = Math.max(margin, targetRect.left + 20)
      }
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      zIndex: 10001,
      transition: 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-auto overflow-hidden">
      {/* SVG Spotlight Mask: Dimmed outside, 100% CLEAR inside cutout (no blur on background) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300">
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White covers entire screen = darkened area */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black rectangle cutout = 100% transparent/clear window to focused element */}
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                ry="14"
                fill="black"
                className="transition-all duration-300"
              />
            )}
          </mask>
        </defs>

        {/* Backdrop overlay filled with mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Click backdrop to exit */}
      <div 
        className="absolute inset-0 cursor-pointer"
        onClick={handleExit}
      />

      {/* Spotlight Glowing Ring around target */}
      {targetRect && (
        <div
          className="absolute pointer-events-none border-2 border-amber-400/80 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.4),inset_0_0_12px_rgba(251,191,36,0.2)] transition-all duration-300 animate-pulse"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            zIndex: 10000
          }}
        />
      )}

      {/* Dynamic Floating Guide Card */}
      <div 
        ref={cardRef}
        style={getCardStyle()}
        className="bg-[#0e1320]/95 border border-white/[0.25] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-5 text-slate-100 flex flex-col gap-3.5"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {step.badge}
          </span>
          <span className="text-xs font-mono text-slate-400">
            Step <strong className="text-amber-400">{currentStepIdx + 1}</strong> of {TOUR_STEPS.length}
          </span>
        </div>

        {/* Title & Body */}
        <div className="space-y-1.5">
          <h3 className="font-serif text-lg font-bold text-slate-100">
            {step.title}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {step.content}
          </p>
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center gap-1.5 pt-0.5">
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
        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.10]">
          <button
            type="button"
            onClick={handleExit}
            className="text-xs font-mono text-slate-400 hover:text-slate-200 px-1.5 py-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Skip (Esc)
          </button>

          <div className="flex items-center gap-2">
            {currentStepIdx > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.12] transition-colors cursor-pointer"
              >
                ◂ Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 text-xs font-mono font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_2px_12px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{isLast ? 'Finish 🚀' : 'Next ▸'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
