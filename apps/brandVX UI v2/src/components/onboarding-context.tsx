import React, { createContext, useContext, useState, useEffect } from 'react'

interface OnboardingState {
  [key: string]: boolean
}

interface OnboardingContextType {
  hasSeenOnboarding: (pageId: string) => boolean
  markOnboardingComplete: (pageId: string) => void
  resetOnboarding: () => void
  isOnboardingEnabled: boolean
  setOnboardingEnabled: (enabled: boolean) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

const ONBOARDING_STORAGE_KEY = 'bvx-onboarding-state'

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({})
  const [isOnboardingEnabled, setOnboardingEnabled] = useState(true)

  // Load onboarding state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (saved) {
      try {
        const parsedState = JSON.parse(saved)
        setOnboardingState(parsedState.pages || {})
        setOnboardingEnabled(parsedState.enabled !== false)
      } catch (error) {
        console.error('Failed to load onboarding state:', error)
      }
    }
  }, [])

  // Save onboarding state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      pages: onboardingState,
      enabled: isOnboardingEnabled
    }
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(stateToSave))
  }, [onboardingState, isOnboardingEnabled])

  const hasSeenOnboarding = (pageId: string): boolean => {
    return onboardingState[pageId] === true
  }

  const markOnboardingComplete = (pageId: string): void => {
    setOnboardingState(prev => ({
      ...prev,
      [pageId]: true
    }))
  }

  const resetOnboarding = (): void => {
    setOnboardingState({})
    setOnboardingEnabled(true)
  }

  const value: OnboardingContextType = {
    hasSeenOnboarding,
    markOnboardingComplete,
    resetOnboarding,
    isOnboardingEnabled,
    setOnboardingEnabled
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}