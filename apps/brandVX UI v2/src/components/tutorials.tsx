import { useState } from 'react'
import { Play, CheckCircle, Clock, Users, Calendar, MessageSquare, TrendingUp, Package, Sparkles, ChevronRight, BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Separator } from './ui/separator'

interface TutorialStep {
  id: string
  title: string
  description: string
  duration: string
  videoUrl: string
  completed: boolean
  icon: any
  category: 'getting-started' | 'tools' | 'advanced'
}

const tutorialSteps: TutorialStep[] = [
  // Getting Started
  {
    id: 'dashboard-overview',
    title: 'Dashboard Overview',
    description: 'Get familiar with your BVX dashboard layout, navigation, and key metrics',
    duration: '3:45',
    videoUrl: 'https://example.com/dashboard-overview',
    completed: false,
    icon: TrendingUp,
    category: 'getting-started'
  },
  {
    id: 'setting-up-profile',
    title: 'Setting Up Your Business Profile',
    description: 'Complete your business information and customize your workspace',
    duration: '2:30',
    videoUrl: 'https://example.com/profile-setup',
    completed: false,
    icon: Users,
    category: 'getting-started'
  },
  {
    id: 'navigation-basics',
    title: 'Navigation Basics',
    description: 'Learn to navigate between different sections and use the sidebar menu',
    duration: '2:15',
    videoUrl: 'https://example.com/navigation',
    completed: false,
    icon: BookOpen,
    category: 'getting-started'
  },

  // Tools
  {
    id: 'brandvzn-consultation',
    title: 'BrandVZN AI Consultations',
    description: 'Master the AI-powered beauty consultation tool for client transformations',
    duration: '6:20',
    videoUrl: 'https://example.com/brandvzn',
    completed: false,
    icon: Sparkles,
    category: 'tools'
  },
  {
    id: 'client-management',
    title: 'Client Management System',
    description: 'Add, organize, and manage your client database effectively',
    duration: '5:15',
    videoUrl: 'https://example.com/clients',
    completed: false,
    icon: Users,
    category: 'tools'
  },
  {
    id: 'agenda-scheduling',
    title: 'Agenda & Scheduling',
    description: 'Manage appointments, tasks, and daily workflow planning',
    duration: '4:50',
    videoUrl: 'https://example.com/agenda',
    completed: false,
    icon: Calendar,
    category: 'tools'
  },
  {
    id: 'messaging-system',
    title: 'Client Messaging',
    description: 'Communicate with clients using the integrated messaging system',
    duration: '3:30',
    videoUrl: 'https://example.com/messages',
    completed: false,
    icon: MessageSquare,
    category: 'tools'
  },
  {
    id: 'inventory-tracking',
    title: 'Inventory Management',
    description: 'Track supplies, manage stock levels, and set reorder alerts',
    duration: '4:10',
    videoUrl: 'https://example.com/inventory',
    completed: false,
    icon: Package,
    category: 'tools'
  },

  // Advanced
  {
    id: 'follow-ups-automation',
    title: 'Automated Follow-ups',
    description: 'Set up automated client follow-ups and retention campaigns',
    duration: '5:45',
    videoUrl: 'https://example.com/follow-ups',
    completed: false,
    icon: TrendingUp,
    category: 'advanced'
  },
  {
    id: 'analytics-insights',
    title: 'Analytics & Business Insights',
    description: 'Understand your business metrics and growth opportunities',
    duration: '6:00',
    videoUrl: 'https://example.com/analytics',
    completed: false,
    icon: TrendingUp,
    category: 'advanced'
  }
]

