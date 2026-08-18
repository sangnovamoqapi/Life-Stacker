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
  const { viewMode, modalType, selectedItemId, selectedSectorId, settings } = useAppContext()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const cameraVideoRef = React.useRef<HTMLVideoElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Video background controller
  React.useEffect(() => {
    if (settings.background_config?.type === 'video' && videoRef.current) {
      videoRef.current.load()
      if (prefersReducedMotion) {
        videoRef.current.pause()
      } else {
        videoRef.current.play().catch(() => {})
      }
    }
  }, [prefersReducedMotion, settings.background_config?.type, settings.background_config?.value])

  // Live camera background stream controller
  React.useEffect(() => {
    let activeStream: MediaStream | null = null
    let isCancelled = false

    if (settings.background_config?.type === 'camera') {
      const targetDeviceId = settings.background_config.value && settings.background_config.value !== 'default' 
        ? { exact: settings.background_config.value } 
        : undefined

      navigator.mediaDevices.getUserMedia({
        video: targetDeviceId ? { deviceId: targetDeviceId } : true,
        audio: false
      }).then(stream => {
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        activeStream = stream
        setCameraStream(stream)
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          cameraVideoRef.current.play().catch(() => {})
        }
      }).catch(err => {
        console.error('Camera access error:', err)
      })
    } else {
      setCameraStream(null)
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }
    }

    return () => {
      isCancelled = true
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop())
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }
    }
  }, [settings.background_config?.type, settings.background_config?.value])

  // Re-attach camera stream to video element if mounted/changed
  React.useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream
      cameraVideoRef.current.play().catch(() => {})
    }
  }, [cameraStream])

  const getFileUri = (p: string) => `media://app/${encodeURIComponent(p)}`

  // Amendment 6: Linked glass scale (dynamic evaluation on root)
  const intensity = typeof settings.glass_intensity === 'number' ? settings.glass_intensity : 65
  const opacity = Number((0.85 + (intensity / 100) * (0.35 - 0.85)).toFixed(3))
  const blurPx = Number((4 + (intensity / 100) * (24 - 4)).toFixed(1))

  return (
    <div 
      className="h-screen w-screen flex flex-col overflow-hidden relative"
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
        {settings.background_config?.type === 'camera' ? (
          <video 
            key="camera-bg"
            ref={cameraVideoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : settings.background_config?.type === 'video' ? (
          <video 
            key={`video-${settings.background_config.value}`}
            ref={videoRef}
            src={getFileUri(settings.background_config.value)} 
            autoPlay 
            loop 
            muted 
            playsInline
            onEnded={(e) => {
              const v = e.currentTarget
              v.currentTime = 0
              v.play().catch(() => {})
            }}
            className="w-full h-full object-cover"
          />
        ) : settings.background_config?.type === 'image' ? (
          <div 
            key={`image-${settings.background_config.value}`}
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url("${getFileUri(settings.background_config.value)}")` }}
          />
        ) : (
          <div 
            key="gradient-bg"
            className="w-full h-full"
            style={{ background: settings.background_config?.value || 'radial-gradient(ellipse 800px 500px at 15% 10%, #2a2416 0%, transparent 60%), radial-gradient(ellipse 700px 600px at 85% 90%, #1a2b26 0%, transparent 60%), #0b0b0d' }}
          />
        )}

        {/* Readability tint overlay over user media */}
        {(settings.background_config?.type === 'image' || settings.background_config?.type === 'video' || settings.background_config?.type === 'camera') && (
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
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

        {modalType === 'item' && <ItemModal key={selectedItemId || 'new-item'} />}
        {modalType === 'sector' && <SectorModal key={selectedSectorId || 'new-sector'} />}
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
