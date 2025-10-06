import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { api } from '../../lib/api'
import { startOAuth } from '../../sdk/connectionsClient'
import { OnboardingSettings } from './onboarding-settings'
import {
  DEFAULT_BRAND,
  DEFAULT_BUSINESS,
  DEFAULT_GOALS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PROFILE,
} from './settings-defaults'
import type {
  ProfileSettings,
  BusinessSettings,
  BrandSettings,
  NotificationsSettings,
  GoalSettings,
  TwilioSettings,
  IntegrationStatusItem,
  SettingsResponseData,
  QuietHoursSettings,
} from './types/settings.ts'


import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
// Alert components not used on Settings yet
import { Skeleton } from './ui/skeleton'
import { cn } from './ui/utils'


interface SettingsProps {
  userData?: {
    plan?: string | null
    fullName?: string | null
    businessName?: string | null
    email?: string | null
  } | null
  initialTab?: string
}

const formatRelativeTimeLabel = (timestampMs: number) => {
  const diffMs = Date.now() - timestampMs
  const diffMinutes = Math.round(diffMs / 60_000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  const diffWeeks = Math.round(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks} wk${diffWeeks === 1 ? '' : 's'} ago`
  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} mo${diffMonths === 1 ? '' : 's'} ago`
  const diffYears = Math.round(diffDays / 365)
  return `${diffYears} yr${diffYears === 1 ? '' : 's'} ago`
}





const CardIcon = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary', className)}>
    •
  </span>
)