function VideoPlaceholder({ step, onPlay }: { step: TutorialStep; onPlay: () => void }) {
  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden group cursor-pointer" onClick={onPlay}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/90 hover:bg-white rounded-full p-4 transition-all group-hover:scale-110">
          <Play className="h-8 w-8 text-gray-900 ml-1" />
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-black/80 rounded px-3 py-1 backdrop-blur-sm">
          <p className="text-white font-medium text-sm">{step.title}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-white/80 text-xs">{step.duration}</span>
            <Badge variant="secondary" className="text-xs">
              Tutorial
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Tutorials() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [watchingVideo, setWatchingVideo] = useState<string | null>(null)

  const markAsCompleted = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]))
  }

  const handlePlayVideo = (stepId: string) => {
    setWatchingVideo(stepId)
    // Simulate video completion after 3 seconds
    setTimeout(() => {
      markAsCompleted(stepId)
      setWatchingVideo(null)
    }, 3000)
  }

  const getStepsByCategory = (category: string) => {
    return tutorialSteps.filter(step => step.category === category)
  }

  const totalSteps = tutorialSteps.length
  const completedCount = completedSteps.size
  const progressPercentage = (completedCount / totalSteps) * 100

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'getting-started': return BookOpen
      case 'tools': return Sparkles
      case 'advanced': return TrendingUp
      default: return BookOpen
    }
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'getting-started': return 'Getting Started'
      case 'tools': return 'Core Tools'
      case 'advanced': return 'Advanced Features'
      default: return 'Tutorials'
    }
  }

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'getting-started': return 'Essential basics to get you up and running'
      case 'tools': return 'Master the key features for daily operations'
      case 'advanced': return 'Advanced techniques for business growth'
      default: return 'Learn how to use BVX effectively'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          Tutorial Videos
        </h1>
        <p className="text-lg text-muted-foreground mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Step-by-step guides to master your BVX beauty business platform
        </p>
        
        {/* Progress Overview */}
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Your Progress
                </h3>
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {totalSteps} tutorials completed
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {Math.round(progressPercentage)}%
                </div>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tutorial Categories */}
      <Tabs defaultValue="getting-started" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="getting-started" className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4" />
            <span>Getting Started</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4" />
            <span>Core Tools</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Advanced</span>
          </TabsTrigger>
        </TabsList>

        {['getting-started', 'tools', 'advanced'].map((category) => {
          const CategoryIcon = getCategoryIcon(category)
          const steps = getStepsByCategory(category)
          const categoryCompleted = steps.filter(step => completedSteps.has(step.id)).length
          
          return (
            <TabsContent key={category} value={category} className="space-y-6">
              {/* Category Header */}
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <CategoryIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {getCategoryTitle(category)}
                  </h2>
                  <p className="text-muted-foreground">
                    {getCategoryDescription(category)} • {categoryCompleted}/{steps.length} completed
                  </p>
                </div>
              </div>

              {/* Tutorial Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {steps.map((step, index) => {
                  const isCompleted = completedSteps.has(step.id)
                  const isWatching = watchingVideo === step.id
                  const StepIcon = step.icon

                  return (
                    <Card key={step.id} className={`transition-all hover:shadow-lg ${isCompleted ? 'border-green-200 bg-green-50/50' : 'hover:border-primary/30'}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-primary/10'}`}>
                              {isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <StepIcon className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>
                                {step.title}
                              </CardTitle>
                              <div className="flex items-center space-x-2 mt-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{step.duration}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant={isCompleted ? "default" : "outline"} className="text-xs">
                            {isCompleted ? "Completed" : `Step ${index + 1}`}
                          </Badge>
                        </div>
                        <CardDescription className="mt-2">
                          {step.description}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        {isWatching ? (
                          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                            <div className="text-center text-white">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                              <p className="text-sm">Loading video...</p>
                            </div>
                          </div>
                        ) : (
                          <VideoPlaceholder 
                            step={step} 
                            onPlay={() => handlePlayVideo(step.id)} 
                          />
                        )}
                        
                        <div className="flex items-center justify-between mt-4">
                          <Button 
                            variant={isCompleted ? "outline" : "default"}
                            size="sm"
                            className={isCompleted ? "text-green-600 border-green-200 hover:bg-green-50" : ""}
                            onClick={() => handlePlayVideo(step.id)}
                            disabled={isWatching}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Rewatch
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Watch Tutorial
                              </>
                            )}
                          </Button>
                          
                          {isCompleted && (
                            <Badge className="bg-green-100 text-green-700">
                              ✓ Completed
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Help Section */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                Need Additional Help?
              </h3>
              <p className="text-muted-foreground mb-4">
                Can't find what you're looking for? Our support team is here to help you get the most out of your BVX platform.
              </p>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent/10">
                  Contact Support
                </Button>
                <Button variant="ghost" size="sm" className="text-accent hover:bg-accent/10">
                  <span>View Documentation</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}