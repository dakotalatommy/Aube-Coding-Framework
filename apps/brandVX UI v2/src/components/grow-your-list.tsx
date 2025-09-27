import { useState, useEffect, lazy, Suspense } from 'react'

const EditableLandingPage = lazy(() => import('./editable-landing-page'))
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { toast } from 'sonner@2.0.3'
import { 
  MousePointer,
  Link2,
  Zap,
  Eye,
  Copy,
  Monitor,
  Smartphone,
  ExternalLink,
  Star,
  MessageSquare,
  Target,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  CheckCircle,
  Edit3,
  Calendar,
  Heart,
  Phone,
  Plus,
  Trash2,
  User,
  Link,
  ArrowRight,
  Users,
  TrendingUp,
  Globe,
  Share2,
  Settings,
  GripVertical,
  Palette,
  Download,
  ShoppingBag,
  Mail,
  MapPin,
  Play,
  Camera,
  Music,
  Scissors,
  Sparkles,
  Gift,
  Clock,
  BarChart3,
  Activity,
  DollarSign,
  Percent,
  ChevronUp,
  ChevronDown,
  CalendarDays,
  MoreVertical,
  Filter,
  TrendingDown,
  MousePointerClick,
  UserPlus,
  Smartphone as SmartphoneIcon,
  Laptop,
  Tablet,
  ArrowUpRight,
  AlertCircle,
  Tabs
} from 'lucide-react'

// Storage keys for remembering setups
const STORAGE_KEYS = {
  LINK_IN_BIO_SETUP: 'bvx_link_in_bio_setup',
  LANDING_PAGE_SETUP: 'bvx_landing_page_setup',
  LANDING_PAGE_CONFIG: 'bvx_landing_page_config',
  LANDING_PAGE_URL: 'bvx_landing_page_url',
  SELECTED_OPTION: 'bvx_grow_list_option'
}

const defaultLinkInBioConfig = {
  headline: "Get 20% Off Your First Visit!",
  subheadline: "Join our VIP list for exclusive beauty deals and tips",
  description: "Transform your beauty routine with our expert services. Book now and save on your first appointment with us!",
  buttonText: "Claim My Discount",
  backgroundColor: "#E03C91",
  textColor: "#FFFFFF",
  buttonColor: "#2F5D9F",
  businessInfo: {
    name: "Elegant Beauty Studio",
    phone: "(555) 123-4567",
    email: "hello@elegantbeauty.com",
    address: "123 Beauty Lane, City, State 12345",
    profileImage: ""
  },
  customLinks: [
    { id: 1, title: "Book Your Appointment", url: "https://elegantbeauty.com/book", icon: "calendar", active: true, color: "#E03C91" },
    { id: 2, title: "Instagram", url: "https://instagram.com/elegantbeauty", icon: "instagram", active: true, color: "#E1306C" },
    { id: 3, title: "Facebook", url: "https://facebook.com/elegantbeauty", icon: "facebook", active: true, color: "#1877F2" },
    { id: 4, title: "Service Menu & Prices", url: "https://elegantbeauty.com/services", icon: "star", active: true, color: "#2F5D9F" },
    { id: 5, title: "Contact Us", url: "https://elegantbeauty.com/contact", icon: "phone", active: true, color: "#10B981" }
  ]
}

const defaultLandingPageConfig = {
  headline: "Transform Your Beauty - Special Limited Time Offer!",
  subheadline: "Professional beauty services with results you'll love",
  description: "Join thousands of satisfied clients who have transformed their look with our expert beauty treatments. Limited time offer - book now and save 30% on your first service!",
  buttonText: "Book My Transformation",
  backgroundColor: "#2F5D9F",
  textColor: "#FFFFFF",
  buttonColor: "#E03C91",
  features: [
    "Expert certified beauticians",
    "Premium products & techniques", 
    "30-day satisfaction guarantee",
    "Flexible scheduling options"
  ],
  businessInfo: {
    name: "Elegant Beauty Studio",
    phone: "(555) 123-4567",
    email: "hello@elegantbeauty.com",
    address: "123 Beauty Lane, City, State 12345"
  }
}

