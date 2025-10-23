import { useCallback, useEffect, useState, useRef, lazy, Suspense } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './styles/globals.css'
import { Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { api, getTenant, setCachedAccessToken } from '../lib/api'
import { DashboardHeader } from './components/dashboard-header'
import { SidebarNav } from './components/sidebar-nav'
import { StatsCards } from './components/stats-cards'
import type { DashboardStat } from './components/stats-cards'
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
import LandingV2 from './components/landing-page'
import { AuthCallback } from './components/auth-callback'
import LandingIntroAnimation from '../components/LandingIntroAnimation'
import SupportBubble from '../components/SupportBubble'
import type { DashboardAgendaItem, DashboardClientPreviewItem, DashboardReminderItem, DashboardReferralInfo } from './components/types/dashboard'

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
const GrowWithVX = lazy(() => import('./components/grow-with-vx').then(m => ({ default: m.GrowWithVX })))

type UserProfile = {
  fullName?: string
  businessName?: string
  jobTitle?: string
  plan?: string
  email?: string
  subscriptionStatus?: string
  trialEndTs?: number | null
  trialLengthDays?: number
}

const DEFAULT_PROFILE: Required<Pick<UserProfile, 'fullName' | 'businessName' | 'jobTitle'>> = {
  fullName: '',
  businessName: '',
  jobTitle: ''
}

const DEFAULT_TRIAL_LENGTH = 7

const isFounderTier = (profile?: UserProfile | null) => {
  if (!profile) return false
  const plan = (profile.plan || '').toLowerCase()
  return plan === 'founder_unlimited'
}

const isPaidTier = (profile?: UserProfile | null) => {
  if (!profile) return false
  // Founder tier is handled separately
  if (isFounderTier(profile)) return false
  const plan = (profile.plan || '').toLowerCase()
  const status = (profile.subscriptionStatus || '').toLowerCase()
  // Paid if they have pro/premium plan or active subscription status
  return (plan === 'pro' || plan === 'premium') || status === 'active'
}

const isTrialUser = (profile?: UserProfile | null) => {
  if (!profile) return true
  // Founder tier users are not trial users
  if (isFounderTier(profile)) return false
  // Paid users are not trial users
  if (isPaidTier(profile)) return false
  const status = (profile.subscriptionStatus || '').toLowerCase()
  if (status === 'trialing') return true
  return !profile.plan || profile.plan === 'trial' || profile.plan === 'essentials'
}

const hasAccessToFeature = (featureName: string, profile?: UserProfile | null) => {
  // Founder tier has access to everything
  if (isFounderTier(profile)) return true
  
  const plan = (profile?.plan || '').toLowerCase()
  const isLite = plan === 'lite' || plan.includes('lite')
  const isTrial = isTrialUser(profile)
  
  // Features gated for BOTH trial AND lite users
  const fullPlanFeatures = ['grow-your-list', 'grow-with-vx', 'follow-ups', 'inventory']
  if ((isTrial || isLite) && fullPlanFeatures.includes(featureName)) {
    return false
  }
  
  // For paid users (not lite, not trial), check specific access map
  if (!isTrial && !isLite) {
    const accessMap: Record<string, string[]> = {
      'grow-your-list': ['pro', 'premium', 'starter', 'growth'],
      'grow-with-vx': ['pro', 'premium', 'starter', 'growth'],
      inventory: ['pro', 'premium', 'starter', 'growth'],
      'follow-ups': ['pro', 'premium', 'starter', 'growth'],
      tutorials: ['essentials', 'pro', 'premium', 'starter', 'growth']
    }
    const allowed = accessMap[featureName]
    return allowed ? allowed.includes(plan) : true
  }
  
  return true
}

const computeTrialDay = (profile?: UserProfile | null): number | undefined => {
  if (!profile || !profile.trialEndTs) return undefined
  const total = profile.trialLengthDays ?? DEFAULT_TRIAL_LENGTH
  const nowMs = Date.now()
  const endMs = profile.trialEndTs * 1000
  const daysRemaining = Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000))
  const daysElapsed = Math.max(0, total - daysRemaining)
  return Math.min(total, Math.max(1, daysElapsed + 1))
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

