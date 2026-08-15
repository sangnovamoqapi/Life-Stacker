import React, { useRef, useEffect, useState } from 'react'
import { useAppContext } from '../state/AppContext'
import { Lane } from '../components/Lane'
import { FocusStrip } from '../components/FocusStrip'

export const LanesView: React.FC = () => {
  const { sectors, openSectorModal } = useAppContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 10)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sectors.length])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FocusStrip />
      <div 
        ref={containerRef}
        className={`flex-1 flex gap-4 overflow-x-auto px-6 pb-6 items-start lanes-container ${hasOverflow ? 'has-overflow' : ''}`}
      >
        {sectors.map(sector => (
          <Lane key={sector.id} sector={sector} />
        ))}
        
        <button 
          onClick={() => openSectorModal(null)}
          className="w-[280px] shrink-0 h-24 border-2 border-dashed rounded-lg text-ink-dim hover:text-ink transition-colors flex items-center justify-center font-serif text-lg"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          + New Sector
        </button>
      </div>
    </div>
  )
}
