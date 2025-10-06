// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useOnboarding } from './onboarding-context'
import { api, getTenant } from '../../lib/api'
import founderImage from '../../assets/onboarding/IMG_7577.jpeg'
import { 
  X, 
  ArrowRight,
  ArrowLeft,
  Lightbulb, 
  Sparkles,
  ChevronRight,
  BookOpen,
  Crown,
  Check,
  Zap
} from 'lucide-react'

interface OnboardingStep {
  title: string
  description: string
  tips?: string[]
  actionText?: string
}

interface OnboardingTooltipProps {
  pageId: string
  title: string
  description: string
  steps?: OnboardingStep[]
  tips?: string[]
  position?: 'top' | 'bottom' | 'center'
  delay?: number
}

const PAGE_ONBOARDING_CONTENT = {
  dashboard: {
    title: "Welcome to Your BVX Dashboard!",
    description: "This is your command center for managing your beauty business. Here's what you can do:",
    tips: [
      "Check your daily stats and revenue at a glance",
      "View upcoming appointments and tasks",
      "Access quick actions for common tasks",
      "Monitor client activity and recent bookings"
    ]
  },
  askvx: {
    title: "Meet AskVX - Your AI Beauty Assistant",
    description: "Get instant answers to beauty questions, product recommendations, and business advice:",
    tips: [
      "Ask about specific skincare concerns or treatments",
      "Get product recommendations for your clients",
      "Learn about new beauty trends and techniques",
      "Ask for business advice and marketing tips"
    ]
  },
  brandvzn: {
    title: "BrandVZN - AI Beauty Consultations",
    description: "Create stunning before/after consultations using AI to show clients their potential:",
    tips: [
      "Upload a client's photo to start a consultation",
      "Describe the desired transformation or treatment",
      "AI will generate a realistic after image",
      "Save and share results with your clients"
    ]
  },
  messages: {
    title: "Client Communication Hub",
    description: "Manage all your client conversations in one place with professional messaging tools:",
    tips: [
      "Send SMS messages directly to clients (with Twilio integration)",
      "Organize conversations by client with tags",
      "Use templates for common messages",
      "Track message status and replies"
    ]
  },
  clients: {
    title: "Complete Client Management",
    description: "Your comprehensive client database with detailed profiles and history:",
    tips: [
      "View all client information and booking history",
      "Track client preferences and skin concerns",
      "Monitor client value and loyalty status",
      "Add notes and custom tags for organization"
    ]
  },
  agenda: {
    title: "Your Beautiful Planner",
    description: "Stay organized with your aesthetic agenda that keeps you on track:",
    tips: [
      "View appointments and tasks in a clean calendar view",
      "Add up to 3 daily tasks to stay focused",
      "Celebrate completed goals with dynamic animations",
      "Sync with your booking system for seamless planning"
    ]
  },
  "follow-ups": {
    title: "Client Follow-Up System",
    description: "Never miss an opportunity to connect with your clients and grow your business:",
    tips: [
      "Track clients who need follow-up contact",
      "Send automated reminder messages",
      "Monitor post-treatment check-ins",
      "Build stronger client relationships"
    ]
  },
  "grow-your-list": {
    title: "Fill Your Chair - Lead Generation",
    description: "Create stunning landing pages and link-in-bio tools to attract new clients:",
    tips: [
      "Build professional landing pages with our drag-and-drop editor",
      "Create an optimized link-in-bio for social media",
      "Track clicks, conversions, and lead sources",
      "Integrate with booking systems for seamless conversions"
    ]
  },
  "grow-with-vx": {
    title: "Advanced Growth Strategies",
    description: "Scale your beauty business with AI-powered marketing automation:",
    tips: [
      "Automated email marketing campaigns",
      "Social media content planning and scheduling",
      "Client lifecycle automation and retention",
      "Advanced analytics and growth insights"
    ]
  },
  inventory: {
    title: "Smart Inventory Management",
    description: "Keep track of your beauty products and supplies effortlessly:",
    tips: [
      "Monitor stock levels and get low-stock alerts",
      "Track product usage and costs",
      "Generate automatic reorder suggestions",
      "Integrate with your POS system for real-time updates"
    ]
  },
  tutorials: {
    title: "Beauty Business Academy",
    description: "Learn new techniques and grow your skills with expert tutorials:",
    tips: [
      "Access video tutorials on latest beauty trends",
      "Learn business growth strategies",
      "Get certification courses for continuing education",
      "Connect with other beauty professionals"
    ]
  },
  settings: {
    title: "Customize Your Experience",
    description: "Personalize your BVX dashboard and manage your business preferences:",
    tips: [
      "Update your profile and business information",
      "Connect integrations like Twilio, Square, and Acuity",
      "Set your business goals and track progress",
      "Manage your subscription and billing"
    ]
  }
}

