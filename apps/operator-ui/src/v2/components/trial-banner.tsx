// @ts-nocheck
import { useState } from 'react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { 
  Clock, 
  Crown, 
  Sparkles, 
  TrendingUp, 
  Users,
  Target,
  MousePointer,
  ArrowRight,
  CheckCircle,
  Lock
} from 'lucide-react'

interface TrialBannerProps {
  currentDay: number
  totalDays: number
  onUpgrade: () => void
}

const LOCKED_FEATURES = [
  {
    icon: MousePointer,
    title: "Fill Your Chair",
    description: "Landing pages & link-in-bio tools to capture leads from social media and ads",
    value: "Generate 10-50 new leads per month"
  },
  {
    icon: TrendingUp,
    title: "Grow with VX",
    description: "Advanced marketing automation and client retention strategies",
    value: "Increase client retention by 40%"
  }
]

const TRIAL_BENEFITS = [
  "Essential scheduling & client management",
  "Basic analytics and insights", 
  "AskVX AI beauty consultant",
  "BrandVZN style recommendations",
  "Up to 50 clients"
]

const PREMIUM_BENEFITS = [
  "Unlimited lead generation tools",
  "Advanced marketing automation",
  "Premium analytics & insights",
  "Inventory management system",
  "Custom branding options",
  "Priority customer support"
]

export function TrialBanner({ currentDay, totalDays, onUpgrade }: TrialBannerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const daysRemaining = totalDays - currentDay
  const progressPercentage = (currentDay / totalDays) * 100
  
  const getTrialStatus = () => {
    if (daysRemaining <= 1) return { color: 'destructive', urgency: 'high' }
    if (daysRemaining <= 2) return { color: 'amber', urgency: 'medium' }
    return { color: 'primary', urgency: 'low' }
  }

  const status = getTrialStatus()

  return (
    <>
      <Card className={`border-2 ${status.color === 'destructive' ? 'border-red-200 bg-red-50' : status.color === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-primary/20 bg-primary/5'}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${status.color === 'destructive' ? 'bg-red-100' : status.color === 'amber' ? 'bg-amber-100' : 'bg-primary/10'}`}>
                <Clock className={`h-5 w-5 ${status.color === 'destructive' ? 'text-red-600' : status.color === 'amber' ? 'text-amber-600' : 'text-primary'}`} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Free Trial - Day {currentDay} of {totalDays}
                  </h3>
                  <Badge variant={status.color === 'destructive' ? 'destructive' : 'secondary'} className="text-xs">
                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {status.urgency === 'high' 
                    ? "Trial expires soon! Upgrade now to keep all your data and unlock premium features."
                    : status.urgency === 'medium'
                    ? "Your trial is ending soon. Upgrade to continue growing your business."
                    : "Discover what BVX can do for your beauty business."
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    See What You're Missing
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                      <Crown className="h-5 w-5 text-primary" />
                      <span>Unlock Your Business Potential</span>
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                    {/* Locked Features */}
                    <div>
                      <h4 className="font-semibold mb-3 text-red-600">🔒 Currently Locked Features</h4>
                      <div className="space-y-3">
                        {LOCKED_FEATURES.map((feature, index) => {
                          const Icon = feature.icon
                          return (
                            <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="p-2 bg-red-100 rounded-lg">
                                <Icon className="h-4 w-4 text-red-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h5 className="font-medium text-red-800">{feature.title}</h5>
                                  <Lock className="h-3 w-3 text-red-500" />
                                </div>
                                <p className="text-sm text-red-700 mb-1">{feature.description}</p>
                                <Badge className="bg-red-600 text-white text-xs">{feature.value}</Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Current vs Premium Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-3 text-muted-foreground">✅ Your Current Trial</h4>
                        <ul className="space-y-2">
                          {TRIAL_BENEFITS.map((benefit, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-3 text-primary">🚀 With Pro/Premium Plan</h4>
                        <ul className="space-y-2">
                          {PREMIUM_BENEFITS.map((benefit, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <span className="font-medium">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Success Stats */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <h4 className="font-semibold mb-3 text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                        What Pro Members Achieve:
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">3x</div>
                          <div className="text-xs text-muted-foreground">More Bookings</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">40%</div>
                          <div className="text-xs text-muted-foreground">Higher Retention</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">$2K+</div>
                          <div className="text-xs text-muted-foreground">Extra Revenue/Mo</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4 border-t border-border sticky bottom-0 bg-popover">
                      <Button onClick={onUpgrade} className="flex-1 bg-primary hover:bg-primary/90">
                        <Crown className="h-4 w-4 mr-2" />
                        Upgrade Now - From $47/mo
                      </Button>
                      <Button variant="outline" onClick={() => setShowDetails(false)}>
                        Maybe Later
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button onClick={onUpgrade} className="bg-primary hover:bg-primary/90">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Trial Progress</span>
              <span className="text-sm text-muted-foreground">{currentDay}/{totalDays} days used</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default TrialBanner