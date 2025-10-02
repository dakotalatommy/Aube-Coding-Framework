import { useState, useEffect, useRef } from 'react'
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
  const [videoError, setVideoError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

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
    console.error('[landing-intro] Video src:', videoSrc)
    console.error('[landing-intro] Video element:', videoRef.current)

    setVideoError(true)

    // Set flag anyway to prevent infinite retry loops
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}

    // Notify parent component that animation is complete
    if (onComplete) {
      onComplete()
    }
  }

  // Add user interaction fallback for autoplay policies
  useEffect(() => {
    if (!videoRef.current || videoError) return

    const video = videoRef.current
    console.log('[landing-intro] Video element ready, current state:', {
      paused: video.paused,
      readyState: video.readyState,
      src: video.src
    })

    // Try to play on user interaction
    const playOnInteraction = () => {
      if (video.paused) {
        video.play().then(() => {
          console.log('[landing-intro] Video started playing on user interaction')
        }).catch((error) => {
          console.warn('[landing-intro] Failed to play video on user interaction:', error)
        })
      }
      document.removeEventListener('click', playOnInteraction)
      document.removeEventListener('touchstart', playOnInteraction)
    }

    document.addEventListener('click', playOnInteraction)
    document.addEventListener('touchstart', playOnInteraction)

    return () => {
      document.removeEventListener('click', playOnInteraction)
      document.removeEventListener('touchstart', playOnInteraction)
    }
  }, [videoError])

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
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onError={handleVideoError}
        onLoadedData={() => {
          console.log('[landing-intro] Video loaded successfully')
          // Try to play immediately when loaded
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().then(() => {
              console.log('[landing-intro] Video started playing on load')
            }).catch((error) => {
              console.warn('[landing-intro] Failed to play video on load:', error)
            })
          }
        }}
        className="w-full h-full object-cover"
        style={{
          width: '100vw',
          height: '100vh',
        }}
        src={videoSrc}
      />

      {/* Fallback content if video fails to load */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white">
            <p className="mb-4">Welcome to BrandVX</p>
            <button
              onClick={() => {
                try {
                  localStorage.setItem(STORAGE_KEY, '1')
                } catch {}
                if (onComplete) onComplete()
              }}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Continue to BrandVX
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
