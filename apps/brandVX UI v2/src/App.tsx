import { useState, lazy, Suspense } from 'react'
import { Crown } from 'lucide-react'
import { DashboardHeader } from './components/dashboard-header'
import { SidebarNav } from './components/sidebar-nav'
import { StatsCards } from './components/stats-cards'
import { ReferralBanner } from './components/referral-banner'
import { QuickstartAgenda } from './components/quickstart-agenda'
import { ClientsPreview } from './components/clients-preview'
import { ClientReminders } from './components/client-reminders'
import { SplashScreen } from './components/splash-screen'
import { SignIn } from './components/sign-in'
import { SignUp } from './components/sign-up'
import { Onboarding } from './components/onboarding'
import { TrialBanner } from './components/trial-banner'
import { LockedFeaturesOverlay } from './components/locked-features-overlay'
import { LockedFeatureMockup } from './components/locked-feature-mockup'
import { AgendaProvider } from './components/agenda-context'
import { ClientRemindersProvider } from './components/client-reminders-context'
import { OnboardingProvider } from './components/onboarding-context'
import { OnboardingTooltip } from './components/onboarding-tooltip'
import { Toaster } from './components/ui/sonner'

// Lazy load heavy components
const AskVX = lazy(() => import('./components/askvx').then(m => ({ default: m.AskVX })))
const BrandVZN = lazy(() => import('./components/brandvzn').then(m => ({ default: m.BrandVZN })))
const ConsultationResults = lazy(() => import('./components/consultation-results').then(m => ({ default: m.ConsultationResults })))
const Messages = lazy(() => import('./components/messages').then(m => ({ default: m.Messages })))
const Clients = lazy(() => import('./components/clients').then(m => ({ default: m.Clients })))
const Agenda = lazy(() => import('./components/agenda').then(m => ({ default: m.Agenda })))
const FollowUps = lazy(() => import('./components/follow-ups').then(m => ({ default: m.FollowUps })))
const GrowYourList = lazy(() => import('./components/grow-your-list').then(m => ({ default: m.default })))

const Inventory = lazy(() => import('./components/inventory').then(m => ({ default: m.Inventory })))
const Tutorials = lazy(() => import('./components/tutorials').then(m => ({ default: m.Tutorials })))
const Settings = lazy(() => import('./components/settings').then(m => ({ default: m.Settings })))
const GrowWithVX = lazy(() => import('./components/grow-with-vx'))

const USER_PROFILE = {
  firstName: "Sarah",
  businessName: "Elegant Beauty Studio", 
  role: "Owner",
  profession: "Cosmetologist"
}

// Trial and subscription management
const TRIAL_LENGTH = 7 // days
const getCurrentTrialDay = () => {
  // In a real app, this would be calculated from signup date
  // For demo purposes, simulate trial completed (day 8 = past trial)
  return 8
}

const isTrialUser = (userData?: any) => {
  // Check if user is on trial (no paid plan)
  return !userData?.plan || userData?.plan === 'trial'
}

const hasAccessToFeature = (featureName: string, userData?: any) => {
  if (!isTrialUser(userData)) {
    const plan = userData?.plan || 'essentials'
    
    // Feature access by plan
    const featureAccess = {
      'grow-your-list': ['pro', 'premium'],
      'grow-with-vx': ['pro', 'premium'],
      'inventory': ['pro', 'premium'],
      'tutorials': ['essentials', 'pro', 'premium']
    }
    
    return featureAccess[featureName]?.includes(plan) ?? true
  }
  
  // Trial users can't access premium features
  const trialRestrictedFeatures = ['grow-your-list', 'grow-with-vx']
  return !trialRestrictedFeatures.includes(featureName)
}

