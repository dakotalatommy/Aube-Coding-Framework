import { useState } from 'react'
import videoSrc from '../assets/bc774d74-ce53-4f05-a3cc-64cf6cf48465.mp4?url'

const STORAGE_KEY = 'bvx_landing_intro_shown'

interface LandingIntroAnimationProps {
  onComplete?: () => void
}

export default function LandingIntroAnimation({ onComplete }: LandingIntroAnimationProps) {
  console.log('[landing-intro] Component mounting')
  
  // Check localStorage immediately during initialization to prevent flash
  const [shouldShow] = useState(() => {
    const hasSeenIntro = localStorage.getItem(STORAGE_KEY)
    const show = !hasSeenIntro
    console.log('[landing-intro] Initial check - should show:', show)
    return show
  })
  
  const [fadeOut, setFadeOut] = useState(false)

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    const timeRemaining = video.duration - video.currentTime
    
    // Start fade-out 1 second before video ends
    if (timeRemaining <= 1 && !fadeOut) {
      console.info('[landing-intro] Near end, starting fade-out')
      setFadeOut(true)
      
      // Set localStorage flag and notify parent after fade completes
      setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, '1')
          console.info('[landing-intro] Flag set, animation will not show again')
        } catch (error) {
          console.warn('[landing-intro] Failed to set localStorage flag', error)
        }
        
        // Notify parent component that animation is complete
        if (onComplete) {
          onComplete()
        }
      }, 500)
    }
  }

  const handleVideoError = (error: any) => {
    console.error('[landing-intro] Video failed to load', error)
    
    // Set flag anyway to prevent infinite retry loops
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    
    // Component will unmount on next render when shouldShow check runs
  }

  // Don't render anything if animation shouldn't show
  if (!shouldShow) {
    return null
  }
  
  console.log('[landing-intro] Rendering video with src:', videoSrc)

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 99999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        backgroundColor: 'transparent',
      }}
    >
      <video
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onError={handleVideoError}
        className="w-full h-full object-cover"
        style={{
          width: '100vw',
          height: '100vh',
        }}
        src={videoSrc}
      />
    </div>
  )
}
