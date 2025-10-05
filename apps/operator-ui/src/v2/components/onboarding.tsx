// @ts-nocheck
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Palette, Users, Briefcase, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import bvxLogo from '../assets/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'
import { api, getTenant } from '../../lib/api'
import { startOAuth } from '../../sdk/connectionsClient'

interface OnboardingProps {
  userData: any
  onComplete: (updatedProfile: any) => void
}

interface OnboardingData {
  jobTitle: string
  businessName: string
  services: string[]
  monthlyClients: string
  primaryColor: string
  secondaryColor: string
  brandStyle: string
  businessGoals: string
  experience: string
}

const JOB_TITLES = [
  'Esthetician',
  'Cosmetologist/Hair Stylist',
  'Nail Technician',
  'Lash Artist',
  'Massage Therapist',
  'Other'
]

const SERVICES_OPTIONS = [
  'Facials & Skincare',
  'Hair Styling & Color',
  'Nail Services',
  'Lash Extensions',
  'Microblading/PMU',
  'Massage Therapy',
  'Waxing Services',
  'Makeup Application',
  'Body Treatments',
  'Anti-Aging Treatments',
  'Acne Treatments',
  'Chemical Peels',
  'Other'
]

const MONTHLY_CLIENTS = [
  '1-10 clients',
  '11-25 clients',
  '26-50 clients',
  '51-100 clients',
  '100+ clients'
]

const BRAND_STYLES = [
  'Modern & Minimalist',
  'Luxurious & Elegant',
  'Fun & Vibrant',
  'Natural & Organic',
  'Professional & Clean',
  'Trendy & Edgy'
]