const PRICING_TIERS = [
  {
    name: 'Essentials',
    price: '$47',
    period: '/month',
    description: 'Perfect for solo operators getting started',
    billingNote: 'Billed monthly, pay today',
    features: [
      'Essential scheduling & client management',
      'Basic analytics and insights',
      'AskVX AI beauty consultant',
      'BrandVZN style recommendations',
      'Up to 50 clients'
    ],
    buyButtonId: 'VITE_STRIPE_BUY_BUTTON_47',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$97',
    period: '/month',
    badge: 'Founding Member',
    description: 'For professionals ready to scale their business',
    billingNote: 'Billed monthly, pay today',
    features: [
      'Everything in Essentials',
      'Unlimited clients',
      'Advanced marketing automation',
      'Premium analytics & insights',
      'Inventory management',
      'Priority support'
    ],
    buyButtonId: 'VITE_STRIPE_BUY_BUTTON_97',
    highlighted: true,
  },
  {
    name: 'Premium',
    price: '$147',
    period: '/month',
    badge: 'Most Popular',
    description: 'Complete growth suite for ambitious beauty pros',
    billingNote: '7-day free trial, then billed monthly',
    features: [
      'Everything in Pro',
      'Fill Your Chair - Lead generation tools',
      'Grow with VX - Advanced automation',
      'Custom branding options',
      'Dedicated account manager',
      'Early access to new features'
    ],
    buyButtonId: 'VITE_STRIPE_BUY_BUTTON_147',
    highlighted: false,
  },
]

const FOUNDER_SLIDES = [
  {
    title: 'A brief note from Dakota',
    content: (
      <p className="text-muted-foreground">
        Hi! My name is Dakota LaTommy and I created this platform for beauty professionals like <strong>you</strong>. 
        In a world that underestimates your ability, hustle, and drive, I wanted to design something that lets you know I see you.
      </p>
    ),
  },
  {
    title: 'Our tribe',
    content: (
      <div>
        <p className="text-muted-foreground mb-3">
          From my girlfriend Rachel to my business partner Jaydn, I have deep connections with the beauty industry. 
          You are hustlers, business-savvy <strong>artists</strong>, but the mounting pressure to survive has stripped 
          the joy from a craft you once loved.
        </p>
        <div className="flex justify-center">
          <img 
            src={founderImage} 
            alt="Dakota and Rachel" 
            className="w-32 h-32 rounded-2xl object-cover shadow-lg"
          />
        </div>
      </div>
    ),
  },
  {
    title: 'Why brandVX exists',
    content: (
      <p className="text-muted-foreground">
        brandVX is designed to help you optimize your business, save time, and generate more revenue. It grows with you — 
        as a CEO, brand, salesperson, content-creator, and <strong>person</strong> — by accelerating every aspect of your passion. 
        We are in open beta with 1,000 users and will keep shipping new features weekly. If you need anything, email{' '}
        <strong>support@aubecreativelabs.com</strong>.
      </p>
    ),
  },
  {
    title: "Let's stay in touch",
    content: null, // Form will be rendered separately
    isForm: true,
  },
  {
    title: 'Choose Your Growth Path',
    content: null, // Pricing will be rendered separately
    isPricing: true,
  },
]

