import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import type { Session } from '@supabase/supabase-js'
import './index.css'
import './styles/globals.css'
import { Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { api, getTenant } from '../lib/api'
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
import type {
  DashboardAgendaItem,
  DashboardClientPreviewItem,
  DashboardReminderItem,
  DashboardReferralInfo,
} from './types/dashboard'

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

type AuthView = 'signIn' | 'signUp'

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
  fullName: 'Sarah Johnson',
  businessName: 'Elegant Beauty Studio',
  jobTitle: 'Cosmetologist'
}

const DEFAULT_TRIAL_LENGTH = 7

const isTrialUser = (profile?: UserProfile | null) => {
  if (!profile) return true
  const status = (profile.subscriptionStatus || '').toLowerCase()
  if (status === 'trialing') return true
  return !profile.plan || profile.plan === 'trial' || profile.plan === 'essentials'
}

const hasAccessToFeature = (featureName: string, profile?: UserProfile | null) => {
  const plan = (profile?.plan || '').toLowerCase()
  if (!isTrialUser(profile)) {
    const accessMap: Record<string, string[]> = {
      'grow-your-list': ['pro', 'premium'],
      'grow-with-vx': ['pro', 'premium'],
      inventory: ['pro', 'premium'],
      tutorials: ['essentials', 'pro', 'premium']
    }
    const allowed = accessMap[featureName]
    return allowed ? allowed.includes(plan) : true
  }
  return !['grow-your-list', 'grow-with-vx'].includes(featureName)
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
  const displayName = userData?.fullName ? userData.fullName.split(' ')[0] : DEFAULT_PROFILE.fullName.split(' ')[0]
  const businessName = userData?.businessName || DEFAULT_PROFILE.businessName
  const profession = userData?.jobTitle || DEFAULT_PROFILE.jobTitle
  const showTrialBanner = isTrialUser(userData)

  return (
    <div className="space-y-6">
      {showTrialBanner && currentTrialDay && (
        <TrialBanner
          currentDay={currentTrialDay}
          totalDays={userData?.trialLengthDays ?? DEFAULT_TRIAL_LENGTH}
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
          {userData?.plan && ['pro', 'premium'].includes(userData.plan.toLowerCase()) && (
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
      <QuickstartAgenda items={agendaItems ?? undefined} loading={agendaLoading} onViewFullAgenda={onViewAgenda} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientsPreview clients={clientsPreview ?? undefined} loading={clientsLoading} onViewAll={onViewAgenda} />
        <ClientReminders reminders={reminders ?? undefined} loading={remindersLoading} onViewAll={onViewAgenda} />
      </div>
    </div>
  )
}

export default function App() {
  const [authView, setAuthView] = useState<AuthView>('signIn')
  const [session, setSession] = useState<Session | null>(null)
  const [userData, setUserData] = useState<UserProfile | null>(null)
  const [showSplash, setShowSplash] = useState(false)
  const [initializing, setInitializing] = useState(true)
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
          api.get(`/admin/kpis?tenant_id=${encodeURIComponent(tenantId)}`, {
            timeoutMs,
          }),
          api.get(`/metrics?tenant_id=${encodeURIComponent(tenantId)}`, {
            timeoutMs,
          }),
          api.get(`/cadences/queue?tenant_id=${encodeURIComponent(tenantId)}&limit=10`, {
            timeoutMs,
          }),
          api.get(`/contacts/list?tenant_id=${encodeURIComponent(tenantId)}&limit=4`, {
            timeoutMs,
          }),
          api.get(`/referrals/qr?tenant_id=${encodeURIComponent(tenantId)}`, {
            timeoutMs,
          }),
          api.get(`/followups/candidates?tenant_id=${encodeURIComponent(tenantId)}&scope=reengage_30d`, {
            timeoutMs,
          }),
        ])

        const kpis = kpiResult.status === 'fulfilled' ? (kpiResult.value as Record<string, any>) : {}
        const metrics =
          metricsResult.status === 'fulfilled'
            ? (metricsResult.value as Record<string, any>)
            : {}

        if (kpiResult.status === 'rejected' && metricsResult.status === 'rejected') {
          setDashboardStatsError('Unable to load dashboard metrics right now.')
        }

        const currencyFormatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        })

        const revenueCents = Number(kpis?.revenue_uplift ?? 0)
        const activeClients = Number(kpis?.contacts ?? 0)
        const retentionRate = Number(metrics?.rebook_rate_30d ?? 0)
        const roiPercent = revenueCents > 0 ? Math.round(((revenueCents / 100) / 147) * 100) : 0

        const stats: DashboardStat[] = []

        stats.push({
          title: 'Monthly Revenue',
          value: currencyFormatter.format(revenueCents / 100),
          description: 'vs last month',
        })

        stats.push({
          title: 'Active Clients',
          value: activeClients.toLocaleString(),
          description: 'Connected contacts',
          celebrationMessage:
            activeClients >= 200 ? 'Client goal achieved! 🎉' : undefined,
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
              clientName: candidate.contact_id,
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
        setDashboardStats([])
      } finally {
        setDashboardStatsLoading(false)
        setAgendaLoading(false)
        setClientsLoading(false)
        setRemindersLoading(false)
        setReferralLoading(false)
      }
    },
    [],
  )

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false)
    setShowSplashGuard(false)
  }, [])

  const bootstrapSession = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
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
      return
    }

    try {
      setShowSplash(true)
      setShowSplashGuard(true)
      const me = await api.get('/me')
      const tenantId = (me?.tenant_id || '').trim()
      if (tenantId) {
        try { localStorage.setItem('bvx_tenant', tenantId) } catch {}
      }
      const settingsResp = await api.get('/settings')
      const settingsData = settingsResp?.data || {}
      const subscription = me?.subscription || {}

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

      setUserData(profile)
      const trialDay = computeTrialDay(profile)
      setCurrentTrialDay(trialDay)
      setOnboardingRequired(!Boolean(settingsData?.onboarding_completed))
    } catch (error) {
      console.error('Failed to bootstrap session', error)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        setSession(data.session)
        await bootstrapSession(data.session)
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return
      setSession(newSession)
      await bootstrapSession(newSession)
      if (!newSession) {
        setAuthView('signIn')
        setCurrentPage('dashboard')
      }
    })

    return () => {
      cancelled = true
      authListener?.subscription?.unsubscribe()
    }
  }, [bootstrapSession])

  useEffect(() => {
    if (session?.user) {
      fetchDashboardData().catch((error) => {
        console.error('Dashboard metrics fetch failed', error)
      })
    } else {
      setDashboardStats(null)
      setDashboardStatsError(null)
    }
  }, [session, fetchDashboardData])

  useEffect(() => {
    if (!userData) {
      setCurrentTrialDay(undefined)
      return
    }
    const trialDay = computeTrialDay(userData)
    setCurrentTrialDay(trialDay)
  }, [userData])

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

  const handleNavigateToSettings = () => {
    setSettingsInitialTab('profile')
    setCurrentPage('settings')
  }

  const handleUpgrade = () => {
    setSettingsInitialTab('plan')
    setCurrentPage('settings')
  }

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

  const handleShowSignUp = () => setAuthView('signUp')
  const handleShowSignIn = () => setAuthView('signIn')

  const handleSignedIn = () => {
    setShowSplash(true)
    setShowSplashGuard(true)
  }

  if (initializing) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  if (!session) {
    if (authView === 'signUp') {
      return <SignUp onBackToSignIn={handleShowSignIn} />
    }
    return <SignIn onSignUp={handleShowSignUp} onSignedIn={handleSignedIn} />
  }

  if (onboardingRequired) {
    return <Onboarding userData={userData} onComplete={handleOnboardingComplete} />
  }

  if (showSplash || showSplashGuard) {
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

          <Toaster />
        </AgendaProvider>
      </ClientRemindersProvider>
    </OnboardingProvider>
  )
}