export function Settings({ userData, initialTab = 'profile' }: SettingsProps): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [integrationLoading, setIntegrationLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileSettings>(DEFAULT_PROFILE)
  const [businessData, setBusinessData] = useState<BusinessSettings>(DEFAULT_BUSINESS)
  const [brandData, setBrandData] = useState<BrandSettings>(DEFAULT_BRAND)
  const [notifications, setNotifications] = useState<NotificationsSettings>(DEFAULT_NOTIFICATIONS)
  const [goals, setGoals] = useState<GoalSettings>(DEFAULT_GOALS)
  const [quietHours, setQuietHours] = useState<QuietHoursSettings>({ start: undefined, end: undefined })
  const [twilioData, setTwilioData] = useState<TwilioSettings>({
    accountSid: undefined,
    authToken: undefined,
    phoneNumber: undefined,
    subaccountSid: undefined,
    fromNumber: undefined,
    provisioned: false,
    showAuthToken: false,
  })
  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>([])
  const [tone, setTone] = useState<string>('friendly')
  const [trainingNotes, setTrainingNotes] = useState<string>('')
  const hasLoadedRef = React.useRef(false)

  const loadSettings = useCallback(async (): Promise<void> => {
    // Prevent duplicate loads
    if (loading) return
    
    setLoading(true)
    try {
      const response = (await api.get(`/settings`, {
        timeoutMs: 10_000,
      })) as { data?: SettingsResponseData }
      const data = response.data ?? {}

      if (userData?.fullName) {
        const [firstName = '', lastName = ''] = userData.fullName.split(' ')
        setProfileData((prev) => ({ ...prev, firstName, lastName, email: userData.email ?? prev.email }))
      }

      if (data.profile) setProfileData({ ...DEFAULT_PROFILE, ...data.profile })
      if (data.business) setBusinessData({ ...DEFAULT_BUSINESS, ...data.business })
      if (data.brand_profile) setBrandData({ ...DEFAULT_BRAND, ...data.brand_profile })
      if (data.notifications) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...data.notifications })
      if (data.goals) setGoals({ ...DEFAULT_GOALS, ...data.goals })
      if (data.quiet_hours) setQuietHours(data.quiet_hours)
      if (data.tone) setTone(data.tone)
      if (data.training_notes) setTrainingNotes(data.training_notes)
      // providers_live deferred

      const messaging = data.messaging ?? {}
      setTwilioData({
        accountSid: messaging.twilio_subaccount_sid,
        authToken: messaging.twilio_auth_token,
        phoneNumber: messaging.sms_from_number,
        subaccountSid: messaging.twilio_subaccount_sid,
        fromNumber: messaging.sms_from_number,
        provisioned: Boolean(messaging.sms_from_number),
        showAuthToken: false,
      })
    } catch (err) {
      console.error('Settings load failed', err)
      toast.error('Unable to load settings right now')
    } finally {
      setLoading(false)
    }
  }, [userData, loading])

  const loadIntegrations = useCallback(async (): Promise<void> => {
    setIntegrationLoading(true)
    try {
      const response = (await api.get(`/integrations/status`, {
        timeoutMs: 10_000,
      })) as {
        providers?: Record<string, { linked?: boolean; status?: string }>
        expires?: Record<string, number>
        last_sync?: Record<string, number>
        connect_urls?: Record<string, string>
      }

      const providers = response.providers ?? {}
      // Only show Square and Acuity for now - other integrations will be added later
      const items: IntegrationStatusItem[] = Object.keys({
        square: true,
        acuity: true,
      }).map((key) => {
        const providerData = providers[key] ?? { linked: false }
        return {
          provider: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize provider name
          linked: Boolean(providerData.linked),
          status: providerData.status,
          lastSyncTs: response.last_sync?.[key] ?? null,
          expiresAt: response.expires?.[key] ?? null,
          connectUrl: response.connect_urls?.[key] ?? null,
        }
      })
      setIntegrations(items)
    } catch (err) {
      console.error('Integrations status failed', err)
      toast.error('Unable to load integrations right now')
    } finally {
      setIntegrationLoading(false)
    }
  }, [])

  // Provider and Twilio logic deferred (placeholders removed)

  const saveSettings = useCallback(async (): Promise<void> => {
    setSaving(true)
    try {
      await api.post('/settings', {
        profile: profileData,
        business: businessData,
        notifications,
        goals,
        tone,
        training_notes: trainingNotes,
        quiet_hours: quietHours,
        brand_profile: brandData,
        // providers_live: omitted (deferred)
        messaging: twilioData.provisioned
          ? {
              twilio_subaccount_sid: twilioData.subaccountSid,
              twilio_auth_token: twilioData.authToken,
              sms_from_number: twilioData.fromNumber,
            }
          : undefined,
      })
      toast.success('Settings saved')
    } catch (err) {
      console.error('Settings save failed', err)
      toast.error('Unable to save settings right now')
    } finally {
      setSaving(false)
    }
  }, [brandData, businessData, goals, notifications, profileData, quietHours, tone, trainingNotes, twilioData])

  useEffect(() => {
    // Only load once on mount
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    
    loadSettings()
    loadIntegrations()
  }, [loadSettings, loadIntegrations])

  const renderIntegrations = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Connect your tools
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          See which systems are linked today and connect booking or marketing platforms in one click.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrationLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.provider}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-2 backdrop-blur transition-colors',
                  integration.linked ? 'border-emerald-200 bg-emerald-50' : 'border-muted bg-background/80',
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">{integration.provider}</div>
                    <Badge variant={integration.linked ? 'outline' : 'secondary'} className="text-xs capitalize">
                      {integration.linked ? integration.status || 'Connected' : 'Not connected'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {integration.linked && integration.lastSyncTs
                      ? `Sync ${formatRelativeTimeLabel(integration.lastSyncTs * 1000)}`
                      : integration.linked
                      ? 'Sync pending'
                      : 'Connect to begin syncing'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={integration.linked ? 'outline' : 'default'}
                    size="sm"
                    onClick={async () => {
                      const providerLower = integration.provider.toLowerCase()
                      
                      if (providerLower === 'square' || providerLower === 'acuity') {
                        toast.info(`Redirecting to ${integration.provider} authentication...`)
                        await startOAuth(providerLower as 'square' | 'acuity', { returnTo: 'workspace' })
                      } else {
                        toast.error(`${integration.provider} connection not configured yet.`)
                      }
                    }}
                  >
                    {integration.linked ? 'Manage' : 'Connect'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderAccountCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Account Details
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your personal and business information.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>First Name</Label>
              <Input
                value={profileData.firstName}
                onChange={(event) =>
                  setProfileData((prev) => ({ ...prev, firstName: event.target.value.trim() }))
                }
                placeholder="Sarah"
              />
            </div>
            <div className="grid gap-2">
              <Label>Last Name</Label>
              <Input
                value={profileData.lastName}
                onChange={(event) =>
                  setProfileData((prev) => ({ ...prev, lastName: event.target.value.trim() }))
                }
                placeholder="Johnson"
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                value={profileData.email}
                onChange={(event) =>
                  setProfileData((prev) => ({ ...prev, email: event.target.value.trim() }))
                }
                placeholder="sarah@elegantbeauty.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input
                value={profileData.phone}
                onChange={(event) =>
                  setProfileData((prev) => ({ ...prev, phone: event.target.value.trim() }))
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6" />

        {/* Business Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Business Information</h3>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Business Name</Label>
              <Input
                value={businessData.businessName}
                onChange={(event) =>
                  setBusinessData((prev) => ({ ...prev, businessName: event.target.value.trim() }))
                }
                placeholder="Elegant Beauty Studio"
              />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input
                value={businessData.address}
                onChange={(event) =>
                  setBusinessData((prev) => ({ ...prev, address: event.target.value.trim() }))
                }
                placeholder="123 Beauty Lane, Beverly Hills, CA 90210"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Business Phone</Label>
                <Input
                  value={businessData.phone}
                  onChange={(event) =>
                    setBusinessData((prev) => ({ ...prev, phone: event.target.value.trim() }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="grid gap-2">
                <Label>Business Email</Label>
                <Input
                  value={businessData.email}
                  onChange={(event) =>
                    setBusinessData((prev) => ({ ...prev, email: event.target.value.trim() }))
                  }
                  placeholder="hello@elegantbeauty.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Website</Label>
              <Input
                value={businessData.website}
                onChange={(event) =>
                  setBusinessData((prev) => ({ ...prev, website: event.target.value.trim() }))
                }
                placeholder="www.elegantbeauty.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Hours</Label>
              <Input
                value={businessData.hours}
                onChange={(event) =>
                  setBusinessData((prev) => ({ ...prev, hours: event.target.value.trim() }))
                }
                placeholder="Mon-Fri: 9AM-7PM, Sat: 9AM-5PM, Sun: Closed"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={businessData.description}
                onChange={(event) =>
                  setBusinessData((prev) => ({ ...prev, description: event.target.value.trim() }))
                }
                placeholder="Premium beauty services specializing in skincare, makeup, and wellness treatments."
                rows={3}
              />
            </div>
          </div>
        </div>

        <Button onClick={() => saveSettings()} disabled={saving} className="w-full md:w-auto">
          {saving ? 'Saving...' : 'Save Account Details'}
        </Button>
      </CardContent>
    </Card>
  )

  const renderPlanBillingCard = () => {
    const currentPlan = userData?.plan?.toLowerCase() || ''
    const hasPaidPlan = currentPlan && !['trial', 'essentials', ''].includes(currentPlan)
    const has97Plan = currentPlan === 'pro' || currentPlan === 'founding'
    const has147Plan = currentPlan === 'premium'
    
    return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Subscription & Billing
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your plan, billing, and payment method.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Display */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {userData?.plan ? userData.plan.charAt(0).toUpperCase() + userData.plan.slice(1) : 'Trial'} Plan
                </h3>
                <Badge variant="outline" className="bg-primary/10">
                  {hasPaidPlan ? 'Active' : 'Trial'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {hasPaidPlan ? 'Your current subscription plan' : 'Upgrade to unlock all features'}
              </p>
            </div>
          </div>
        </div>

        {/* Plan Options - Show upgrades only */}
        {!has147Plan && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              {hasPaidPlan ? 'Upgrade Options' : 'Available Plans'}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Founding Member $97/mo - Hide if already on $97 or higher plan */}
              {!has97Plan && !has147Plan && (
                <div className="rounded-xl border border-muted p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground">Founding Member</h4>
                      <p className="text-2xl font-bold text-primary mt-1">$97<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                    </div>
                    <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">Best Value</Badge>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="h-4 w-4 rounded-full p-0" />
                      Lock in founding member price
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="h-4 w-4 rounded-full p-0" />
                      All Pro features included
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="h-4 w-4 rounded-full p-0" />
                      Billed today
                    </li>
                  </ul>
                  <Button variant="outline" className="w-full" onClick={() => {
                    const stripeUrl = `https://buy.stripe.com/${import.meta.env.VITE_STRIPE_BUY_BUTTON_97 || 'buy_btn_1S3JACKsdVcBvHY1eEO0g2Mt'}`
                    window.open(stripeUrl, '_blank')
                  }}>
                    Select Plan
                  </Button>
                </div>
              )}

              {/* Pro $147/mo - Always show unless already on $147 */}
              <div className="rounded-xl border border-muted p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">Pro</h4>
                    <p className="text-2xl font-bold text-primary mt-1">$147<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                  </div>
                  {!hasPaidPlan && <Badge variant="secondary">7-Day Trial</Badge>}
                  {has97Plan && <Badge className="bg-gradient-to-r from-primary to-accent text-white">Upgrade</Badge>}
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-4 w-4 rounded-full p-0" />
                    {!hasPaidPlan ? '7-day free trial included' : 'Premium features'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-4 w-4 rounded-full p-0" />
                    All Pro features
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-4 w-4 rounded-full p-0" />
                    {!hasPaidPlan ? 'Billed after trial' : 'Advanced automation'}
                  </li>
                </ul>
                <Button className="w-full" onClick={() => {
                  const stripeUrl = `https://buy.stripe.com/${import.meta.env.VITE_STRIPE_BUY_BUTTON_147 || 'buy_btn_1S3J6sKsdVcBvHY1nllLYX6Q'}`
                  window.open(stripeUrl, '_blank')
                }}>
                  {has97Plan ? 'Upgrade to Pro' : 'Start Trial'}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {has147Plan && (
          <div className="text-center p-6 rounded-xl border border-primary/20 bg-primary/5">
            <p className="text-sm text-muted-foreground">
              You're on our highest tier plan. Thank you for your support! 🎉
            </p>
          </div>
        )}

        {/* Payment Method Section */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Payment Method</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your payment method and billing information through Stripe.
          </p>
          <Button variant="outline" onClick={() => {
            toast.info('Opening Stripe billing portal...')
            // Add Stripe customer portal link here
          }}>
            Manage Payment Method
          </Button>
        </div>
      </CardContent>
    </Card>
    )
  }

  const renderBrandCard = () => (
          <Card>
            <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Branding
        </CardTitle>
              <p className="text-sm text-muted-foreground">
          Customize your brand colors, tagline, and social media presence.
              </p>
            </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Primary Color</Label>
                    <Input
              type="color"
                      value={brandData.primaryColor}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, primaryColor: event.target.value }))
              }
              placeholder="#E03C91"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Accent Color</Label>
                    <Input
              type="color"
                      value={brandData.accentColor}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, accentColor: event.target.value }))
              }
              placeholder="#2F5D9F"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Tagline</Label>
                <Input
                  value={brandData.tagline}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, tagline: event.target.value.trim() }))
              }
              placeholder="Where Beauty Meets Excellence"
                />
              </div>
          <div className="grid gap-2">
            <Label>Bio</Label>
                <Textarea
                  value={brandData.bio}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, bio: event.target.value.trim() }))
              }
              placeholder="Creating beautiful transformations with personalized beauty solutions."
                />
              </div>
          <div className="grid gap-2">
            <Label>Instagram Handle</Label>
                    <Input
                      value={brandData.socialInstagram}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, socialInstagram: event.target.value.trim() }))
              }
              placeholder="@elegantbeauty"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Facebook Page</Label>
                    <Input
                      value={brandData.socialFacebook}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, socialFacebook: event.target.value.trim() }))
              }
              placeholder="Elegant Beauty Studio"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>TikTok Handle</Label>
                    <Input
                      value={brandData.socialTiktok}
              onChange={(event) =>
                setBrandData((prev) => ({ ...prev, socialTiktok: event.target.value.trim() }))
              }
              placeholder="@elegantbeauty"
                    />
                  </div>
          <Button onClick={() => saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Branding'}
                </Button>
              </div>
            </CardContent>
          </Card>
  )

  const renderNotificationsCard = () => (
          <Card>
            <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Notifications
              </CardTitle>
              <p className="text-sm text-muted-foreground">
          Configure email and SMS notifications for different events.
              </p>
            </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Email Marketing</Label>
            <Switch
              checked={notifications.emailMarketing}
              onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, emailMarketing: checked }))}
                      />
                    </div>
          <div className="grid gap-2">
            <Label>Appointment Reminders</Label>
            <Switch
              checked={notifications.appointmentReminders}
              onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, appointmentReminders: checked }))}
            />
                      </div>
          <div className="grid gap-2">
            <Label>Client Updates</Label>
            <Switch
              checked={notifications.clientUpdates}
              onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, clientUpdates: checked }))}
            />
                    </div>
          <div className="grid gap-2">
            <Label>System Updates</Label>
            <Switch
              checked={notifications.systemUpdates}
              onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, systemUpdates: checked }))}
                      />
                    </div>
          <Button onClick={() => saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Notifications'}
                    </Button>
                  </div>
            </CardContent>
          </Card>
  )

  const renderGoalsCard = () => (
          <Card>
            <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Goals
              </CardTitle>
              <p className="text-sm text-muted-foreground">
          Set and track your business goals to measure performance.
              </p>
            </CardHeader>
                <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Weekly Clients</Label>
                    <Input
                      type="number"
                      value={goals.weeklyClients}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, weeklyClients: parseInt(event.target.value, 10) }))
              }
              placeholder="25"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Monthly Clients</Label>
                    <Input
                      type="number"
                      value={goals.monthlyClients}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, monthlyClients: parseInt(event.target.value, 10) }))
              }
              placeholder="100"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Client Retention Rate</Label>
                    <Input
                      type="number"
                      value={goals.clientRetentionRate}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, clientRetentionRate: parseInt(event.target.value, 10) }))
              }
              placeholder="85"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>New Clients Per Month</Label>
                    <Input
                      type="number"
                      value={goals.newClientsPerMonth}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, newClientsPerMonth: parseInt(event.target.value, 10) }))
              }
              placeholder="15"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Monthly Revenue</Label>
                    <Input
                      type="number"
                      value={goals.monthlyRevenue}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, monthlyRevenue: parseInt(event.target.value, 10) }))
              }
              placeholder="8000"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Yearly Revenue</Label>
                    <Input
                      type="number"
                      value={goals.yearlyRevenue}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, yearlyRevenue: parseInt(event.target.value, 10) }))
              }
              placeholder="96000"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Average Service Price</Label>
                    <Input
                      type="number"
                      value={goals.averageServicePrice}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, averageServicePrice: parseInt(event.target.value, 10) }))
              }
              placeholder="120"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Upsell Rate</Label>
                    <Input
                      type="number"
                      value={goals.upsellRate}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, upsellRate: parseInt(event.target.value, 10) }))
              }
              placeholder="30"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Social Media Followers</Label>
                    <Input
                      type="number"
                      value={goals.socialMediaFollowers}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, socialMediaFollowers: parseInt(event.target.value, 10) }))
              }
              placeholder="5000"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Email List Size</Label>
                    <Input
                      type="number"
                      value={goals.emailListSize}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, emailListSize: parseInt(event.target.value, 10) }))
              }
              placeholder="1000"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Referral Rate</Label>
                    <Input
                      type="number"
                      value={goals.referralRate}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, referralRate: parseInt(event.target.value, 10) }))
              }
              placeholder="20"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Booking Conversion Rate</Label>
                    <Input
                      type="number"
                      value={goals.bookingConversionRate}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, bookingConversionRate: parseInt(event.target.value, 10) }))
              }
              placeholder="60"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Hours Worked Per Week</Label>
                    <Input
                      type="number"
                      value={goals.hoursWorkedPerWeek}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, hoursWorkedPerWeek: parseInt(event.target.value, 10) }))
              }
              placeholder="35"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Average Service Time</Label>
                    <Input
                      type="number"
                      value={goals.averageServiceTime}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, averageServiceTime: parseInt(event.target.value, 10) }))
              }
              placeholder="90"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Booking Buffer</Label>
                    <Input
                      type="number"
                      value={goals.bookingBuffer}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, bookingBuffer: parseInt(event.target.value, 10) }))
              }
              placeholder="15"
                    />
                  </div>
          <div className="grid gap-2">
            <Label>Admin Time Per Day</Label>
                    <Input
                      type="number"
                      value={goals.adminTimePerDay}
              onChange={(event) =>
                setGoals((prev) => ({ ...prev, adminTimePerDay: parseInt(event.target.value, 10) }))
              }
              placeholder="30"
                    />
                  </div>
          <Button onClick={() => saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Goals'}
          </Button>
                </div>
              </CardContent>
            </Card>
  )

  const renderQuietHoursCard = () => (
            <Card>
              <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Quiet Hours
        </CardTitle>
                <p className="text-sm text-muted-foreground">
          Set your business's quiet hours to avoid interruptions during off-peak times.
                </p>
              </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={quietHours.start}
              onChange={(event) =>
                setQuietHours((prev) => ({ ...prev, start: event.target.value }))
              }
            />
                  </div>
          <div className="grid gap-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={quietHours.end}
              onChange={(event) =>
                setQuietHours((prev) => ({ ...prev, end: event.target.value }))
              }
            />
                  </div>
          <Button onClick={() => saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Quiet Hours'}
          </Button>
                </div>
              </CardContent>
            </Card>
  )

  const renderToneCard = () => (
            <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Tone
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the tone for your communications.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Tone</Label>
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Training Notes</Label>
            <Textarea
              value={trainingNotes}
              onChange={(event) => setTrainingNotes(event.target.value)}
              placeholder="Notes for the AI training model."
            />
          </div>
          <Button onClick={() => saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Tone'}
                </Button>
        </div>
              </CardContent>
            </Card>
  )

  const renderPreferencesCard = () => (
    <div className="space-y-6">
      {renderNotificationsCard()}
      
      <div className="border-t border-border" />
      
      {renderGoalsCard()}
      
      <div className="border-t border-border" />
      
      {renderQuietHoursCard()}
      
      <div className="border-t border-border" />
      
      {renderToneCard()}
    </div>
  )

  const renderOnboardingCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <CardIcon />
          Onboarding
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete your onboarding process and set up your first appointment.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <OnboardingSettings />
      </CardContent>
    </Card>
  )

  const renderTabs = () => {
    // Map legacy tab names to new structure
    const normalizedTab = 
      initialTab === 'profile' || initialTab === 'business' ? 'account' :
      initialTab === 'notifications' || initialTab === 'goals' || initialTab === 'quiet-hours' || initialTab === 'tone' ? 'preferences' :
      initialTab === 'plan' ? 'billing' :
      initialTab

    return (
      <Tabs defaultValue={normalizedTab} className="w-full">
        <TabsList className="w-full flex flex-wrap gap-2">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          {renderAccountCard()}
        </TabsContent>
        
        <TabsContent value="branding">
          {renderBrandCard()}
        </TabsContent>
        
        <TabsContent value="integrations">
          {renderIntegrations()}
        </TabsContent>
        
        <TabsContent value="billing">
          {renderPlanBillingCard()}
        </TabsContent>
        
        <TabsContent value="preferences">
          {renderPreferencesCard()}
        </TabsContent>
        
        <TabsContent value="onboarding">
          {renderOnboardingCard()}
        </TabsContent>
      </Tabs>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <CardIcon />
            Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your application settings and preferences.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            renderTabs()
          )}
        </CardContent>
      </Card>
    </div>
  )
}
