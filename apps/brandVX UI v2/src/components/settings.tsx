import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Alert, AlertDescription } from './ui/alert'
import { getCurrentTwilioConfig, saveTwilioConfig, removeTwilioConfig, isTwilioConfigured } from './twilio-service'
import { OnboardingSettings } from './onboarding-settings'
import { toast } from 'sonner@2.0.3'
import { 
  User, 
  Building2, 
  Palette, 
  CreditCard, 
  Settings as SettingsIcon,
  Crown,
  Check,
  Mail,
  Phone,
  MapPin,
  Clock,
  Camera,
  Save,
  Sparkles,
  Target,
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Plug,
  MessageSquare,
  Shield,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  BookOpen
} from 'lucide-react'

const PLAN_TIERS = [
  {
    name: 'Essentials',
    price: 47,
    description: 'Essential features for growing beauty professionals',
    features: [
      'Essential scheduling and client management',
      'Basic analytics and messaging',
      'Up to 100 clients',
      'Email support'
    ],
    color: 'border-muted',
    badge: null
  },
  {
    name: 'Pro',
    price: 97,
    description: 'Advanced tools for established beauty businesses',
    features: [
      'Everything in Essentials plus:',
      'Advanced analytics and automation',
      'Inventory management',
      'Up to 500 clients',
      'Priority support',
      'Custom branding'
    ],
    color: 'border-primary',
    badge: 'Most Popular'
  },
  {
    name: 'Premium',
    price: 147,
    description: 'Complete solution for beauty business owners',
    features: [
      'Everything in Pro plus:',
      'Advanced AI features',
      'Custom integrations',
      'Unlimited clients',
      'White-label options',
      'Dedicated account manager'
    ],
    color: 'border-accent',
    badge: 'Best Value'
  }
]

interface SettingsProps {
  userData?: any
  initialTab?: string
}