function DashboardContent({
  onViewAgenda,
  userData,
  currentTrialDay,
  onUpgrade,
  stats,
  statsLoading,
  statsError,
  agendaItems,
  agendaLoading,
  clientsPreview,
  clientsLoading,
  reminders,
  remindersLoading,
  referral,
  referralLoading,
}: {
  onViewAgenda: () => void
  userData?: UserProfile | null
  currentTrialDay?: number
  onUpgrade: () => void
  stats?: DashboardStat[] | null
  statsLoading: boolean
  statsError?: string | null
  agendaItems?: DashboardAgendaItem[] | null
  agendaLoading: boolean
  clientsPreview?: DashboardClientPreviewItem[] | null
  clientsLoading: boolean
  reminders?: DashboardReminderItem[] | null
  remindersLoading: boolean
  referral?: DashboardReferralInfo | null
  referralLoading: boolean
}) {
  const rawName = (userData?.fullName || DEFAULT_PROFILE.fullName || '').trim()
  const firstName = rawName ? rawName.split(/\s+/)[0] : ''
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back'
  const businessName = (userData?.businessName || DEFAULT_PROFILE.businessName || '').trim()
  const profession = (userData?.jobTitle || DEFAULT_PROFILE.jobTitle || '').trim()
  const hasBusiness = Boolean(businessName)
  const hasProfession = Boolean(profession)
  const showTrialBanner = isTrialUser(userData)
  const isFounder = isFounderTier(userData)
  const isPaid = isPaidTier(userData)

  return (
    <div className="space-y-6">
      {(showTrialBanner && currentTrialDay) || isFounder || isPaid ? (
        <TrialBanner
          currentDay={currentTrialDay || 1}
          totalDays={userData?.trialLengthDays ?? DEFAULT_TRIAL_LENGTH}
          onUpgrade={onUpgrade}
          isFounderTier={isFounder}
          isPaidTier={isPaid}
          planName={userData?.plan || undefined}
        />
      ) : null}

      <div>
        <h2 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
          {greeting}
        </h2>
        {(hasBusiness || hasProfession || (userData?.plan && ['pro', 'premium', 'founder_unlimited'].includes(userData.plan.toLowerCase()))) && (
          <div className="flex items-center space-x-2 mb-2">
            {hasBusiness && (
              <p className="text-lg font-medium text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                {businessName}
              </p>
            )}
            {hasBusiness && hasProfession && <span className="text-muted-foreground">•</span>}
            {hasProfession && (
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {profession}
              </p>
            )}
            {userData?.plan && ['pro', 'premium'].includes(userData.plan.toLowerCase()) && (
              <>
                {(hasBusiness || hasProfession) && <span className="text-muted-foreground">•</span>}
                <div className="flex items-center space-x-1">
                  <Crown className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase">
                    {userData.plan} Member
                  </span>
                </div>
              </>
            )}
            {isFounder && (
              <>
                {(hasBusiness || hasProfession) && <span className="text-muted-foreground">•</span>}
                <div className="flex items-center space-x-1">
                  <Crown className="h-3 w-3 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">
                    Founder
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Here's what's happening with your beauty business today.
        </p>
      </div>

      <div className="space-y-2">
        <StatsCards stats={stats ?? undefined} loading={statsLoading} />
        {statsError && !statsLoading && (
          <p className="text-xs text-destructive">{statsError}</p>
        )}
      </div>
      <ReferralBanner referral={referral ?? undefined} loading={referralLoading} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientsPreview clients={clientsPreview ?? undefined} loading={clientsLoading} onViewAll={onViewAgenda} />
        <ClientReminders reminders={reminders ?? undefined} loading={remindersLoading} onViewAll={onViewAgenda} />
      </div>
      
      <QuickstartAgenda items={agendaItems ?? undefined} loading={agendaLoading} onViewFullAgenda={onViewAgenda} />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [userData, setUserData] = useState<UserProfile | null>(null)
  const [showSplash, setShowSplash] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const hasBootedRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)
  const bootstrappedUserIdRef = useRef<string | null>(null)
  const isInitialLoadRef = useRef(true)
  const [onboardingRequired, setOnboardingRequired] = useState(false)
  const [dashboardStats, setDashboardStats] = useState<DashboardStat[] | null>(null)
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false)
  const [dashboardStatsError, setDashboardStatsError] = useState<string | null>(null)
  const [agendaItems, setAgendaItems] = useState<DashboardAgendaItem[] | null>(null)
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [clientsPreview, setClientsPreview] = useState<DashboardClientPreviewItem[] | null>(null)
  const [clientsLoading, setClientsLoading] = useState(false)
  const [reminders, setReminders] = useState<DashboardReminderItem[] | null>(null)
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [referralInfo, setReferralInfo] = useState<DashboardReferralInfo | null>(null)
  const [referralLoading, setReferralLoading] = useState(false)

  const [currentPage, setCurrentPage] = useState('dashboard')
  const [consultationData, setConsultationData] = useState<ConsultationData | null>(null)
  const [currentTrialDay, setCurrentTrialDay] = useState<number | undefined>(undefined)
  const [showSplashGuard, setShowSplashGuard] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState('onboarding')
  const [clientSearchPrefill, setClientSearchPrefill] = useState<string | undefined>(undefined)
  const firstNavigationRef = useRef(true)
  const settingsPrefetchedRef = useRef(false)
  const isProfileLoading = Boolean(session && !userData)

  // Keep lastUserIdRef in sync with session for sign-out cleanup
  useEffect(() => {
    if (session?.user?.id) {
      lastUserIdRef.current = session.user.id
    }
  }, [session])

  // Session guard helpers using existing key format
  const getSessionSplashKey = (userId: string) => `bvx_splash_shown_${userId}`

  // Commented out - no longer using session-based splash tracking
  // const hasShownSplashThisSession = useCallback((userId: string): boolean => {
  //   try {
  //     return sessionStorage.getItem(getSessionSplashKey(userId)) === '1'
  //   } catch {
  //     return false
  //   }
  // }, [])

  // const markSplashShown = useCallback((userId: string) => {
  //   try {
  //     sessionStorage.setItem(getSessionSplashKey(userId), '1')
  //   } catch {}
  // }, [])

  const clearSplashGuard = useCallback((userId: string | null) => {
    if (!userId) return
    try {
      sessionStorage.removeItem(getSessionSplashKey(userId))
    } catch {}
  }, [])

  // Centralized navigation function that dispatches events for pane synchronization
  const navigateToPage = useCallback(
    (nextPage: string, payload?: any, options?: { emit?: boolean }) => {
      console.log('[v2:nav] navigating to:', nextPage, 'first:', firstNavigationRef.current)

      // Force synchronous state update for first navigation
      if (firstNavigationRef.current) {
        firstNavigationRef.current = false
      }

      setCurrentPage(nextPage)

      if (options?.emit === false) {
        return
      }

      const detail: Record<string, unknown> = { pane: nextPage, source: 'app-nav' }
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        Object.assign(detail, payload)
      } else if (payload !== undefined && payload !== null) {
        detail.payload = payload
      }

      window.dispatchEvent(new CustomEvent('bvx:navigate', { detail }))
    },
    [],
  )

  const fetchDashboardData = useCallback(
    async (tenantIdOverride?: string) => {
      try {
        setDashboardStatsLoading(true)
        setDashboardStatsError(null)
        setAgendaLoading(true)
        setClientsLoading(true)
        setRemindersLoading(true)
        setReferralLoading(true)

        const tenantId = tenantIdOverride?.trim() || (await getTenant())
        if (!tenantId) {
          setDashboardStats([])
          setAgendaItems([])
          setClientsPreview([])
          setReminders([])
          setReferralInfo(null)
          return
        }

        const timeoutMs = 8000
        const [
          kpiResult,
          metricsResult,
          queueResult,
          contactsResult,
          referralResult,
          followupsResult,
        ] = await Promise.allSettled([
          api.get(`/admin/kpis`, {
            timeoutMs,
          }),
          api.get(`/metrics`, {
            timeoutMs,
          }),
          api.get(`/cadences/queue?limit=10`, {
            timeoutMs,
          }),
          api.get(`/contacts/list?limit=4`, {
            timeoutMs,
          }),
          api.get(`/referrals/qr`, {
            timeoutMs,
          }),
          api.get(`/followups/candidates?scope=reengage_30d`, {
            timeoutMs,
          }),
        ])

        const kpis = kpiResult.status === 'fulfilled' ? (kpiResult.value as Record<string, any>) : {}
        const metrics =
          metricsResult.status === 'fulfilled'
            ? (metricsResult.value as Record<string, any>)
            : {}

        // Log specific endpoint failures for diagnostics
        const failedEndpoints: string[] = []
        if (kpiResult.status === 'rejected') failedEndpoints.push('/admin/kpis')
        if (metricsResult.status === 'rejected') failedEndpoints.push('/metrics')
        if (queueResult.status === 'rejected') failedEndpoints.push('/cadences/queue')
        if (contactsResult.status === 'rejected') failedEndpoints.push('/contacts/list')
        if (referralResult.status === 'rejected') failedEndpoints.push('/referrals/qr')
        if (followupsResult.status === 'rejected') failedEndpoints.push('/followups/candidates')

        if (failedEndpoints.length > 0) {
          console.error('Dashboard fetch failed for endpoints:', failedEndpoints)
        }

        if (kpiResult.status === 'rejected' && metricsResult.status === 'rejected') {
          setDashboardStatsError('Unable to load dashboard metrics right now.')
        }

        const currencyFormatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        })

        // Use current_month_revenue_cents for accurate monthly tracking
        const currentMonthRevenueCents = Number(kpis?.current_month_revenue_cents ?? 0)
        const activeClients = Number(kpis?.contacts ?? 0)
        const retentionRate = Number(metrics?.rebook_rate_30d ?? 0)
        // ROI requires baseline revenue before BVX - show "—" until we have historical data
        const roiPercent = 0  // TODO: Calculate from baseline_revenue_before_bvx vs current_month_revenue_cents

        // Get current month name for display
        const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' })

        const stats: DashboardStat[] = []

        stats.push({
          title: `${currentMonthName} Revenue`,
          value: currencyFormatter.format(currentMonthRevenueCents / 100),
          description: 'This month so far',
        })

        stats.push({
          title: 'Active Clients',
          value: activeClients.toLocaleString(),
          description: 'Connected contacts',
        })

        stats.push({
          title: 'Client Retention Rate',
          value: `${retentionRate.toFixed(1)}%`,
          description: 'Rebooked within 30 days',
          celebrationMessage:
            retentionRate >= 90 ? 'Retention goals exceeded! ⭐' : undefined,
          proFeature: true,
        })

        stats.push({
          title: 'ROI from BVX Platform',
          value: roiPercent > 0 ? `${roiPercent.toLocaleString()}%` : '—',
          description: 'Based on latest revenue uplift',
          proFeature: true,
        })

        setDashboardStats(stats)

        // Agenda items & reminders from queue
        const queueItems =
          queueResult.status === 'fulfilled'
            ? ((queueResult.value as any)?.items as Array<Record<string, any>> | undefined) ?? []
            : []
        const palette = ['from-primary to-purple-500', 'from-purple-500 to-fuchsia-400', 'from-rose-500 to-orange-400']

        const formatCadence = (cadenceId?: string) => {
          if (!cadenceId) return 'Follow-up'
          return cadenceId
            .split('_')
            .map((part) => part.replace(/\b\w/g, (ch) => ch.toUpperCase()))
            .join(' ')
        }

        const formatTimeLabel = (epoch?: number) => {
          if (!epoch) return undefined
          return new Date(epoch * 1000).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })
        }

        const formatDurationLabel = (epoch?: number) => {
          if (!epoch) return undefined
          const diffMinutes = Math.round(Math.abs(epoch * 1000 - Date.now()) / 60000)
          if (!diffMinutes) return 'Now'
          return epoch * 1000 >= Date.now() ? `In ${diffMinutes} min` : `${diffMinutes} min ago`
        }

        const agenda: DashboardAgendaItem[] = queueItems.slice(0, 3).map((item, index) => {
          const cadenceLabel = formatCadence(item.cadence_id)
          const friendly = item.friendly_name || 'Client'
          return {
            id: `${item.contact_id || 'contact'}-${item.cadence_id || 'cadence'}-${index}`,
            title: `Follow up with ${friendly}`,
            subtitle: `Cadence: ${cadenceLabel}`,
            timeLabel: formatTimeLabel(typeof item.next_action_at === 'number' ? item.next_action_at : undefined),
            durationLabel: formatDurationLabel(typeof item.next_action_at === 'number' ? item.next_action_at : undefined),
            impactLabel: cadenceLabel.includes('Reengage') ? 'Retention' : 'Client Care',
            completed: false,
            colorClass: palette[index % palette.length],
            iconName: cadenceLabel.includes('Reengage') ? 'retention' : 'clients',
          }
        })
        setAgendaItems(agenda)

        const remindersList: DashboardReminderItem[] = queueItems.slice(0, 5).map((item, index) => {
          const dueTs = typeof item.next_action_at === 'number' ? item.next_action_at : null
          const diffMs = dueTs ? dueTs * 1000 - Date.now() : 0
          const urgency: DashboardReminderItem['urgency'] = diffMs <= 0 ? 'high' : diffMs < 6 * 60 * 60 * 1000 ? 'high' : diffMs < 24 * 60 * 60 * 1000 ? 'medium' : 'low'
          return {
            id: `reminder-${item.contact_id || index}`,
            title: `Follow up with ${item.friendly_name || 'Client'}`,
            description: `Next step in ${formatCadence(item.cadence_id)}`,
            clientName: item.friendly_name || 'Client',
            actionLabel: 'Open queue',
            dueTs,
            urgency,
            type: 'follow-up',
          }
        })

        // Supplement with follow-up candidates if queue empty
        if (!remindersList.length && followupsResult.status === 'fulfilled') {
          const candidates = ((followupsResult.value as any)?.items as Array<Record<string, any>> | undefined) ?? []
          remindersList.push(
            ...candidates.slice(0, 3).map((candidate, index) => ({
              id: `candidate-${candidate.contact_id || index}`,
              title: 'Re-engage lapsed client',
              description: 'Send a personalized check-in message.',
              clientName: candidate.friendly_name || candidate.display_name || 'Client',
              actionLabel: 'Open follow-ups',
              dueTs: null,
              urgency: 'medium' as const,
              type: 'follow-up' as const,
            })),
          )
        }
        setReminders(remindersList)

        const contactsItems =
          contactsResult.status === 'fulfilled'
            ? ((contactsResult.value as any)?.items as Array<Record<string, any>> | undefined) ?? []
            : []

        const clientPreview: DashboardClientPreviewItem[] = contactsItems.map((item: Record<string, any>) => ({
          id: String(item.contact_id || item.id || Math.random()),
          name: String(item.friendly_name || item.display_name || 'Client'),
          totalSpentCents: Number(item.lifetime_cents ?? 0),
          visitCount: Number(item.txn_count ?? 0),
          lastVisitTs: typeof item.last_visit === 'number' ? item.last_visit : null,
          status:
            Number(item.lifetime_cents ?? 0) > 80000
              ? 'VIP'
              : Number(item.txn_count ?? 0) <= 2
                ? 'New'
                : 'Regular',
          emailHash: item.email_hash ?? null,
          phoneHash: item.phone_hash ?? null,
        }))
        setClientsPreview(clientPreview)

        if (referralResult.status === 'fulfilled') {
          const info = referralResult.value as Record<string, any>
          const monthlySavings = Number(info?.monthly_savings_cents ?? info?.monthlySavingsCents ?? 0)
          setReferralInfo({
            shareUrl: String(info?.share_url || ''),
            qrUrl: info?.qr_url ? String(info.qr_url) : undefined,
            code: info?.code ? String(info.code) : undefined,
            monthlySavingsCents: monthlySavings > 0 ? monthlySavings : undefined,
          })
        } else if (referralResult.status === 'rejected') {
          setReferralInfo(null)
          // setReferralError('Referral link unavailable right now.') // This line is removed
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error)
        setDashboardStatsError('Unable to load dashboard metrics right now.')
        // Set explicit empty states for better UX
        setDashboardStats([])
        setAgendaItems([])
        setClientsPreview([])
        setReminders([])
        setReferralInfo(null)
      } finally {
        setDashboardStatsLoading(false)
        setAgendaLoading(false)
        setClientsLoading(false)
        setRemindersLoading(false)
        setReferralLoading(false)
        handleSplashComplete()
      }
    },
    [],
  )

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false)
    setShowSplashGuard(false)
    setIsLoadingSession(false)
  }, [])

  const bootstrapSession = useCallback(async (activeSession: Session | null) => {
    if (activeSession?.user?.id && bootstrappedUserIdRef.current === activeSession.user.id && hasBootedRef.current) {
      return
    }

    if (!activeSession) {
      setCachedAccessToken(null)  // Clear cached token when no session
      setUserData(null)
      setOnboardingRequired(false)
      setShowSplash(false)
      setCurrentTrialDay(undefined)
      setDashboardStats(null)
      setDashboardStatsError(null)
      setDashboardStatsLoading(false)
      setAgendaItems(null)
      setAgendaLoading(false)
      setClientsPreview(null)
      setClientsLoading(false)
      setReminders(null)
      setRemindersLoading(false)
      setReferralInfo(null)
      setReferralLoading(false)
      bootstrappedUserIdRef.current = null
      return
    }

    try {
      console.info('[bvx:auth] session created', {
        user: activeSession.user?.id,
        email: activeSession.user?.email
      })

      // Note: Token is already cached before bootstrap is called (see lines 748, 778)
      // No need to cache it again here

      // Immediately after getSession resolves with session, call /me
      let meResponse: any = null
      let tenantId: string | undefined
      let tenantSource: 'me' | 'metadata' | 'fallback' | 'settings' | 'unknown' = 'unknown'

      try {
        meResponse = await api.get('/me')
        console.info('[bvx:auth] /me response', {
          hasTenantId: Boolean(meResponse?.tenant_id),
          userId: activeSession.user?.id
        })

        if (meResponse?.tenant_id && typeof meResponse.tenant_id === 'string') {
          tenantId = meResponse.tenant_id.trim()
          tenantSource = 'me'
        }
      } catch (meError) {
        console.warn('[bvx:auth] /me failed', meError)
      }

      // Fallback to metadata if /me didn't provide tenant_id
      if (!tenantId) {
        const meta = activeSession.user?.app_metadata || activeSession.user?.user_metadata || {}
        const claimed = typeof meta?.tenant_id === 'string' ? meta.tenant_id : undefined
        if (claimed?.trim()) {
          tenantId = claimed.trim()
          tenantSource = 'metadata'
        }
      }

      // Final fallback to localStorage before any tenant-scoped calls
      if (!tenantId) {
        const fromStorage = (() => {
          try { return localStorage.getItem('bvx_tenant')?.trim() || undefined } catch { return undefined }
        })()
        if (fromStorage) {
          tenantId = fromStorage
          tenantSource = 'fallback'
        }
      }

      // Fetch settings (allows resolving tenant_id for brand-new accounts)
      const settingsResp = await api.get('/settings', tenantId ? undefined : { includeTenant: false })
      const settingsData = settingsResp?.data || {}
      if (!tenantId) {
        const claimedTenant = typeof settingsData?.tenant_id === 'string' ? settingsData.tenant_id.trim() : undefined
        if (claimedTenant) {
          tenantId = claimedTenant
          tenantSource = 'settings'
        }
      }

      if (tenantId) {
        try {
          localStorage.setItem('bvx_tenant', tenantId)
          console.info('[bvx:auth] tenant_id persisted', { tenantId, source: tenantSource })
        } catch (storageError) {
          console.warn('[bvx:auth] failed to persist tenant_id', storageError)
        }

        fetchDashboardData(tenantId).catch((error) => {
          console.error('Dashboard metrics fetch failed during bootstrap', error)
        })
      } else {
        console.warn('[bvx:auth] no tenant_id resolved during bootstrap; blocking tenant-scoped calls', {
          user: activeSession.user?.id,
          source: tenantSource,
          metadata: activeSession.user?.app_metadata,
        })
        setDashboardStats([])
        setAgendaItems([])
        setClientsPreview([])
        setReminders([])
        setReferralInfo(null)
      }
      const subscription = settingsData?.subscription || {}

      const trialEndTs = typeof subscription?.trial_end_ts === 'number'
        ? subscription.trial_end_ts
        : (typeof settingsData?.trial_end_ts === 'number' ? settingsData.trial_end_ts : null)

      const profile: UserProfile = {
        fullName: activeSession.user?.user_metadata?.name || settingsData?.brand_profile?.owner_name || DEFAULT_PROFILE.fullName,
        businessName: settingsData?.brand_profile?.business_name || settingsData?.business?.name || DEFAULT_PROFILE.businessName,
        jobTitle: settingsData?.brand_profile?.job_title || activeSession.user?.user_metadata?.job_title || DEFAULT_PROFILE.jobTitle,
        plan: subscription?.plan_tier || subscription?.plan_code || settingsData?.plan_tier || settingsData?.plan_code || subscription?.status || '',
        email: activeSession.user?.email || '',
        subscriptionStatus: subscription?.status || settingsData?.subscription_status || '',
        trialEndTs,
        trialLengthDays: typeof settingsData?.trial_length_days === 'number' ? settingsData.trial_length_days : undefined,
      }
      
      // Override for testing: Force lite tier UI for all tenants
      if (import.meta.env.VITE_FORCE_LITE_UI === 'true') {
        profile.plan = 'lite'
      }
      
      setUserData(profile)
      const trialDay = computeTrialDay(profile)
      setCurrentTrialDay(trialDay)
      setOnboardingRequired(!Boolean(settingsData?.onboarding_completed))
      bootstrappedUserIdRef.current = activeSession.user?.id ?? null

      console.info('[bvx:auth] bootstrap completed', {
        tenantId,
        source: tenantSource,
        hasProfile: Boolean(profile),
        onboardingRequired
      })
    } catch (error: any) {
      console.error('Failed to bootstrap session', error)
      const status = error?.response?.status ?? error?.status
      if (status === 401) {
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          console.warn('Failed to sign out after bootstrap error', signOutError)
        }
        setCachedAccessToken(null)  // Clear cached token on 401
        setSession(null)
        setUserData(null)
        bootstrappedUserIdRef.current = null
        setOnboardingRequired(false)
        setCurrentTrialDay(undefined)
        setShowSplash(false)
        setShowSplashGuard(false)
        if (typeof window !== 'undefined') {
          window.location.replace('/login')
        }
        return
      }

      console.warn('[v2] bootstrap encountered non-auth error; preserving session for retry', {
        status,
        message: error?.message,
      })

      setUserData(prev => prev ?? null)
      setOnboardingRequired(false)
      setCurrentTrialDay(prev => prev)
    } finally {
      setShowSplash(false)
      setShowSplashGuard(false)
      setIsLoadingSession(false)  // ALWAYS clear loading state, even if bootstrap hangs/fails
      hasBootedRef.current = true
    }
  }, [fetchDashboardData])

  useEffect(() => {
    let cancelled = false
    
    // Absolute maximum timeout - force recovery if everything else fails
    const maxLoadTimeout = setTimeout(() => {
      if (!cancelled) {
        console.error('[v2] FORCED RECOVERY: Initial load exceeded 15 seconds, forcing UI render')
        setIsLoadingSession(false)
        setShowSplash(false)
        setShowSplashGuard(false)
        hasBootedRef.current = true
        isInitialLoadRef.current = false
      }
    }, 15000) // 15 second absolute maximum
    
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (!data.session) {
          setSession(null)
          setShowSplash(false)
          setShowSplashGuard(false)
          setIsLoadingSession(false)
          hasBootedRef.current = true
          isInitialLoadRef.current = false  // Mark initial load complete
          clearTimeout(maxLoadTimeout)
          return
        }
        
        // ✅ Cache token BEFORE setting session (prevents 401 errors on workspace render)
        setCachedAccessToken(data.session.access_token)
        
        setSession(data.session)
        // Delay splash teardown until after bootstrap completes to avoid
        // intermediate renders that race with route changes.
        await bootstrapSession(data.session)
        if (cancelled) return
        setIsLoadingSession(false)
        // Ensure hasBootedRef flips true after bootstrap completes (both with and without session)
        hasBootedRef.current = true
        isInitialLoadRef.current = false  // Mark initial load complete
        clearTimeout(maxLoadTimeout)
      } catch (error) {
        console.warn('Initial session bootstrap failed', error)
        setSession(null)
        setShowSplash(false)
        setShowSplashGuard(false)
        setIsLoadingSession(false)
        hasBootedRef.current = true
        isInitialLoadRef.current = false  // Mark initial load complete
        clearTimeout(maxLoadTimeout)
      }
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: any, newSession: Session | null) => {
      if (cancelled) return

      if (event === 'SIGNED_IN' && newSession) {
        // ✅ Cache token FIRST (before setting session)
        setCachedAccessToken(newSession.access_token)
        
        setSession(newSession)
        
        // Only show splash and bootstrap if this is a REAL sign-in event
        // (not initial load, not tab return, not token refresh)
        const isRealSignIn = !isInitialLoadRef.current && !hasBootedRef.current
        
        if (isRealSignIn) {
          setShowSplash(true)
          setShowSplashGuard(true)
          
          await bootstrapSession(newSession)
          
          setShowSplash(false)
          setShowSplashGuard(false)
        }
        
        setIsLoadingSession(false)
        isInitialLoadRef.current = false  // Mark initial load complete
      } else if (event === 'SIGNED_OUT' || !newSession) {
        clearSplashGuard(lastUserIdRef.current)
        setCachedAccessToken(null)  // Clear cached token on sign out
        setSession(null)
        setUserData(null)
        bootstrappedUserIdRef.current = null
        setOnboardingRequired(false)
        setShowSplash(false)
        setShowSplashGuard(false)
        setIsLoadingSession(false)
        hasBootedRef.current = true
        if (!newSession) {
          navigateToPage('dashboard')
        }
      } else if (newSession) {
        // TOKEN_REFRESHED or other events: update session and cached token silently
        setSession(newSession)
        setCachedAccessToken(newSession.access_token)  // Update cached token
        // Ensure loading session is false for silent auth events
        setIsLoadingSession(false)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(maxLoadTimeout)
      authListener?.subscription?.unsubscribe()
    }
  }, [bootstrapSession, navigateToPage])

  // Dashboard data is already fetched in bootstrapSession after tenant_id is resolved
  // Remove this duplicate fetch to prevent race conditions

  useEffect(() => {
    if (!userData) {
      setCurrentTrialDay(undefined)
      return
    }
    const trialDay = computeTrialDay(userData)
    setCurrentTrialDay(trialDay)
  }, [userData])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.info('[v2] shell state', {
      isLoadingSession,
      showSplash,
      showSplashGuard,
      hasSession: Boolean(session?.user),
    })
  }, [isLoadingSession, showSplash, showSplashGuard, session])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    try {
      console.info('[v2] route', window.location.pathname)
    } catch {}
  }, [])

  const handleConsultationGenerated = (data: ConsultationData) => {
    setConsultationData(data)
    navigateToPage('consultation-results')
  }

  const handleBackToConsultation = () => {
    navigateToPage('brandvzn')
  }

  const handleNewConsultation = () => {
    setConsultationData(null)
    navigateToPage('brandvzn')
  }

  const handleNotificationClick = () => {
    navigateToPage('agenda')
  }

  const handleViewAgenda = () => {
    navigateToPage('agenda')
  }

  const handleNavigateToSettings = (tab?: string) => {
    const desiredTab = tab || 'profile'
    setSettingsInitialTab(desiredTab)

    if (currentPage === 'settings') {
      return
    }

    navigateToPage('settings', { settingsTab: desiredTab })
  }

  const handleUpgrade = () => {
    setSettingsInitialTab('plan')
    navigateToPage('settings', { settingsTab: 'plan' })
  }

  useEffect(() => {
    if (!session || onboardingRequired || settingsPrefetchedRef.current) return
    settingsPrefetchedRef.current = true
    void import('./components/settings').catch(() => {})
  }, [session, onboardingRequired])

  // Listen for bvx:navigate events to keep currentPage in sync with URL/workspace shell
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail
      if (!detail) return

      const source = typeof detail.source === 'string' ? (detail.source as string) : undefined
      if (source === 'app-nav') {
        return
      }

      const pane = typeof detail.pane === 'string' ? (detail.pane as string) : undefined
      if (!pane) return

      const { pane: _ignoredPane, source: _ignoredSource, ...rest } = detail

      if (pane === 'clients' && typeof detail.search === 'string') {
        setClientSearchPrefill(detail.search as string)
      }

      if (pane === 'settings') {
        const requestedTab = typeof detail.settingsTab === 'string' ? (detail.settingsTab as string) : undefined
        if (requestedTab) {
          setSettingsInitialTab(requestedTab)
        } else {
          setSettingsInitialTab('profile')
        }
      }

      navigateToPage(pane, rest as Record<string, unknown>, { emit: false })
    }
    window.addEventListener('bvx:navigate', handler as EventListener)
    return () => window.removeEventListener('bvx:navigate', handler as EventListener)
  }, [navigateToPage])

  const handleOnboardingComplete = async (completeUserData: UserProfile) => {
    setUserData(prev => ({ ...prev, ...completeUserData }))
    setOnboardingRequired(false)
    try {
      const tenantId = await getTenant()
      await api.post('/settings', {
        tenant_id: tenantId,
        onboarding_completed: true,
        brand_profile: {
          owner_name: completeUserData.fullName || userData?.fullName,
          business_name: completeUserData.businessName || userData?.businessName,
          job_title: completeUserData.jobTitle || userData?.jobTitle,
        },
      })
    } catch (error) {
      console.warn('Failed to persist onboarding completion', error)
    }
  }

  const renderPageContent = () => {
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
          return (
            <DashboardContent
              onViewAgenda={handleViewAgenda}
              userData={userData}
              currentTrialDay={currentTrialDay}
              onUpgrade={handleUpgrade}
              stats={dashboardStats}
              statsLoading={dashboardStatsLoading}
              statsError={dashboardStatsError}
              agendaItems={agendaItems}
              agendaLoading={agendaLoading}
              clientsPreview={clientsPreview}
              clientsLoading={clientsLoading}
              reminders={reminders}
              remindersLoading={remindersLoading}
              referral={referralInfo}
              referralLoading={referralLoading}
            />
          )
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
            <Clients
              initialSearch={clientSearchPrefill}
              onAckSearch={() => setClientSearchPrefill(undefined)}
            />
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
                'Professional landing page builder with beauty-focused templates',
                'Customizable link-in-bio tool with booking integration',
                'Lead capture forms with automated follow-up sequences',
                'Social media integration for Instagram, TikTok, and Facebook',
                'Analytics dashboard to track clicks, conversions, and ROI',
                'Mobile-optimized pages that convert visitors into bookings',
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
                'Automated email marketing campaigns for client retention',
                'Social media content calendar with beauty-focused templates',
                'Client lifecycle automation (welcome series, follow-ups, winback)',
                'Advanced analytics and business intelligence dashboard',
                'Personalized growth recommendations based on your business data',
                'Integration with popular beauty booking and POS systems',
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
        return (
          <DashboardContent
            onViewAgenda={handleViewAgenda}
            userData={userData}
            currentTrialDay={currentTrialDay}
            onUpgrade={handleUpgrade}
            stats={dashboardStats}
            statsLoading={dashboardStatsLoading}
            statsError={dashboardStatsError}
            agendaItems={agendaItems}
            agendaLoading={agendaLoading}
            clientsPreview={clientsPreview}
            clientsLoading={clientsLoading}
            reminders={reminders}
            remindersLoading={remindersLoading}
            referral={referralInfo}
            referralLoading={referralLoading}
          />
        )
    }
  }

  // Track whether the intro animation has completed
  const [introComplete, setIntroComplete] = useState(() => {
    return !!localStorage.getItem('bvx_landing_intro_shown')
  })

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true)
  }, [])

  // Show splash only during explicit auth cycles or guard fade-out state
  if (showSplash || showSplashGuard) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  // Wait for session bootstrap to complete before rendering app
  // This prevents race condition where workspace loads before tenant_id is set
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Setting up workspace...</p>
        </div>
      </div>
    )
  }

      return (
        <BrowserRouter>
          <Routes>
            {!session ? (
              <>
                <Route path="/" element={
                  introComplete ? <LandingV2 /> : <LandingIntroAnimation onComplete={handleIntroComplete} />
                } />
                <Route path="/brandvx" element={
                  introComplete ? <LandingV2 /> : <LandingIntroAnimation onComplete={handleIntroComplete} />
                } />
                <Route path="/login" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route
                  path="/workspace"
                  element={
                    onboardingRequired ? (
                      <Onboarding userData={userData} onComplete={handleOnboardingComplete} />
                    ) : (
                      <OnboardingProvider>
                        <ClientRemindersProvider>
                          <AgendaProvider>
                            {isProfileLoading ? (
                              <div className="min-h-screen bg-background flex">
                                <div className="w-64 bg-card border-r" />
                                <div className="flex-1 flex items-center justify-center">
                                  <LoadingSpinner />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="min-h-screen bg-background flex">
                                  <SidebarNav
                                    currentPage={currentPage}
                                    onNavigate={navigateToPage}
                                    userData={userData}
                                    onNavigateToSettings={handleNavigateToSettings}
                                  />

                                  <div className="flex-1 flex flex-col">
                                    <DashboardHeader
                                      onNotificationClick={handleNotificationClick}
                                      onOpenSettings={handleNavigateToSettings}
                                      onNavigate={(pane, payload) => {
                                        navigateToPage(pane, payload)
                                        if (pane === 'clients' && payload?.search) {
                                          setClientSearchPrefill(payload.search)
                                        }
                                      }}
                                      userData={userData}
                                    />

                                    <main className="flex-1 p-6">
                                      {renderPageContent()}
                                    </main>
                                  </div>
                                </div>

                                {(() => {
                                  const getOnboardingPageId = (page: string) => {
                                    const pageMap: Record<string, string> = {
                                      'grow-your-list': 'grow-your-list',
                                      'grow-with-vx': 'grow-with-vx',
                                      'follow-ups': 'follow-ups',
                                      'consultation-results': 'brandvzn',
                                    }
                                    return pageMap[page] || page
                                  }

                                  return <OnboardingTooltip pageId={getOnboardingPageId(currentPage) as any} />
                                })()}
                              </>
                            )}

                            <Toaster />
                            <SupportBubble hideTrigger />
                          </AgendaProvider>
                        </ClientRemindersProvider>
                      </OnboardingProvider>
                    )
                  }
                />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/login" element={<Navigate to="/workspace" replace />} />
                <Route path="/signup" element={<Navigate to="/workspace" replace />} />
                <Route path="*" element={<Navigate to="/workspace" replace />} />
              </>
            )}
          </Routes>
        </BrowserRouter>
      )
}