function GrowYourList() {
  const [selectedOption, setSelectedOption] = useState<'link-in-bio' | 'landing-page' | null>(null)
  const [linkInBioSetup, setLinkInBioSetup] = useState(false)
  const [landingPageSetup, setLandingPageSetup] = useState(false)
  const [showLandingPageEditor, setShowLandingPageEditor] = useState(false)
  const [landingPageUrl, setLandingPageUrl] = useState('')
  const [savedLandingPageConfig, setSavedLandingPageConfig] = useState(null)
  const [previewMode, setPreviewMode] = useState("mobile")
  const [linkInBioConfig, setLinkInBioConfig] = useState(defaultLinkInBioConfig)
  const [landingPageConfig, setLandingPageConfig] = useState(defaultLandingPageConfig)
  const [activeTab, setActiveTab] = useState("content")
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [leadCount, setLeadCount] = useState(0)
  const [isEditing, setIsEditing] = useState(true)
  const [showAnalytics, setShowAnalytics] = useState(true)

  // Mock analytics data
  const [analyticsData] = useState({
    thisMonth: {
      totalClicks: 2847,
      totalLeads: 186,
      conversionRate: 6.5,
      topSources: [
        { source: 'Instagram', clicks: 1523, percentage: 53.5 },
        { source: 'TikTok', clicks: 897, percentage: 31.5 },
        { source: 'Facebook', clicks: 285, percentage: 10.0 },
        { source: 'Direct', clicks: 142, percentage: 5.0 }
      ],
      dailyStats: [
        { date: '2024-12-01', clicks: 127, leads: 8 },
        { date: '2024-12-02', clicks: 89, leads: 6 },
        { date: '2024-12-03', clicks: 156, leads: 12 },
        { date: '2024-12-04', clicks: 98, leads: 5 },
        { date: '2024-12-05', clicks: 134, leads: 9 },
        { date: '2024-12-06', clicks: 167, leads: 11 },
        { date: '2024-12-07', clicks: 145, leads: 7 },
        { date: '2024-12-08', clicks: 189, leads: 14 },
        { date: '2024-12-09', clicks: 112, leads: 8 },
        { date: '2024-12-10', clicks: 178, leads: 13 },
        { date: '2024-12-11', clicks: 123, leads: 6 },
        { date: '2024-12-12', clicks: 198, leads: 15 },
        { date: '2024-12-13', clicks: 156, leads: 9 },
        { date: '2024-12-14', clicks: 167, leads: 12 },
        { date: '2024-12-15', calls: 89, leads: 7 },
        { date: '2024-12-16', clicks: 134, leads: 8 },
        { date: '2024-12-17', clicks: 145, leads: 10 },
        { date: '2024-12-18', clicks: 178, leads: 11 },
        { date: '2024-12-19', clicks: 189, leads: 13 },
        { date: '2024-12-20', clicks: 167, leads: 9 },
        { date: '2024-12-21', clicks: 156, leads: 8 },
        { date: '2024-12-22', clicks: 198, leads: 14 },
        { date: '2024-12-23', clicks: 145, leads: 7 },
        { date: '2024-12-24', clicks: 89, leads: 4 },
        { date: '2024-12-25', clicks: 67, leads: 3 },
        { date: '2024-12-26', clicks: 98, leads: 5 }
      ],
      deviceBreakdown: [
        { device: 'Mobile', count: 2139, percentage: 75.1 },
        { device: 'Desktop', count: 482, percentage: 16.9 },
        { device: 'Tablet', count: 226, percentage: 8.0 }
      ],
      timeOfDay: [
        { hour: '6-9 AM', clicks: 145, leads: 8 },
        { hour: '9-12 PM', clicks: 398, leads: 26 },
        { hour: '12-3 PM', clicks: 567, leads: 38 },
        { hour: '3-6 PM', clicks: 789, leads: 52 },
        { hour: '6-9 PM', clicks: 654, leads: 43 },
        { hour: '9-12 AM', clicks: 294, leads: 19 }
      ],
      topPages: [
        { page: 'Link in Bio Main', clicks: 1847, conversions: 127 },
        { page: 'Book Appointment', clicks: 1342, conversions: 89 },
        { page: 'Service Menu', clicks: 892, conversions: 45 },
        { page: 'Instagram Profile', clicks: 567, conversions: 23 },
        { page: 'Contact Info', clicks: 234, conversions: 12 }
      ]
    },
    comparison: {
      clicksChange: 23.4,
      leadsChange: 18.7,
      conversionChange: -2.1
    }
  })

  // Load saved data on component mount
  useEffect(() => {
    const savedOption = localStorage.getItem(STORAGE_KEYS.SELECTED_OPTION) as 'link-in-bio' | 'landing-page' | null
    const savedLinkInBio = localStorage.getItem(STORAGE_KEYS.LINK_IN_BIO_SETUP) === 'true'
    const savedLandingPage = localStorage.getItem(STORAGE_KEYS.LANDING_PAGE_SETUP) === 'true'
    const savedLandingPageConfig = localStorage.getItem(STORAGE_KEYS.LANDING_PAGE_CONFIG)
    const savedLandingPageUrl = localStorage.getItem(STORAGE_KEYS.LANDING_PAGE_URL)
    
    setSelectedOption(savedOption)
    setLinkInBioSetup(savedLinkInBio)
    setLandingPageSetup(savedLandingPage)
    if (savedLandingPageConfig) {
      setSavedLandingPageConfig(JSON.parse(savedLandingPageConfig))
    }
    if (savedLandingPageUrl) {
      setLandingPageUrl(savedLandingPageUrl)
    }
  }, [])

  const handleOptionSelect = (option: 'link-in-bio' | 'landing-page') => {
    if (option === 'landing-page') {
      setShowLandingPageEditor(true)
    } else {
      setSelectedOption(option)
      localStorage.setItem(STORAGE_KEYS.SELECTED_OPTION, option)
    }
  }

  const handleSetupComplete = () => {
    if (selectedOption === 'link-in-bio') {
      setLinkInBioSetup(true)
      localStorage.setItem(STORAGE_KEYS.LINK_IN_BIO_SETUP, 'true')
      toast.success("Link in Bio page created successfully! 🎉")
    } else if (selectedOption === 'landing-page') {
      setLandingPageSetup(true)
      localStorage.setItem(STORAGE_KEYS.LANDING_PAGE_SETUP, 'true')
      toast.success("Landing page created successfully! 🎉")
    }
  }

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success("Link copied to clipboard!")
      }
    } catch (e) {
      // Silent fail
    }
  }

  const generateUrl = (type: 'link-in-bio' | 'landing-page') => {
    const config = type === 'link-in-bio' ? linkInBioConfig : landingPageConfig
    const businessSlug = config.businessInfo.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const prefix = type === 'link-in-bio' ? 'bio' : 'lp'
    return `https://${prefix}.bvx.app/${businessSlug}`
  }

  const handleFormSubmit = (formData: any) => {
    setLeadCount(prev => prev + 1)
    toast.success("New lead captured! Check your Messages to follow up.")
  }

  const addCustomLink = () => {
    if (selectedOption !== 'link-in-bio') return
    const newId = Math.max(...linkInBioConfig.customLinks.map(l => l.id)) + 1
    setLinkInBioConfig(prev => ({
      ...prev,
      customLinks: [
        ...prev.customLinks,
        { id: newId, title: "New Link", url: "", icon: "link", active: true, color: "#E03C91" }
      ]
    }))
  }

  const updateCustomLink = (id: number, field: string, value: any) => {
    if (selectedOption !== 'link-in-bio') return
    setLinkInBioConfig(prev => ({
      ...prev,
      customLinks: prev.customLinks.map(link =>
        link.id === id ? { ...link, [field]: value } : link
      )
    }))
  }

  const deleteCustomLink = (id: number) => {
    if (selectedOption !== 'link-in-bio') return
    setLinkInBioConfig(prev => ({
      ...prev,
      customLinks: prev.customLinks.filter(link => link.id !== id)
    }))
  }

  const reorderCustomLinks = (startIndex: number, endIndex: number) => {
    if (selectedOption !== 'link-in-bio') return
    setLinkInBioConfig(prev => {
      const result = Array.from(prev.customLinks)
      const [removed] = result.splice(startIndex, 1)
      result.splice(endIndex, 0, removed)
      return { ...prev, customLinks: result }
    })
  }

  const duplicateCustomLink = (id: number) => {
    if (selectedOption !== 'link-in-bio') return
    const linkToDuplicate = linkInBioConfig.customLinks.find(link => link.id === id)
    if (linkToDuplicate) {
      const newId = Math.max(...linkInBioConfig.customLinks.map(l => l.id)) + 1
      setLinkInBioConfig(prev => ({
        ...prev,
        customLinks: [
          ...prev.customLinks,
          { ...linkToDuplicate, id: newId, title: `${linkToDuplicate.title} Copy` }
        ]
      }))
    }
  }

  const updateBusinessInfo = (field: string, value: string) => {
    const currentConfig = selectedOption === 'link-in-bio' ? linkInBioConfig : landingPageConfig
    const newConfig = {
      ...currentConfig,
      businessInfo: {
        ...currentConfig.businessInfo,
        [field]: value
      }
    }
    
    if (selectedOption === 'link-in-bio') {
      setLinkInBioConfig(newConfig)
    } else {
      setLandingPageConfig(newConfig)
    }
  }

  const handleLandingPageSave = (config: any, url: string) => {
    setLandingPageSetup(true)
    setSavedLandingPageConfig(config)
    setLandingPageUrl(url)
    setShowLandingPageEditor(false)
    
    localStorage.setItem(STORAGE_KEYS.LANDING_PAGE_SETUP, 'true')
    localStorage.setItem(STORAGE_KEYS.LANDING_PAGE_CONFIG, JSON.stringify(config))
    localStorage.setItem(STORAGE_KEYS.LANDING_PAGE_URL, url)
    
    toast.success("Landing page saved successfully! 🎉")
  }

  const handleBackFromLandingPage = () => {
    setShowLandingPageEditor(false)
  }

  const handleEditLandingPage = () => {
    setShowLandingPageEditor(true)
  }

  const getIconComponent = (iconName: string) => {
    const icons: { [key: string]: any } = {
      calendar: Calendar,
      instagram: Instagram,
      facebook: Facebook,
      twitter: Twitter,
      youtube: Youtube,
      star: Star,
      heart: Heart,
      phone: Phone,
      globe: Globe,
      user: User,
      link: Link,
      mail: Mail,
      shop: ShoppingBag,
      location: MapPin,
      play: Play,
      camera: Camera,
      music: Music,
      scissors: Scissors,
      sparkles: Sparkles,
      gift: Gift,
      clock: Clock,
      download: Download
    }
    return icons[iconName] || Link
  }

  // Landing Page Editor Screen
  if (showLandingPageEditor) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
        <EditableLandingPage
          onBack={handleBackFromLandingPage}
          onSave={handleLandingPageSave}
          isEditing={landingPageSetup}
          savedConfig={savedLandingPageConfig}
        />
      </Suspense>
    )
  }

  // Analytics View
  if (showAnalytics) {
    return (
      <div className="space-y-6">
        {/* Analytics Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnalytics(false)}
              >
                ← Back to Tools
              </Button>
              <h1 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                Fill Your Chair Analytics
              </h1>
            </div>
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Track your link-in-bio performance and lead generation results
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              <Activity className="h-3 w-3 mr-1" />
              Live Data
            </Badge>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-2xl font-bold text-black">{analyticsData.thisMonth.totalClicks.toLocaleString()}</p>
                  <div className="flex items-center mt-1">
                    <ChevronUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">+{analyticsData.comparison.clicksChange}%</span>
                    <span className="text-xs text-muted-foreground ml-1">vs last month</span>
                  </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MousePointerClick className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leads Generated</p>
                  <p className="text-2xl font-bold text-black">{analyticsData.thisMonth.totalLeads}</p>
                  <div className="flex items-center mt-1">
                    <ChevronUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">+{analyticsData.comparison.leadsChange}%</span>
                    <span className="text-xs text-muted-foreground ml-1">vs last month</span>
                  </div>
                </div>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <UserPlus className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold text-black">{analyticsData.thisMonth.conversionRate}%</p>
                  <div className="flex items-center mt-1">
                    <ChevronDown className="h-3 w-3 text-red-600" />
                    <span className="text-xs text-red-600 font-medium">{Math.abs(analyticsData.comparison.conversionChange)}%</span>
                    <span className="text-xs text-muted-foreground ml-1">vs last month</span>
                  </div>
                </div>
                <div className="p-2 bg-secondary/20 rounded-lg">
                  <Percent className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Est. Revenue</p>
                  <p className="text-2xl font-bold text-black">$14,880</p>
                  <div className="flex items-center mt-1">
                    <ChevronUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">+21.3%</span>
                    <span className="text-xs text-muted-foreground ml-1">vs last month</span>
                  </div>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Daily Performance</CardTitle>
              <p className="text-sm text-muted-foreground">Clicks and leads over the past 30 days</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.thisMonth.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).getDate().toString()}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#E03C91" 
                    strokeWidth={2}
                    dot={{ fill: '#E03C91', strokeWidth: 2, r: 4 }}
                    name="Clicks"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#2F5D9F" 
                    strokeWidth={2}
                    dot={{ fill: '#2F5D9F', strokeWidth: 2, r: 4 }}
                    name="Leads"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Traffic Sources</CardTitle>
              <p className="text-sm text-muted-foreground">Where your visitors are coming from</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.thisMonth.topSources.map((source, index) => (
                  <div key={source.source} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-primary' : 
                        index === 1 ? 'bg-accent' : 
                        index === 2 ? 'bg-secondary' : 'bg-gray-400'
                      }`} />
                      <span className="font-medium">{source.source}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{source.clicks.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{source.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analyticsData.thisMonth.topSources}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="clicks"
                    >
                      {analyticsData.thisMonth.topSources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          index === 0 ? '#E03C91' : 
                          index === 1 ? '#2F5D9F' : 
                          index === 2 ? '#F7B8D1' : '#6b7280'
                        } />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Device Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.thisMonth.deviceBreakdown.map((device) => (
                  <div key={device.device} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {device.device === 'Mobile' && <SmartphoneIcon className="h-4 w-4 text-primary" />}
                        {device.device === 'Desktop' && <Laptop className="h-4 w-4 text-accent" />}
                        {device.device === 'Tablet' && <Tablet className="h-4 w-4 text-secondary" />}
                        <span className="text-sm font-medium">{device.device}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{device.percentage}%</span>
                    </div>
                    <Progress value={device.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Peak Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsData.thisMonth.timeOfDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#E03C91" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Performing Pages */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Top Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.thisMonth.topPages.slice(0, 5).map((page, index) => (
                  <div key={page.page} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{page.page}</p>
                      <p className="text-xs text-muted-foreground">{page.conversions} conversions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{page.clicks}</p>
                      <p className="text-xs text-muted-foreground">clicks</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Recent Lead Activity</CardTitle>
            <p className="text-sm text-muted-foreground">Latest leads captured from your link-in-bio</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Sarah M.', email: 'sarah.m@email.com', source: 'Instagram', time: '2 minutes ago', service: 'Balayage Consultation' },
                { name: 'Jessica L.', email: 'jessica.l@email.com', source: 'TikTok', time: '15 minutes ago', service: 'Facial Treatment' },
                { name: 'Maria R.', email: 'maria.r@email.com', source: 'Instagram', time: '1 hour ago', service: 'Hair Cut & Style' },
                { name: 'Ashley K.', email: 'ashley.k@email.com', source: 'Facebook', time: '2 hours ago', service: 'Manicure & Pedicure' },
                { name: 'Emma T.', email: 'emma.t@email.com', source: 'Direct', time: '3 hours ago', service: 'Color Consultation' }
              ].map((lead, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{lead.service}</p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {lead.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{lead.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Option Selection Screen
  if (!selectedOption) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Fill Your Chair
            </h1>
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Choose your lead generation strategy and start capturing more clients
            </p>
          </div>
          {(linkInBioSetup || landingPageSetup) && (
            <Button
              onClick={() => setShowAnalytics(true)}
              className="bg-accent hover:bg-accent/90 text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
          {/* Link in Bio Option */}
          <Card className="relative hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Link2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
                  Link in Bio Page
                </CardTitle>
                {linkInBioSetup && (
                  <div className="ml-auto">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Perfect for capturing leads from your social media visitors
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Instagram className="h-4 w-4 text-primary" />
                  <span>Instagram bio link optimization</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Lead capture from social followers</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Share2 className="h-4 w-4 text-primary" />
                  <span>Multiple custom links & buttons</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>Mobile-first design</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  <strong>Best for:</strong> Beauty professionals who want to convert their social media followers into paying clients
                </p>
                <Button 
                  onClick={() => handleOptionSelect('link-in-bio')}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  size="lg"
                >
                  {linkInBioSetup ? (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Link in Bio
                    </>
                  ) : (
                    <>
                      Create Link in Bio
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Landing Page Option */}
          <Card className="relative hover:shadow-lg transition-all duration-300 border-2 hover:border-accent/30">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
                  Landing Page for Ads
                </CardTitle>
                {landingPageSetup && (
                  <div className="ml-auto">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                High-converting pages designed for paid advertising campaigns
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Target className="h-4 w-4 text-accent" />
                  <span>Facebook & Instagram ads optimization</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <span>Higher conversion rates</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  <span>Lead capture forms</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Eye className="h-4 w-4 text-accent" />
                  <span>A/B testing ready</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  <strong>Best for:</strong> Beauty professionals running paid ads on Facebook, Instagram, or Google to attract new clients
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => handleOptionSelect('landing-page')}
                    className="w-full bg-accent hover:bg-accent/90 text-white"
                    size="lg"
                  >
                    {landingPageSetup ? (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Landing Page
                      </>
                    ) : (
                      <>
                        Create Landing Page
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                  
                  {landingPageSetup && landingPageUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <ExternalLink className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Landing Page Live</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyText(landingPageUrl)}
                          className="text-green-700 border-green-300 hover:bg-green-100"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Link
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        Share this link in your ads, social media, or anywhere you want to capture leads
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Indicators */}
        {(linkInBioSetup || landingPageSetup) && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-bold text-green-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Great Progress! 🎉
                  </h3>
                  <p className="text-sm text-green-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    You've set up {linkInBioSetup && landingPageSetup ? 'both' : linkInBioSetup ? 'your Link in Bio page' : 'your Landing Page'}. 
                    {leadCount > 0 && ` ${leadCount} leads captured so far!`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Rest of the component for editing selected option...
  const currentConfig = selectedOption === 'link-in-bio' ? linkInBioConfig : landingPageConfig
  const setCurrentConfig = selectedOption === 'link-in-bio' ? setLinkInBioConfig : setLandingPageConfig

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOption(null)}
            >
              ← Back to Options
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              {selectedOption === 'link-in-bio' ? 'Link in Bio Builder' : 'Landing Page Builder'}
            </h1>
          </div>
          <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            {selectedOption === 'link-in-bio' 
              ? 'Create a beautiful link in bio page for your social media with lead capture'
              : 'Create a high-converting landing page for your advertising campaigns'
            }
          </p>
        </div>
        <Button
          onClick={handleSetupComplete}
          className="bg-primary hover:bg-primary/90 text-white"
          size="lg"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {selectedOption === 'link-in-bio' && linkInBioSetup ? 'Update' : selectedOption === 'landing-page' && landingPageSetup ? 'Update' : 'Complete Setup'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
                <span>Content Editor</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-1 mb-4 border-b">
                <Button
                  size="sm"
                  variant={activeTab === "content" ? "default" : "ghost"}
                  onClick={() => setActiveTab("content")}
                >
                  Content
                </Button>
                {selectedOption === 'link-in-bio' && (
                  <Button
                    size="sm"
                    variant={activeTab === "links" ? "default" : "ghost"}
                    onClick={() => setActiveTab("links")}
                  >
                    Custom Links
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={activeTab === "business" ? "default" : "ghost"}
                  onClick={() => setActiveTab("business")}
                >
                  Business Info
                </Button>
              </div>

              {activeTab === "content" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Headline</label>
                    <Input
                      value={currentConfig.headline}
                      onChange={(e) => setCurrentConfig(prev => ({ ...prev, headline: e.target.value }))}
                      placeholder="Enter compelling headline..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Subheadline</label>
                    <Input
                      value={currentConfig.subheadline}
                      onChange={(e) => setCurrentConfig(prev => ({ ...prev, subheadline: e.target.value }))}
                      placeholder="Supporting text..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      value={currentConfig.description}
                      onChange={(e) => setCurrentConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed description..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Button Text</label>
                    <Input
                      value={currentConfig.buttonText}
                      onChange={(e) => setCurrentConfig(prev => ({ ...prev, buttonText: e.target.value }))}
                      placeholder="Call to action..."
                    />
                  </div>
                </div>
              )}

              {activeTab === "links" && selectedOption === 'link-in-bio' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium" style={{ fontFamily: 'Playfair Display, serif' }}>Custom Links</h4>
                    <Button size="sm" onClick={addCustomLink}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Link
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Create custom buttons for your link in bio page. Drag to reorder.
                  </p>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {linkInBioConfig.customLinks.map((link, index) => {
                      const IconComponent = getIconComponent(link.icon)
                      return (
                        <div key={link.id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: link.color }}
                              >
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <Input
                                  value={link.title}
                                  onChange={(e) => updateCustomLink(link.id, 'title', e.target.value)}
                                  placeholder="Button title"
                                  className="font-medium"
                                />
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateCustomLink(link.id, 'active', !link.active)}
                                title={link.active ? "Hide button" : "Show button"}
                              >
                                <Eye className={`h-3 w-3 ${link.active ? 'text-green-600' : 'text-gray-400'}`} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => duplicateCustomLink(link.id)}
                                title="Duplicate button"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteCustomLink(link.id)}
                                title="Delete button"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          
                          <Input
                            value={link.url}
                            onChange={(e) => updateCustomLink(link.id, 'url', e.target.value)}
                            placeholder="https://..."
                          />
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium mb-1 block">Icon</label>
                              <Select value={link.icon} onValueChange={(value) => updateCustomLink(link.id, 'icon', value)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="calendar">📅 Calendar</SelectItem>
                                  <SelectItem value="instagram">📷 Instagram</SelectItem>
                                  <SelectItem value="facebook">👥 Facebook</SelectItem>
                                  <SelectItem value="twitter">🐦 Twitter</SelectItem>
                                  <SelectItem value="youtube">🎥 YouTube</SelectItem>
                                  <SelectItem value="star">⭐ Services</SelectItem>
                                  <SelectItem value="heart">❤️ Heart</SelectItem>
                                  <SelectItem value="phone">📞 Phone</SelectItem>
                                  <SelectItem value="mail">✉️ Email</SelectItem>
                                  <SelectItem value="globe">🌐 Website</SelectItem>
                                  <SelectItem value="shop">🛍️ Shop</SelectItem>
                                  <SelectItem value="location">📍 Location</SelectItem>
                                  <SelectItem value="music">🎵 Music</SelectItem>
                                  <SelectItem value="camera">📸 Portfolio</SelectItem>
                                  <SelectItem value="scissors">✂️ Beauty</SelectItem>
                                  <SelectItem value="sparkles">✨ Special</SelectItem>
                                  <SelectItem value="gift">🎁 Offers</SelectItem>
                                  <SelectItem value="download">⬇️ Download</SelectItem>
                                  <SelectItem value="user">👤 Profile</SelectItem>
                                  <SelectItem value="link">🔗 Link</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs font-medium mb-1 block">Color</label>
                              <div className="flex space-x-1">
                                <input
                                  type="color"
                                  value={link.color}
                                  onChange={(e) => updateCustomLink(link.id, 'color', e.target.value)}
                                  className="w-8 h-8 rounded border cursor-pointer"
                                />
                                <Select value={link.color} onValueChange={(value) => updateCustomLink(link.id, 'color', value)}>
                                  <SelectTrigger className="h-8 flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="#E03C91">💗 Pink</SelectItem>
                                    <SelectItem value="#2F5D9F">💙 Blue</SelectItem>
                                    <SelectItem value="#10B981">💚 Green</SelectItem>
                                    <SelectItem value="#F59E0B">🧡 Orange</SelectItem>
                                    <SelectItem value="#8B5CF6">💜 Purple</SelectItem>
                                    <SelectItem value="#EF4444">❤️ Red</SelectItem>
                                    <SelectItem value="#000000">🖤 Black</SelectItem>
                                    <SelectItem value="#6B7280">🩶 Gray</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {linkInBioConfig.customLinks.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <Link2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        No custom links yet. Add your first link to get started!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "business" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Name</label>
                    <Input
                      value={currentConfig.businessInfo.name}
                      onChange={(e) => updateBusinessInfo("name", e.target.value)}
                      placeholder="Your business name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <Input
                      value={currentConfig.businessInfo.phone}
                      onChange={(e) => updateBusinessInfo("phone", e.target.value)}
                      placeholder="Business phone number"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input
                      value={currentConfig.businessInfo.email}
                      onChange={(e) => updateBusinessInfo("email", e.target.value)}
                      placeholder="Contact email"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Address</label>
                    <Input
                      value={currentConfig.businessInfo.address}
                      onChange={(e) => updateBusinessInfo("address", e.target.value)}
                      placeholder="Business address"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
                <div className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <span>Preview</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`border-2 border-dashed border-gray-300 rounded-lg p-4 ${previewMode === "mobile" ? "max-w-sm mx-auto" : "max-w-lg mx-auto"}`}>
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Header */}
                  <div 
                    className="p-6 text-center text-white relative"
                    style={{ 
                      background: `linear-gradient(135deg, ${currentConfig.backgroundColor} 0%, ${currentConfig.buttonColor} 100%)`
                    }}
                  >
                    <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <User className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {currentConfig.businessInfo.name}
                    </h1>
                    <p className="text-sm opacity-90" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {currentConfig.businessInfo.address.split(',')[0]}
                    </p>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6 text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {currentConfig.headline}
                    </h2>
                    <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {currentConfig.subheadline}
                    </p>
                    <p className="text-sm text-gray-700 mb-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {currentConfig.description}
                    </p>
                    
                    {/* Lead Form */}
                    <div className="space-y-3 mb-6">
                      <Input placeholder="Your Name" className="text-sm" />
                      <Input placeholder="Email Address" className="text-sm" />
                      <Input placeholder="Phone Number" className="text-sm" />
                    </div>
                    
                    <Button 
                      className="w-full text-white font-medium"
                      style={{ backgroundColor: currentConfig.buttonColor }}
                      onClick={() => handleFormSubmit({ type: selectedOption })}
                    >
                      {currentConfig.buttonText}
                    </Button>
                  </div>
                  
                  {/* Custom Links - Only for Link in Bio */}
                  {selectedOption === 'link-in-bio' && linkInBioConfig.customLinks.filter(link => link.active).length > 0 && (
                    <div className="px-6 pb-4">
                      <div className="space-y-3">
                        {linkInBioConfig.customLinks.filter(link => link.active).map((link) => {
                          const IconComponent = getIconComponent(link.icon)
                          return (
                            <button
                              key={link.id}
                              className="w-full p-3 rounded-lg flex items-center space-x-3 transition-all hover:scale-105 text-white font-medium"
                              style={{ backgroundColor: link.color }}
                              onClick={() => window.open(link.url, '_blank')}
                            >
                              <IconComponent className="h-5 w-5" />
                              <span className="text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                {link.title}
                              </span>
                              <ExternalLink className="h-4 w-4 ml-auto opacity-70" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* BrandVX Attribution */}
                  <div className="px-6 pb-6">
                    <div className="text-center p-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
                      <p className="text-xs text-gray-600 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Powered by
                      </p>
                      <div className="flex items-center justify-center space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                          BrandVX
                        </span>
                        <div className="w-2 h-2 bg-accent rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {leadCount > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{leadCount} leads captured today!</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Implementation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                <Globe className="h-5 w-5 text-primary" />
                <span>Your {selectedOption === 'link-in-bio' ? 'Link in Bio' : 'Landing Page'} URL</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex space-x-2">
                  <Input value={generateUrl(selectedOption)} readOnly className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(generateUrl(selectedOption))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedOption === 'link-in-bio' 
                    ? 'Use this link in your Instagram bio, TikTok profile, or any social media platform'
                    : 'Use this URL for your Facebook ads, Instagram ads, and Google campaigns'
                  }
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  className="flex-1 bg-primary text-white hover:bg-primary/90"
                  onClick={() => window.open(generateUrl(selectedOption), '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview Live
                </Button>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default GrowYourList