export function Settings({ userData, initialTab = 'profile' }: SettingsProps) {
  const [currentPlan] = useState(userData?.plan?.charAt(0).toUpperCase() + userData?.plan?.slice(1) || 'Pro')
  const [profileData, setProfileData] = useState({
    firstName: userData?.fullName?.split(' ')[0] || 'Sarah',
    lastName: userData?.fullName?.split(' ')[1] || 'Johnson',
    email: userData?.email || 'sarah@elegantbeauty.com',
    phone: '+1 (555) 123-4567',
    profileImage: null
  })
  
  const [businessData, setBusinessData] = useState({
    businessName: userData?.businessName || 'Elegant Beauty Studio',
    address: '123 Beauty Lane, Beverly Hills, CA 90210',
    phone: '+1 (555) 123-4567',
    email: 'hello@elegantbeauty.com',
    website: 'www.elegantbeauty.com',
    hours: 'Mon-Fri: 9AM-7PM, Sat: 9AM-5PM, Sun: Closed',
    description: 'Premium beauty services specializing in skincare, makeup, and wellness treatments.'
  })
  
  const [brandData, setBrandData] = useState({
    primaryColor: '#E03C91',
    accentColor: '#2F5D9F',
    logo: null,
    tagline: 'Where Beauty Meets Excellence',
    bio: 'Creating beautiful transformations with personalized beauty solutions.',
    socialInstagram: '@elegantbeauty',
    socialFacebook: 'Elegant Beauty Studio',
    socialTiktok: '@elegantbeauty'
  })

  const [notifications, setNotifications] = useState({
    emailMarketing: true,
    appointmentReminders: true,
    clientUpdates: true,
    systemUpdates: false
  })

  const [goals, setGoals] = useState({
    // Client Goals
    weeklyClients: 25,
    monthlyClients: 100,
    clientRetentionRate: 85,
    newClientsPerMonth: 15,
    
    // Revenue Goals
    monthlyRevenue: 8000,
    yearlyRevenue: 96000,
    averageServicePrice: 120,
    upsellRate: 30,
    
    // Business Growth Goals
    socialMediaFollowers: 5000,
    emailListSize: 1000,
    referralRate: 20,
    bookingConversionRate: 60,
    
    // Time Management Goals
    hoursWorkedPerWeek: 35,
    averageServiceTime: 90,
    bookingBuffer: 15,
    adminTimePerDay: 30
  })

  const [twilioData, setTwilioData] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
    showAuthToken: false
  })

  const [twilioConfigured, setTwilioConfigured] = useState(isTwilioConfigured())

  const handleSaveProfile = () => {
    // Save profile logic here
    console.log('Saving profile...', profileData)
  }

  const handleSaveBusiness = () => {
    // Save business logic here
    console.log('Saving business...', businessData)
  }

  const handleSaveBrand = () => {
    // Save brand logic here
    console.log('Saving brand...', brandData)
  }

  const handleSaveGoals = () => {
    // Save goals logic here
    console.log('Saving goals...', goals)
  }

  const handleSaveTwilio = () => {
    if (!twilioData.accountSid || !twilioData.authToken || !twilioData.phoneNumber) {
      toast.error('Please fill in all Twilio configuration fields')
      return
    }

    saveTwilioConfig({
      accountSid: twilioData.accountSid,
      authToken: twilioData.authToken,
      phoneNumber: twilioData.phoneNumber
    })
    
    setTwilioConfigured(true)
    
    // Clear the form after saving
    setTwilioData({
      accountSid: '',
      authToken: '',
      phoneNumber: '',
      showAuthToken: false
    })
  }

  const handleRemoveTwilio = () => {
    removeTwilioConfig()
    setTwilioConfigured(false)
    setTwilioData({
      accountSid: '',
      authToken: '',
      phoneNumber: '',
      showAuthToken: false
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black flex items-center space-x-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          <div className="p-2 bg-primary/10 rounded-full">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <span>Settings</span>
        </h1>
        <p className="text-muted-foreground mt-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Manage your account, business information, and preferences
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center space-x-2">
            <Building2 className="h-4 w-4" />
            <span>Business</span>
          </TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span>Brand</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center space-x-2">
            <Plug className="h-4 w-4" />
            <span>Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4" />
            <span>Tours</span>
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Goals</span>
          </TabsTrigger>
          <TabsTrigger value="plan" className="flex items-center space-x-2">
            <CreditCard className="h-4 w-4" />
            <span>Plan</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Profile Information</CardTitle>
              <p className="text-sm text-muted-foreground">
                Update your personal information and account details
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Image */}
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Camera className="h-4 w-4" />
                    <span>Upload Photo</span>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or GIF (max. 2MB)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 style={{ fontFamily: 'Playfair Display, serif' }}>Notification Preferences</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Marketing</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive marketing emails and beauty tips
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailMarketing}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailMarketing: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Appointment Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about upcoming appointments
                      </p>
                    </div>
                    <Switch
                      checked={notifications.appointmentReminders}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, appointmentReminders: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Client Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications about client activities
                      </p>
                    </div>
                    <Switch
                      checked={notifications.clientUpdates}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, clientUpdates: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Platform updates and maintenance notices
                      </p>
                    </div>
                    <Switch
                      checked={notifications.systemUpdates}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, systemUpdates: checked }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Tab */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Business Information</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your business details and contact information
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessData.businessName}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input
                  id="address"
                  value={businessData.address}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Phone</Label>
                  <Input
                    id="businessPhone"
                    value={businessData.phone}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={businessData.email}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={businessData.website}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">Business Hours</Label>
                <Input
                  id="hours"
                  value={businessData.hours}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, hours: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Business Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={businessData.description}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveBusiness} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand Tab */}
        <TabsContent value="brand" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Brand Identity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize your brand colors, logo, and messaging
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Brand Logo</Label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Camera className="h-4 w-4" />
                    <span>Upload Logo</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-10 h-10 rounded border-2 border-border"
                      style={{ backgroundColor: brandData.primaryColor }}
                    />
                    <Input
                      id="primaryColor"
                      value={brandData.primaryColor}
                      onChange={(e) => setBrandData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-10 h-10 rounded border-2 border-border"
                      style={{ backgroundColor: brandData.accentColor }}
                    />
                    <Input
                      id="accentColor"
                      value={brandData.accentColor}
                      onChange={(e) => setBrandData(prev => ({ ...prev, accentColor: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Brand Tagline</Label>
                <Input
                  id="tagline"
                  value={brandData.tagline}
                  onChange={(e) => setBrandData(prev => ({ ...prev, tagline: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Brand Bio</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  value={brandData.bio}
                  onChange={(e) => setBrandData(prev => ({ ...prev, bio: e.target.value }))}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 style={{ fontFamily: 'Playfair Display, serif' }}>Social Media</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram Handle</Label>
                    <Input
                      id="instagram"
                      placeholder="@yourbusiness"
                      value={brandData.socialInstagram}
                      onChange={(e) => setBrandData(prev => ({ ...prev, socialInstagram: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook Page</Label>
                    <Input
                      id="facebook"
                      value={brandData.socialFacebook}
                      onChange={(e) => setBrandData(prev => ({ ...prev, socialFacebook: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok Handle</Label>
                    <Input
                      id="tiktok"
                      placeholder="@yourbusiness"
                      value={brandData.socialTiktok}
                      onChange={(e) => setBrandData(prev => ({ ...prev, socialTiktok: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveBrand} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Twilio SMS Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                <MessageSquare className="h-5 w-5 text-primary" />
                <span>Twilio SMS Integration</span>
                {twilioConfigured && (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Connect your Twilio account to send SMS messages to clients
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {!twilioConfigured ? (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You'll need a Twilio account to use SMS features. Sign up at{' '}
                      <a href="https://twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        twilio.com
                      </a>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountSid">Account SID</Label>
                      <Input
                        id="accountSid"
                        type="text"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={twilioData.accountSid}
                        onChange={(e) => setTwilioData(prev => ({ ...prev, accountSid: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authToken">Auth Token</Label>
                      <div className="relative">
                        <Input
                          id="authToken"
                          type={twilioData.showAuthToken ? "text" : "password"}
                          placeholder="your_auth_token_here"
                          value={twilioData.authToken}
                          onChange={(e) => setTwilioData(prev => ({ ...prev, authToken: e.target.value }))}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setTwilioData(prev => ({ ...prev, showAuthToken: !prev.showAuthToken }))}
                        >
                          {twilioData.showAuthToken ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Twilio Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="+1234567890"
                        value={twilioData.phoneNumber}
                        onChange={(e) => setTwilioData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      />
                    </div>

                    <Button onClick={handleSaveTwilio} className="w-full">
                      <Plug className="h-4 w-4 mr-2" />
                      Connect Twilio
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-900">Twilio Connected Successfully</p>
                        <p className="text-sm text-green-700">SMS messaging is now enabled for your account</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      SMS Active
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      Client Reminders
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                      Booking Confirmations
                    </Badge>
                  </div>

                  <Button 
                    onClick={handleRemoveTwilio}
                    variant="outline" 
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Disconnect Twilio
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Square POS Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                <CreditCard className="h-5 w-5 text-primary" />
                <span>Square POS Integration</span>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sync your Square POS system for seamless payment processing and inventory management
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Square POS Connected</p>
                    <p className="text-sm text-blue-700">Payments and inventory are synced automatically</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-blue-200 text-blue-600 hover:bg-blue-50">
                  Settings
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-primary">$12,847</div>
                  <div className="text-sm text-muted-foreground">This Month</div>
                </div>
                <div className="text-center p-4 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-accent">342</div>
                  <div className="text-sm text-muted-foreground">Transactions</div>
                </div>
                <div className="text-center p-4 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-secondary">98.2%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Automatic Payment Sync</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Inventory Management</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Customer Receipt Emails</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Square Terminal Connected</p>
                  <p className="text-sm text-muted-foreground">Device ID: CP***7891</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Online</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acuity Scheduling Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                <Calendar className="h-5 w-5 text-primary" />
                <span>Acuity Scheduling Integration</span>
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sync your Acuity appointments and client data with your BVX dashboard
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">Acuity Scheduling Connected</p>
                    <p className="text-sm text-purple-700">Appointments sync every 15 minutes</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-purple-200 text-purple-600 hover:bg-purple-50">
                  Manage
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-primary">47</div>
                  <div className="text-sm text-muted-foreground">This Week's Bookings</div>
                </div>
                <div className="text-center p-4 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-accent">92%</div>
                  <div className="text-sm text-muted-foreground">Booking Rate</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Two-way Calendar Sync</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Client Information Sync</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Automated Confirmations</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Payment Processing</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Sync:</span>
                  <span className="text-sm text-muted-foreground">2 minutes ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sync Status:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Healthy</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Connected Services:</span>
                  <span className="text-sm text-muted-foreground">Calendar, Clients, Payments</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Integrations */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Available Integrations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Connect more tools to streamline your beauty business workflow
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Mail className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Mailchimp</p>
                      <Badge variant="outline" size="sm" className="text-xs">Coming Soon</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Email marketing automation</p>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Analytics</p>
                      <Badge variant="outline" size="sm" className="text-xs">Coming Soon</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Website traffic insights</p>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-full">
                      <Camera className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Instagram Business</p>
                      <Badge variant="outline" size="sm" className="text-xs">Coming Soon</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Social media management</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-6">
          <OnboardingSettings />
        </TabsContent>

        {/* Plan Tab */}
        <TabsContent value="plan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Your Plan</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your subscription and billing information
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Current Plan: {currentPlan}</p>
                    <p className="text-sm text-muted-foreground">
                      ${PLAN_TIERS.find(tier => tier.name === currentPlan)?.price}/month
                    </p>
                  </div>
                </div>
                <Badge className="bg-primary text-white">Active</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PLAN_TIERS.map((tier) => (
              <Card key={tier.name} className={`relative ${tier.color} ${currentPlan === tier.name ? 'ring-2 ring-primary' : ''}`}>
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-white px-3 py-1">
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
                    {tier.name}
                  </CardTitle>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-primary">
                      ${tier.price}
                      <span className="text-base font-normal text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tier.description}
                    </p>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full ${currentPlan === tier.name ? 'bg-muted text-muted-foreground' : 'bg-primary text-white hover:bg-primary/90'}`}
                    disabled={currentPlan === tier.name}
                  >
                    {currentPlan === tier.name ? 'Current Plan' : `Upgrade to ${tier.name}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">•••• •••• •••• 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Next billing date:</span>
                <span className="font-medium">January 15, 2024</span>
              </div>
              
              <Button variant="outline" className="w-full">
                Download Invoice History
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-6">
          <div className="grid gap-6">
            {/* Client Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Users className="h-5 w-5 text-primary" />
                  <span>Client Goals</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set targets for client acquisition and retention
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weeklyClients">Weekly Client Target</Label>
                    <Input
                      id="weeklyClients"
                      type="number"
                      value={goals.weeklyClients}
                      onChange={(e) => setGoals({...goals, weeklyClients: parseInt(e.target.value) || 0})}
                      placeholder="Number of clients per week"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyClients">Monthly Client Target</Label>
                    <Input
                      id="monthlyClients"
                      type="number"
                      value={goals.monthlyClients}
                      onChange={(e) => setGoals({...goals, monthlyClients: parseInt(e.target.value) || 0})}
                      placeholder="Number of clients per month"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientRetentionRate">Client Retention Rate (%)</Label>
                    <Input
                      id="clientRetentionRate"
                      type="number"
                      value={goals.clientRetentionRate}
                      onChange={(e) => setGoals({...goals, clientRetentionRate: parseInt(e.target.value) || 0})}
                      placeholder="Target retention percentage"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newClientsPerMonth">New Clients per Month</Label>
                    <Input
                      id="newClientsPerMonth"
                      type="number"
                      value={goals.newClientsPerMonth}
                      onChange={(e) => setGoals({...goals, newClientsPerMonth: parseInt(e.target.value) || 0})}
                      placeholder="New client acquisition target"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span>Revenue Goals</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set financial targets and pricing strategies
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRevenue">Monthly Revenue Target ($)</Label>
                    <Input
                      id="monthlyRevenue"
                      type="number"
                      value={goals.monthlyRevenue}
                      onChange={(e) => setGoals({...goals, monthlyRevenue: parseInt(e.target.value) || 0})}
                      placeholder="Monthly revenue goal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearlyRevenue">Yearly Revenue Target ($)</Label>
                    <Input
                      id="yearlyRevenue"
                      type="number"
                      value={goals.yearlyRevenue}
                      onChange={(e) => setGoals({...goals, yearlyRevenue: parseInt(e.target.value) || 0})}
                      placeholder="Annual revenue goal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageServicePrice">Average Service Price ($)</Label>
                    <Input
                      id="averageServicePrice"
                      type="number"
                      value={goals.averageServicePrice}
                      onChange={(e) => setGoals({...goals, averageServicePrice: parseInt(e.target.value) || 0})}
                      placeholder="Target average service price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upsellRate">Upsell Rate (%)</Label>
                    <Input
                      id="upsellRate"
                      type="number"
                      value={goals.upsellRate}
                      onChange={(e) => setGoals({...goals, upsellRate: parseInt(e.target.value) || 0})}
                      placeholder="Target upsell percentage"
                      max="100"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Growth Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>Business Growth Goals</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set targets for marketing and business expansion
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="socialMediaFollowers">Social Media Followers</Label>
                    <Input
                      id="socialMediaFollowers"
                      type="number"
                      value={goals.socialMediaFollowers}
                      onChange={(e) => setGoals({...goals, socialMediaFollowers: parseInt(e.target.value) || 0})}
                      placeholder="Target follower count"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailListSize">Email List Size</Label>
                    <Input
                      id="emailListSize"
                      type="number"
                      value={goals.emailListSize}
                      onChange={(e) => setGoals({...goals, emailListSize: parseInt(e.target.value) || 0})}
                      placeholder="Target email subscribers"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referralRate">Referral Rate (%)</Label>
                    <Input
                      id="referralRate"
                      type="number"
                      value={goals.referralRate}
                      onChange={(e) => setGoals({...goals, referralRate: parseInt(e.target.value) || 0})}
                      placeholder="Target referral percentage"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bookingConversionRate">Booking Conversion Rate (%)</Label>
                    <Input
                      id="bookingConversionRate"
                      type="number"
                      value={goals.bookingConversionRate}
                      onChange={(e) => setGoals({...goals, bookingConversionRate: parseInt(e.target.value) || 0})}
                      placeholder="Lead to booking conversion"
                      max="100"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time Management Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Clock className="h-5 w-5 text-primary" />
                  <span>Time Management Goals</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set targets for work-life balance and efficiency
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hoursWorkedPerWeek">Hours Worked per Week</Label>
                    <Input
                      id="hoursWorkedPerWeek"
                      type="number"
                      value={goals.hoursWorkedPerWeek}
                      onChange={(e) => setGoals({...goals, hoursWorkedPerWeek: parseInt(e.target.value) || 0})}
                      placeholder="Target weekly work hours"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageServiceTime">Average Service Time (minutes)</Label>
                    <Input
                      id="averageServiceTime"
                      type="number"
                      value={goals.averageServiceTime}
                      onChange={(e) => setGoals({...goals, averageServiceTime: parseInt(e.target.value) || 0})}
                      placeholder="Target service duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bookingBuffer">Booking Buffer (minutes)</Label>
                    <Input
                      id="bookingBuffer"
                      type="number"
                      value={goals.bookingBuffer}
                      onChange={(e) => setGoals({...goals, bookingBuffer: parseInt(e.target.value) || 0})}
                      placeholder="Time between appointments"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminTimePerDay">Admin Time per Day (minutes)</Label>
                    <Input
                      id="adminTimePerDay"
                      type="number"
                      value={goals.adminTimePerDay}
                      onChange={(e) => setGoals({...goals, adminTimePerDay: parseInt(e.target.value) || 0})}
                      placeholder="Daily administrative tasks"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goal Tracking Summary */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Goal Summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quick overview of your key targets
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary">${goals.monthlyRevenue.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Monthly Revenue Goal</div>
                  </div>
                  <div className="text-center p-4 bg-accent/5 rounded-lg">
                    <div className="text-2xl font-bold text-accent">{goals.weeklyClients}</div>
                    <div className="text-sm text-muted-foreground">Weekly Client Target</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg">
                    <div className="text-2xl font-bold text-black">{goals.clientRetentionRate}%</div>
                    <div className="text-sm text-muted-foreground">Retention Rate Goal</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Goals */}
            <Card>
              <CardContent className="pt-6">
                <Button 
                  onClick={handleSaveGoals}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Goals
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}