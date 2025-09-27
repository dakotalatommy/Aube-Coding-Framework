// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { useOnboarding } from './onboarding-context'
import { 
  BookOpen, 
  RotateCcw, 
  CheckCircle2, 
  Circle,
  Sparkles,
  Settings as SettingsIcon
} from 'lucide-react'

const PAGE_LABELS = {
  dashboard: 'Dashboard',
  askvx: 'AskVX',
  brandvzn: 'BrandVZN',
  messages: 'Messages',
  clients: 'Clients',
  agenda: 'Agenda',
  'follow-ups': 'Follow Ups',
  'grow-your-list': 'Fill Your Chair',
  'grow-with-vx': 'Grow with VX',
  inventory: 'Inventory',
  tutorials: 'Tutorials',
  settings: 'Settings'
}

export function OnboardingSettings() {
  const { 
    hasSeenOnboarding, 
    resetOnboarding, 
    isOnboardingEnabled, 
    setOnboardingEnabled 
  } = useOnboarding()

  const completedPages = Object.keys(PAGE_LABELS).filter(pageId => 
    hasSeenOnboarding(pageId)
  )

  const totalPages = Object.keys(PAGE_LABELS).length
  const completionPercentage = Math.round((completedPages.length / totalPages) * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <BookOpen className="h-5 w-5 text-primary" />
          <span>Onboarding & Tutorials</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your guided tour experience and help tooltips
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Onboarding Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Show Welcome Tours</Label>
            <p className="text-sm text-muted-foreground">
              Display helpful tooltips when visiting pages for the first time
            </p>
          </div>
          <Switch
            checked={isOnboardingEnabled}
            onCheckedChange={setOnboardingEnabled}
          />
        </div>

        <Separator />

        {/* Progress Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium" style={{ fontFamily: 'Playfair Display, serif' }}>
              Tour Progress
            </h3>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {completionPercentage}% Complete
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            You've completed the welcome tour for {completedPages.length} of {totalPages} pages.
          </p>
        </div>

        <Separator />

        {/* Page Status List */}
        <div className="space-y-3">
          <h3 className="font-medium" style={{ fontFamily: 'Playfair Display, serif' }}>
            Page Tours
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(PAGE_LABELS).map(([pageId, label]) => {
              const isCompleted = hasSeenOnboarding(pageId)
              
              return (
                <div 
                  key={pageId}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium flex-1">{label}</span>
                  {!isCompleted && (
                    <Badge variant="outline" size="sm" className="text-xs bg-primary/5 text-primary border-primary/20">
                      New
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Reset Options */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium" style={{ fontFamily: 'Playfair Display, serif' }}>
              Reset Options
            </h3>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">Reset All Tours</p>
              <p className="text-sm text-muted-foreground">
                This will show welcome tooltips again for all pages
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetOnboarding}
              className="flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="flex items-start space-x-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">
              Need help getting started?
            </p>
            <p className="text-sm text-muted-foreground">
              Turn on welcome tours and visit any page to see helpful tips and guidance. You can always skip tours if you don't need them.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}