interface ConsultationData {
  beforeImageUrl: string
  afterImageUrl: string
  promptText: string
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

function DashboardContent({ onViewAgenda, userData, currentTrialDay, onUpgrade }: { onViewAgenda: () => void, userData?: any, currentTrialDay?: number, onUpgrade: () => void }) {
  // Use personalized data if available, otherwise fall back to defaults
  const displayName = userData?.fullName ? userData.fullName.split(' ')[0] : USER_PROFILE.firstName
  const businessName = userData?.businessName || USER_PROFILE.businessName
  const profession = userData?.jobTitle || USER_PROFILE.profession
  const showTrialBanner = isTrialUser(userData)
  
  return (
    <div className="space-y-6">
      {/* Trial Banner - only show for trial users */}
      {showTrialBanner && currentTrialDay && (
        <TrialBanner 
          currentDay={currentTrialDay} 
          totalDays={TRIAL_LENGTH}
          onUpgrade={onUpgrade}
        />
      )}
      
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
          Welcome back, {displayName}
        </h2>
        <div className="flex items-center space-x-2 mb-2">
          <p className="text-lg font-medium text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
            {businessName}
          </p>
          <span className="text-muted-foreground">•</span>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            {profession}
          </p>
          {userData?.plan && (userData.plan === 'pro' || userData.plan === 'premium') && (
            <>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center space-x-1">
                <Crown className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary uppercase">
                  {userData.plan} Member
                </span>
              </div>
            </>
          )}
        </div>
        <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {!showTrialBanner ? 'Here\'s what\'s happening with your beauty business today.' : 'Here\'s what\'s happening with your beauty business today.'}
        </p>
      </div>
      
      <StatsCards />
      <ReferralBanner />
      <QuickstartAgenda onViewFullAgenda={onViewAgenda} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientsPreview />
        <ClientReminders />
      </div>
    </div>
  )
}



type AuthState = 'signIn' | 'signUp' | 'onboarding' | 'authenticated'

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('signIn')
  const [showSplash, setShowSplash] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [consultationData, setConsultationData] = useState<ConsultationData | null>(null)
  const [userData, setUserData] = useState<any>({
    fullName: "Sarah Johnson",
    businessName: "Elegant Beauty Studio",
    jobTitle: "Master Cosmetologist & Owner", 
    plan: "pro",
    email: "sarah@elegantbeauty.com",
    phone: "(555) 123-4567",
    subscriptionDate: "2024-11-15",
    billingCycle: "monthly"
  })
  const [settingsInitialTab, setSettingsInitialTab] = useState('onboarding')
  
  // Trial management
  const [currentTrialDay] = useState(getCurrentTrialDay())
  const userIsOnTrial = isTrialUser(userData)

  const handleConsultationGenerated = (data: ConsultationData) => {
    setConsultationData(data)
    setCurrentPage('consultation-results')
  }

  const handleBackToConsultation = () => {
    setCurrentPage('brandvzn')
  }

  const handleNewConsultation = () => {
    setConsultationData(null)
    setCurrentPage('brandvzn')
  }

  const handleNotificationClick = () => {
    setCurrentPage('agenda')
  }

  const handleViewAgenda = () => {
    setCurrentPage('agenda')
  }

  const handleSplashComplete = () => {
    setShowSplash(false)
  }

  const handleSignIn = () => {
    setAuthState('authenticated')
  }

  const handleSignUp = () => {
    setAuthState('signUp')
  }

  const handleBackToSignIn = () => {
    setAuthState('signIn')
  }

  const handleSignUpComplete = (newUserData: any) => {
    setUserData(newUserData)
    setAuthState('onboarding')
  }

  const handleOnboardingComplete = (completeUserData: any) => {
    setUserData(completeUserData)
    setAuthState('authenticated')
  }

  const handleUpgrade = () => {
    setSettingsInitialTab('plan')
    setCurrentPage('settings')
  }

  const handleNavigateToSettings = () => {
    setSettingsInitialTab('profile')
  }

  const renderPageContent = () => {
    const commonProps = {
      onConsultationGenerated: handleConsultationGenerated,
      onBackToConsultation: handleBackToConsultation,
      onNewConsultation: handleNewConsultation
    }

    switch (currentPage) {
      case 'askvx':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <AskVX />
          </Suspense>
        )
      
      case 'brandvzn':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <BrandVZN onConsultationGenerated={handleConsultationGenerated} />
          </Suspense>
        )
      