export function OnboardingTooltip({ 
  pageId, 
  position = 'center',
  delay = 1000 
}: Omit<OnboardingTooltipProps, 'title' | 'description'> & { pageId: keyof typeof PAGE_ONBOARDING_CONTENT }) {
  const { hasSeenOnboarding, markOnboardingComplete, isOnboardingEnabled } = useOnboarding()
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [showFounderSlides, setShowFounderSlides] = useState(false)
  const [founderSlideIndex, setFounderSlideIndex] = useState(0)
  const [founderFormData, setFounderFormData] = useState({ email: '', phone: '' })
  const [founderFormErrors, setFounderFormErrors] = useState({ email: '', phone: '' })
  const [isSubmittingFounderForm, setIsSubmittingFounderForm] = useState(false)

  const content = PAGE_ONBOARDING_CONTENT[pageId]

  // Check if founder slides have been seen
  const hasSeenFounderSlides = () => {
    try {
      return localStorage.getItem('bvx_founder_slides_seen') === '1'
    } catch {
      return false
    }
  }

  // Validate founder form
  const validateFounderForm = () => {
    const errors = { email: '', phone: '' }
    let isValid = true

    const email = founderFormData.email?.trim() || ''
    const phone = founderFormData.phone?.trim() || ''

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address'
      isValid = false
    }

    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '')
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        errors.phone = 'Please enter a valid phone number (7-15 digits)'
        isValid = false
      }
    }

    setFounderFormErrors(errors)
    return isValid
  }

  // Submit founder contact form
  const submitFounderContact = async () => {
    setIsSubmittingFounderForm(true)
    try {
      const tenantId = await getTenant()
      const email = (founderFormData.email?.trim() || '').toLowerCase()
      const phoneNormalized = (founderFormData.phone?.trim() || '').replace(/[^0-9+]/g, '')
      
      if (!email && !phoneNormalized) {
        return // Both optional, so skip if both empty
      }

      await api.post('/onboarding/founder/contact', {
        tenant_id: tenantId,
        email: email || undefined,
        phone: phoneNormalized || undefined,
        finalize: true,
      })
    } catch (err) {
      console.error('Founder contact submission failed', err)
    } finally {
      setIsSubmittingFounderForm(false)
    }
  }

  useEffect(() => {
    if (!isOnboardingEnabled || hasSeenOnboarding(pageId)) {
      return
    }

    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [pageId, hasSeenOnboarding, isOnboardingEnabled, delay])

  const handleClose = () => {
    setIsVisible(false)
    markOnboardingComplete(pageId)
  }

  const handleSkip = () => {
    setIsVisible(false)
    markOnboardingComplete(pageId)
  }

  const handleGotIt = () => {
    // If on dashboard and haven't seen founder slides, show them next
    if (pageId === 'dashboard' && !hasSeenFounderSlides()) {
      setIsVisible(false)  // Hide welcome popup first
      setShowFounderSlides(true)
      setFounderSlideIndex(0)
      return
    }
    
    setIsVisible(false)
    markOnboardingComplete(pageId)
  }

  const handleFounderNext = async () => {
    const currentSlide = FOUNDER_SLIDES[founderSlideIndex]
    
    // If on form slide, validate before proceeding
    if (currentSlide.isForm) {
      if (!validateFounderForm()) {
        return
      }
      await submitFounderContact()
      
      // Move to next slide (pricing)
      if (founderSlideIndex < FOUNDER_SLIDES.length - 1) {
        setFounderSlideIndex(founderSlideIndex + 1)
      }
      return
    }

    // If on pricing slide or last slide, finish
    if (currentSlide.isPricing || founderSlideIndex >= FOUNDER_SLIDES.length - 1) {
      try {
        localStorage.setItem('bvx_founder_slides_seen', '1')
      } catch {}
      setIsVisible(false)
      setShowFounderSlides(false)
      markOnboardingComplete(pageId)
      return
    }

    // Move to next slide
    if (founderSlideIndex < FOUNDER_SLIDES.length - 1) {
      setFounderSlideIndex(founderSlideIndex + 1)
    }
  }

  const handlePricingSelection = (buyButtonId: string) => {
    const buyButtonKey = import.meta.env[buyButtonId]
    if (!buyButtonKey) {
      console.error('Buy button not configured:', buyButtonId)
      return
    }
    
    const stripeUrl = `https://buy.stripe.com/${buyButtonKey}`
    window.open(stripeUrl, '_blank')
    
    // Mark onboarding as complete after selection
    try {
      localStorage.setItem('bvx_founder_slides_seen', '1')
    } catch {}
    setIsVisible(false)
    setShowFounderSlides(false)
    markOnboardingComplete(pageId)
  }

  const handleFounderBack = () => {
    if (founderSlideIndex > 0) {
      setFounderSlideIndex(founderSlideIndex - 1)
    } else {
      // Go back to main welcome
      setShowFounderSlides(false)
    }
  }

  if (!showFounderSlides && (!isVisible || !content)) return null

  const positionClasses = {
    top: 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50',
    bottom: 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
    center: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
  }

  // Render founder slides if active
  if (showFounderSlides) {
    const currentSlide = FOUNDER_SLIDES[founderSlideIndex]
    const isLastSlide = founderSlideIndex === FOUNDER_SLIDES.length - 1

    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" />
        
        {/* Founder Slide Tooltip */}
        <div className={positionClasses[position]}>
          <Card className={`${currentSlide.isPricing ? 'w-[480px]' : 'w-96'} max-w-[90vw] shadow-2xl border-primary/20 bg-white`}>
            <CardHeader className="relative pb-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {founderSlideIndex + 1} of {FOUNDER_SLIDES.length}
                </Badge>
              </div>
              
              <CardTitle className="text-xl pr-8" style={{ fontFamily: 'Playfair Display, serif' }}>
                {currentSlide.title}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {currentSlide.isPricing ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm text-center" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Select the plan that fits your business goals. You can upgrade or downgrade anytime.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-2">
                    {PRICING_TIERS.map((tier) => (
                      <div
                        key={tier.name}
                        className={`relative rounded-xl border-2 p-4 transition-all hover:shadow-lg cursor-pointer ${
                          tier.highlighted 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => handlePricingSelection(tier.buyButtonId)}
                      >
                        {tier.badge && (
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-primary text-white text-xs px-3 py-0.5">
                              {tier.badge}
                            </Badge>
                          </div>
                        )}
                        
                        <div className="text-center mb-3">
                          <h4 className="text-lg font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                            {tier.name}
                          </h4>
                          <div className="flex items-baseline justify-center mt-1">
                            <span className="text-3xl font-bold text-primary">{tier.price}</span>
                            <span className="text-sm text-muted-foreground ml-1">{tier.period}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>
                          <p className="text-xs font-medium text-primary mt-1">{tier.billingNote}</p>
                        </div>
                        
                        <ul className="space-y-1.5 mb-3">
                          {tier.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start text-xs">
                              <Check className="h-3.5 w-3.5 text-primary mt-0.5 mr-2 flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        
                        <Button 
                          className={`w-full ${tier.highlighted ? 'bg-primary hover:bg-primary/90' : ''}`}
                          variant={tier.highlighted ? 'default' : 'outline'}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePricingSelection(tier.buyButtonId)
                          }}
                        >
                          {tier.price === '$147' ? (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Start Free Trial
                            </>
                          ) : (
                            <>
                              <Crown className="h-4 w-4 mr-2" />
                              Get Started
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Not ready? You can explore with our free tier and upgrade anytime.
                  </p>
                </div>
              ) : currentSlide.isForm ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    I appreciate you trying brandVX and would love any feedback. Drop your contact info below and I will personally reach out to thank you. Go be great!
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="founder-email" className="text-xs uppercase tracking-wide text-slate-500">
                        Email (Optional)
                      </Label>
                      <Input
                        id="founder-email"
                        type="email"
                        value={founderFormData.email}
                        onChange={(e) => setFounderFormData({ ...founderFormData, email: e.target.value })}
                        placeholder="you@example.com"
                        className="rounded-xl border-slate-200"
                      />
                      {founderFormErrors.email && (
                        <p className="text-xs text-rose-600">{founderFormErrors.email}</p>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="founder-phone" className="text-xs uppercase tracking-wide text-slate-500">
                        Phone (Optional)
                      </Label>
                      <Input
                        id="founder-phone"
                        type="tel"
                        value={founderFormData.phone}
                        onChange={(e) => setFounderFormData({ ...founderFormData, phone: e.target.value })}
                        placeholder="(555) 555-5555"
                        className="rounded-xl border-slate-200"
                      />
                      {founderFormErrors.phone && (
                        <p className="text-xs text-rose-600">{founderFormErrors.phone}</p>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-500">
                      Share either email or phone if you'd like me to follow up.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {currentSlide.content}
                </div>
              )}
              
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFounderBack}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                
                {currentSlide.isPricing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFounderNext}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Skip for now
                  </Button>
                ) : (
                  <Button
                    onClick={handleFounderNext}
                    className="bg-primary hover:bg-primary/90 text-white"
                    size="sm"
                    disabled={isSubmittingFounderForm}
                  >
                    {isSubmittingFounderForm ? 'Submitting...' : isLastSlide ? 'Finish' : 'Continue'}
                    {!isSubmittingFounderForm && !isLastSlide && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // Render main welcome tooltip
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" />
      
      {/* Tooltip */}
      <div className={positionClasses[position]}>
        <Card className="w-96 max-w-[90vw] shadow-2xl border-primary/20 bg-white">
          <CardHeader className="relative pb-4">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-muted"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-2 bg-primary/10 rounded-full">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                New to this page?
              </Badge>
            </div>
            
            <CardTitle className="text-xl pr-8" style={{ fontFamily: 'Playfair Display, serif' }}>
              {content.title}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {content.description}
            </p>
            
            {content.tips && content.tips.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm font-medium text-primary">
                  <Lightbulb className="h-4 w-4" />
                  <span>Quick Tips:</span>
                </div>
                
                <ul className="space-y-2">
                  {content.tips.map((tip, index) => (
                    <li key={index} className="flex items-start space-x-3 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip tour
              </Button>
              
              <Button
                onClick={handleGotIt}
                className="bg-primary hover:bg-primary/90 text-white"
                size="sm"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Got it!
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// Hook to easily add onboarding to any page
export function usePageOnboarding(pageId: keyof typeof PAGE_ONBOARDING_CONTENT) {
  const { hasSeenOnboarding, isOnboardingEnabled } = useOnboarding()
  
  return {
    shouldShowOnboarding: isOnboardingEnabled && !hasSeenOnboarding(pageId),
    OnboardingComponent: () => <OnboardingTooltip pageId={pageId} />
  }
}