export function Onboarding({ userData, onComplete }: OnboardingProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    jobTitle: '',
    businessName: '',
    services: [],
    monthlyClients: '',
    primaryColor: '#E03C91',
    secondaryColor: '#2F5D9F',
    brandStyle: '',
    businessGoals: '',
    experience: ''
  })
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({ square: false, acuity: false })
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const tenantId = await getTenant()
        const status = await api.get(`/integrations/status?tenant_id=${encodeURIComponent(tenantId)}`)
        const providers = status?.providers || {}
        setIntegrations({
          square: Boolean(providers?.square?.linked),
          acuity: Boolean(providers?.acuity?.linked),
        })
      } catch (err) {
        console.error('Failed to load integration status', err)
      }
    })()
  }, [])

  const handleOAuthConnect = async (provider: 'square' | 'acuity') => {
    try {
      setConnectingProvider(provider)
      await startOAuth(provider, { returnTo: 'workspace' })
    } catch (err) {
      console.error(`Failed to connect ${provider}`, err)
      setErrorMessage(`Unable to connect ${provider}. Please try again.`)
    } finally {
      setConnectingProvider(null)
    }
  }

  const handleServiceToggle = (service: string) => {
    setOnboardingData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }))
  }

  const isFormValid = () => {
    return (
      onboardingData.jobTitle &&
      onboardingData.businessName &&
      onboardingData.services.length > 0 &&
      onboardingData.monthlyClients &&
      onboardingData.brandStyle
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    try {
      let tenantId = await getTenant()
      if (!tenantId) {
        try {
          const me = await api.get('/me', { includeTenant: false })
          const resolved = typeof me?.tenant_id === 'string' ? me.tenant_id.trim() : ''
          if (resolved) {
            tenantId = resolved
            try { localStorage.setItem('bvx_tenant', resolved) } catch {}
          }
        } catch (lookupError) {
          console.warn('Unable to resolve tenant before onboarding submit', lookupError)
        }
      }
      if (!tenantId) {
        setErrorMessage('We are finalizing your workspace. Please try again in a moment.')
        return
      }
      const payload: Record<string, any> = {
        tenant_id: tenantId,
        onboarding_completed: true,
        brand_profile: {
          business_name: onboardingData.businessName,
          job_title: onboardingData.jobTitle,
          primary_color: onboardingData.primaryColor,
          secondary_color: onboardingData.secondaryColor,
          brand_style: onboardingData.brandStyle,
          owner_name: userData?.fullName || userData?.name || '',
        },
        services: onboardingData.services,
        preferences: {
          business_goals: onboardingData.businessGoals,
          experience: onboardingData.experience,
          monthly_clients: onboardingData.monthlyClients,
        },
      }
      await api.post('/settings', payload)
      onComplete({
        ...userData,
        businessName: onboardingData.businessName,
        jobTitle: onboardingData.jobTitle,
      })
    } catch (err: any) {
      setErrorMessage(String(err?.message || err || 'Unable to save onboarding details'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-4xl"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <img src={bvxLogo} alt="BVX Logo" className="h-16 w-auto mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-black mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Let's Personalize Your Experience
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Tell us about your beauty business so we can customize BVX to work perfectly for you
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="border-primary/20 shadow-xl">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-center text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                Business Setup
              </CardTitle>
              <CardDescription className="text-center">
                This will help us create a personalized dashboard for your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Briefcase className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Professional Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="text-black font-medium">What's your profession? *</Label>
                      <Select value={onboardingData.jobTitle} onValueChange={(value) => setOnboardingData(prev => ({ ...prev, jobTitle: value }))}>
                        <SelectTrigger className="border-primary/20 focus:border-primary">
                          <SelectValue placeholder="Select your profession" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_TITLES.map(title => (
                            <SelectItem key={title} value={title}>{title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessName" className="text-black font-medium">Business Name *</Label>
                      <Input
                        id="businessName"
                        value={onboardingData.businessName}
                        onChange={(e) => setOnboardingData(prev => ({ ...prev, businessName: e.target.value }))}
                        placeholder="Elegant Beauty Studio"
                        className="border-primary/20 focus:border-primary"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Users className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Clients & Services
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="monthlyClients" className="text-black font-medium">Monthly Client Volume *</Label>
                      <Select value={onboardingData.monthlyClients} onValueChange={(value) => setOnboardingData(prev => ({ ...prev, monthlyClients: value }))}>
                        <SelectTrigger className="border-primary/20 focus:border-primary">
                          <SelectValue placeholder="Select a range" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHLY_CLIENTS.map(range => (
                            <SelectItem key={range} value={range}>{range}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-black font-medium">Primary Services *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICES_OPTIONS.map(service => {
                          const active = onboardingData.services.includes(service)
                          return (
                            <button
                              key={service}
                              type="button"
                              onClick={() => handleServiceToggle(service)}
                              className={`text-xs rounded-lg border px-3 py-2 text-left transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-muted bg-white hover:border-primary/40'}`}
                            >
                              {service}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">Select all that apply</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Palette className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Brand & Goals
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-black font-medium">Brand Style *</Label>
                      <Select value={onboardingData.brandStyle} onValueChange={(value) => setOnboardingData(prev => ({ ...prev, brandStyle: value }))}>
                        <SelectTrigger className="border-primary/20 focus:border-primary">
                          <SelectValue placeholder="Select a style" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAND_STYLES.map(style => (
                            <SelectItem key={style} value={style}>{style}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-black font-medium">Primary Color</Label>
                        <Input
                          type="color"
                          value={onboardingData.primaryColor}
                          onChange={(e) => setOnboardingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="h-12 w-full border-primary/20"
                        />
                      </div>
                      <div>
                        <Label className="text-black font-medium">Accent Color</Label>
                        <Input
                          type="color"
                          value={onboardingData.secondaryColor}
                          onChange={(e) => setOnboardingData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          className="h-12 w-full border-primary/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-black font-medium">Business Goals</Label>
                      <Textarea
                        value={onboardingData.businessGoals}
                        onChange={(e) => setOnboardingData(prev => ({ ...prev, businessGoals: e.target.value }))}
                        placeholder="Grow your recurring clients, sell more retail, launch VIP memberships..."
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                  <div className="space-y-2">
                    <Label className="text-black font-medium">Experience Level</Label>
                    <Textarea
                      value={onboardingData.experience}
                      onChange={(e) => setOnboardingData(prev => ({ ...prev, experience: e.target.value }))}
                      placeholder="Tell us about your background and specialties"
                      className="border-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-4 border-t border-primary/10 pt-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Briefcase className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Connect Your Booking System (Optional)
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Link Square or Acuity to sync appointments and client data automatically. You can skip this and connect later in Settings.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['square', 'acuity'] as const).map((provider) => (
                      <Button
                        key={provider}
                        type="button"
                        onClick={() => handleOAuthConnect(provider)}
                        disabled={connectingProvider !== null || integrations[provider]}
                        className={`flex items-center justify-between px-6 py-6 h-auto ${
                          integrations[provider]
                            ? 'bg-emerald-500 hover:bg-emerald-600'
                            : 'bg-primary hover:bg-primary/90'
                        }`}
                      >
                        <span className="font-semibold text-lg">
                          {provider.charAt(0).toUpperCase() + provider.slice(1)}
                        </span>
                        {integrations[provider] ? (
                          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Connected
                          </Badge>
                        ) : connectingProvider === provider ? (
                          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                            Connecting...
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                            Not connected
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                  <div className="flex items-center space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.history.back()}
                      className="flex items-center space-x-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </Button>
                    <Button type="submit" disabled={!isFormValid() || isLoading}>
                      {isLoading ? 'Saving…' : (
                        <div className="flex items-center space-x-2">
                          <span>Complete setup</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
              {errorMessage && (
                <p className="text-sm text-red-600 text-center" role="alert">{errorMessage}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
