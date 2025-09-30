// @ts-nocheck
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import bvxLogo from '../assets/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'

interface SplashScreenProps {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showTagline, setShowTagline] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const taglineTimer = setTimeout(() => {
      setShowTagline(true)
    }, 800)

    const exitTimer = setTimeout(() => {
      setIsExiting(true)
      onComplete() // Call immediately when exiting starts
    }, 1500)

    return () => {
      clearTimeout(taglineTimer)
      clearTimeout(exitTimer)
    }
  }, [onComplete])

  return (
    <motion.div
      className="fixed inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent flex items-center justify-center z-50"
      style={{ pointerEvents: 'none' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute -bottom-24 -left-24 w-72 h-72 bg-white/5 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      <div className="text-center z-10">
        {/* Logo Container */}
        <motion.div
          className="mb-8"
          initial={{ scale: 0, opacity: 0, y: 50 }}
          animate={{ 
            scale: isExiting ? 1.1 : 1, 
            opacity: 1, 
            y: 0 
          }}
          transition={{ 
            duration: 0.8, 
            ease: "easeOut",
            delay: 0.2
          }}
        >
          <motion.div
            className="relative"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {/* Glow Effect */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-white/20 blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Logo */}
            <motion.img
              src={bvxLogo}
              alt="BVX Logo"
              className="relative h-32 w-auto object-contain mx-auto drop-shadow-2xl"
              animate={{
                filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <motion.h1
            className="text-5xl font-bold text-white mb-2"
            style={{ fontFamily: 'Playfair Display, serif' }}
            animate={{
              textShadow: [
                "0 0 20px rgba(255,255,255,0.5)",
                "0 0 30px rgba(255,255,255,0.8)",
                "0 0 20px rgba(255,255,255,0.5)"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            BVX
          </motion.h1>
          
          <motion.p
            className="text-xl text-white/90"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            Beauty Vision Excellence
          </motion.p>
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: showTagline ? 1 : 0, 
            y: showTagline ? 0 : 20 
          }}
          transition={{ duration: 0.6 }}
        >
          <motion.p
            className="text-lg text-white/80 max-w-md mx-auto"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Empowering beauty professionals with AI-driven insights and tools
          </motion.p>
        </motion.div>

        {/* Loading Animation */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <div className="flex items-center justify-center space-x-2">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-3 h-3 bg-white/60 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          
          <motion.p
            className="text-white/70 text-sm mt-4"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            Loading your dashboard...
          </motion.p>
        </motion.div>
      </div>

      {/* Shimmer Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "linear"
        }}
      />
    </motion.div>
  )
}
