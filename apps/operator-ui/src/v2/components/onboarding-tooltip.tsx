// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useOnboarding } from './onboarding-context'
import { 
  X, 
  ArrowRight, 
  Lightbulb, 
  Sparkles,
  ChevronRight,
  BookOpen
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

export function OnboardingTooltip({ 
  pageId, 
  position = 'center',
  delay = 1000 
}: Omit<OnboardingTooltipProps, 'title' | 'description'> & { pageId: keyof typeof PAGE_ONBOARDING_CONTENT }) {
  const { hasSeenOnboarding, markOnboardingComplete, isOnboardingEnabled } = useOnboarding()
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const content = PAGE_ONBOARDING_CONTENT[pageId]

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
    setIsVisible(false)
    markOnboardingComplete(pageId)
  }

  if (!isVisible || !content) return null

  const positionClasses = {
    top: 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50',
    bottom: 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
    center: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
  }

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