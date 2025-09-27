import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

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

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
)

const ONBOARDING_STORAGE_KEY = 'bvx-onboarding-state'

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({})
  const [isOnboardingEnabled, setOnboardingEnabled] = useState(true)

  // Load onboarding state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (!saved) return
      const parsedState = JSON.parse(saved) as {
        pages?: OnboardingState
        enabled?: boolean
      }
      if (parsedState.pages) {
        setOnboardingState(parsedState.pages)
      }
      if (typeof parsedState.enabled === 'boolean') {
        setOnboardingEnabled(parsedState.enabled)
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error)
    }
  }, [])

  // Save onboarding state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = JSON.stringify({
      pages: onboardingState,
      enabled: isOnboardingEnabled,
    })
    localStorage.setItem(ONBOARDING_STORAGE_KEY, stateToSave)
  }, [onboardingState, isOnboardingEnabled])

  const hasSeenOnboarding = useCallback(
    (pageId: string): boolean => onboardingState[pageId] === true,
    [onboardingState],
  )

  const markOnboardingComplete = useCallback((pageId: string): void => {
    setOnboardingState(prev => ({
      ...prev,
      [pageId]: true,
    }))
  }, [])

  const resetOnboarding = useCallback((): void => {
    setOnboardingState({})
    setOnboardingEnabled(true)
  }, [])

  const value = useMemo<OnboardingContextType>(
    () => ({
      hasSeenOnboarding,
      markOnboardingComplete,
      resetOnboarding,
      isOnboardingEnabled,
      setOnboardingEnabled,
    }),
    [
      hasSeenOnboarding,
      markOnboardingComplete,
      resetOnboarding,
      isOnboardingEnabled,
    ],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}