      case 'consultation-results':
        if (!consultationData) {
          return <DashboardContent onViewAgenda={handleViewAgenda} userData={userData} currentTrialDay={currentTrialDay} onUpgrade={handleUpgrade} />
        }
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ConsultationResults
              beforeImageUrl={consultationData.beforeImageUrl}
              afterImageUrl={consultationData.afterImageUrl}
              promptText={consultationData.promptText}
              onBackToConsultation={handleBackToConsultation}
              onNewConsultation={handleNewConsultation}
            />
          </Suspense>
        )
      
      case 'messages':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Messages />
          </Suspense>
        )
      
      case 'clients':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Clients />
          </Suspense>
        )
      
      case 'agenda':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Agenda />
          </Suspense>
        )
      
      case 'follow-ups':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <FollowUps />
          </Suspense>
        )
      
      case 'grow-your-list':
        if (!hasAccessToFeature('grow-your-list', userData)) {
          return (
            <LockedFeaturesOverlay
              title="Fill Your Chair"
              description="Create stunning landing pages and link-in-bio tools to capture leads from social media and turn followers into paying clients."
              benefits={[
                "Professional landing page builder with beauty-focused templates",
                "Customizable link-in-bio tool with booking integration", 
                "Lead capture forms with automated follow-up sequences",
                "Social media integration for Instagram, TikTok, and Facebook",
                "Analytics dashboard to track clicks, conversions, and ROI",
                "Mobile-optimized pages that convert visitors into bookings"
              ]}
              mockupContent={<LockedFeatureMockup type="fill-your-chair" />}
              onUpgrade={handleUpgrade}
            />
          )
        }
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <GrowYourList />
          </Suspense>
        )
      
      case 'grow-with-vx':
        if (!hasAccessToFeature('grow-with-vx', userData)) {
          return (
            <LockedFeaturesOverlay
              title="Grow with VX"
              description="Advanced marketing automation and growth strategies designed specifically for beauty professionals to scale their business."
              benefits={[
                "Automated email marketing campaigns for client retention",
                "Social media content calendar with beauty-focused templates",
                "Client lifecycle automation (welcome series, follow-ups, winback)",
                "Advanced analytics and business intelligence dashboard",
                "Personalized growth recommendations based on your business data",
                "Integration with popular beauty booking and POS systems"
              ]}
              mockupContent={<LockedFeatureMockup type="grow-with-vx" />}
              onUpgrade={handleUpgrade}
            />
          )
        }
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <GrowWithVX />
          </Suspense>
        )
      
      case 'inventory':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Inventory />
          </Suspense>
        )
      
      case 'tutorials':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Tutorials />
          </Suspense>
        )
      
      case 'settings':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Settings userData={userData} initialTab={settingsInitialTab} />
          </Suspense>
        )
      
      default:
        return <DashboardContent onViewAgenda={handleViewAgenda} userData={userData} currentTrialDay={currentTrialDay} onUpgrade={handleUpgrade} />
    }
  }

  // Handle authentication flow
  if (authState === 'signIn') {
    return <SignIn onSignIn={handleSignIn} onSignUp={handleSignUp} />
  }

  if (authState === 'signUp') {
    return <SignUp onSignUp={handleSignUpComplete} onBackToSignIn={handleBackToSignIn} />
  }

  if (authState === 'onboarding') {
    return <Onboarding userData={userData} onComplete={handleOnboardingComplete} />
  }

  // Show splash screen after sign-in
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  return (
    <OnboardingProvider>
      <ClientRemindersProvider>
        <AgendaProvider>
          <div className="min-h-screen bg-background flex">
            <SidebarNav 
              currentPage={currentPage} 
              setCurrentPage={setCurrentPage} 
              userData={userData} 
              onNavigateToSettings={handleNavigateToSettings}
            />
            
            <div className="flex-1 flex flex-col">
              <DashboardHeader onNotificationClick={handleNotificationClick} userData={userData} />
              
              <main className="flex-1 p-6">
                {renderPageContent()}
              </main>
            </div>
          </div>
          
          {/* Onboarding Tooltips for each page */}
          {(() => {
            // Map page names to onboarding IDs
            const getOnboardingPageId = (page: string) => {
              const pageMap: Record<string, string> = {
                'grow-your-list': 'grow-your-list',
                'grow-with-vx': 'grow-with-vx', 
                'follow-ups': 'follow-ups',
                'consultation-results': 'brandvzn', // consultation results are part of brandvzn
                default: page
              }
              return pageMap[page] || page
            }
            
            return <OnboardingTooltip pageId={getOnboardingPageId(currentPage) as any} />
          })()}
          
          <Toaster />
        </AgendaProvider>
      </ClientRemindersProvider>
    </OnboardingProvider>
  )
}