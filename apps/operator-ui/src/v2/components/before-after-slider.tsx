// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import { ImageWithFallback } from './figma/ImageWithFallback'

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  beforeAlt?: string
  afterAlt?: string
  className?: string
}

export function BeforeAfterSlider({ 
  beforeImage, 
  afterImage, 
  beforeAlt = "Before", 
  afterAlt = "After",
  className = ""
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const updateSliderPosition = (clientX: number) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percentage)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    updateSliderPosition(e.clientX)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    updateSliderPosition(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    updateSliderPosition(e.touches[0].clientX)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    updateSliderPosition(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging])

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg cursor-ew-resize select-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* After Image (Background) */}
      <div className="w-full h-full">
        <ImageWithFallback 
          src={afterImage}
          alt={afterAlt}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Before Image (Overlay) */}
      <div 
        className="absolute top-0 left-0 h-full overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <ImageWithFallback 
          src={beforeImage}
          alt={beforeAlt}
          className="w-full h-full object-cover"
          style={{ width: `${100 * (100 / sliderPosition)}%` }}
        />
      </div>

      {/* Slider Line */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        {/* Slider Handle */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg border-2 border-primary flex items-center justify-center">
          <div className="flex space-x-0.5">
            <div className="w-0.5 h-4 bg-primary rounded"></div>
            <div className="w-0.5 h-4 bg-primary rounded"></div>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-sm font-medium">
        {beforeAlt}
      </div>
      <div className="absolute top-4 right-4 bg-black/70 text-white px-2 py-1 rounded text-sm font-medium">
        {afterAlt}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-xs">
        Drag to compare
      </div>
    </div>
  )
}