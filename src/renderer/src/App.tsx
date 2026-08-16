import React from 'react'
import { AppProvider, useAppContext } from './state/AppContext'
import { TopBar } from './components/TopBar'
import { LanesView } from './views/LanesView'
import { OverviewView } from './views/OverviewView'
import { SettingsView } from './views/SettingsView'
import { StatsView } from './views/StatsView'
import { ItemModal } from './components/ItemModal'
import { SectorModal } from './components/SectorModal'
import { ChecklistEffortModal } from './components/ChecklistEffortModal'
import { Toast } from './components/Toast'

const MainContent: React.FC = () => {
  const { viewMode, modalType, settings } = useAppContext()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  React.useEffect(() => {
    if (videoRef.current) {
      if (prefersReducedMotion) {
        videoRef.current.pause()
      } else {
        videoRef.current.play().catch(() => {})
      }
    }
  }, [prefersReducedMotion, settings.background_config])

  const getFileUri = (p: string) => `media://${encodeURIComponent(p)}`

  // Amendment 6: Linked glass scale (dynamic evaluation on root)
  const intensity = typeof settings.glass_intensity === 'number' ? settings.glass_intensity : 65
  const opacity = Number((0.85 + (intensity / 100) * (0.35 - 0.85)).toFixed(3))
  const blurPx = Number((4 + (intensity / 100) * (24 - 4)).toFixed(1))

  return (
    <div 
      className="h-screen w-screen flex flex-col overflow-hidden relative selection:bg-active-dim selection:text-ink"
      style={{
        '--glass-opacity': opacity,
        '--glass-blur-px': `${blurPx}px`,
        '--glass-bg': `rgba(18, 23, 34, ${opacity})`,
        '--glass-blur': `blur(${blurPx}px)`,
        '--glass-border': 'rgba(255, 255, 255, 0.09)'
      } as React.CSSProperties}
    >
      {/* Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {settings.background_config?.type === 'video' ? (
          <video 
            ref={videoRef}
            src={getFileUri(settings.background_config.value)} 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-cover"
          />
        ) : settings.background_config?.type === 'image' ? (
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url("${getFileUri(settings.background_config.value)}")` }}
          />
        ) : (
          <div 
            className="w-full h-full"
            style={{ background: settings.background_config?.value || 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' }}
          />
        )}

        {/* Readability tint overlay over user media */}
        {(settings.background_config?.type === 'image' || settings.background_config?.type === 'video') && (
          <div className="absolute inset-0 bg-black/15 pointer-events-none" />
        )}

        {/* Ambient glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-lane-bg rounded-full blur-[120px] pointer-events-none opacity-40" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-card rounded-full blur-[100px] pointer-events-none opacity-20" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        <TopBar />
        
        {viewMode === 'lanes' && <LanesView />}
        {viewMode === 'overview' && <OverviewView />}
        {viewMode === 'settings' && <SettingsView />}
        {viewMode === 'stats' && <StatsView />}

        {modalType === 'item' && <ItemModal />}
        {modalType === 'sector' && <SectorModal />}
        <ChecklistEffortModal />
        
        <Toast />
      </div>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  )
}

export default App
