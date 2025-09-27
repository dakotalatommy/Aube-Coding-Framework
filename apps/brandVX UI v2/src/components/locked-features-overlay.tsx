import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Lock, 
  Crown, 
  Sparkles, 
  ArrowRight,
  CheckCircle
} from 'lucide-react'

interface LockedFeaturesOverlayProps {
  title: string
  description: string
  benefits: string[]
  mockupContent: React.ReactNode
  onUpgrade: () => void
}

export function LockedFeaturesOverlay({ title, description, benefits, mockupContent, onUpgrade }: LockedFeaturesOverlayProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black flex items-center space-x-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          <div className="p-2 bg-primary/10 rounded-full">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <span>{title}</span>
          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
            <Crown className="h-3 w-3 mr-1" />
            Pro Feature
          </Badge>
        </h1>
        <p className="text-muted-foreground mt-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {description}
        </p>
      </div>

      {/* Locked Content Preview */}
      <div className="relative">
        {/* Blurred content behind */}
        <div className="filter blur-sm opacity-50 pointer-events-none">
          {mockupContent}
        </div>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/90 to-white/95 flex items-center justify-center">
          <Card className="w-full max-w-2xl mx-6 border-2 border-primary/20 shadow-2xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gradient-to-r from-primary to-accent rounded-full">
                  <Crown className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl" style={{ fontFamily: 'Playfair Display, serif' }}>
                Unlock {title} with Pro
              </CardTitle>
              <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                This powerful feature is available with Pro and Premium plans
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Benefits */}
              <div>
                <h3 className="font-semibold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  What you'll get:
                </h3>
                <div className="space-y-2">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Stats */}
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Pro Members See Results Like:
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold text-primary">200%</div>
                    <div className="text-xs text-muted-foreground">Lead Increase</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-primary">$5K+</div>
                    <div className="text-xs text-muted-foreground">Extra Revenue</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-primary">50+</div>
                    <div className="text-xs text-muted-foreground">New Clients</div>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={onUpgrade} 
                  className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
                  size="lg"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Pro - $97/mo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="flex-1">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start with Essentials - $47/mo
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  ⚡ Instant access • Cancel anytime • 30-day money-back guarantee
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default LockedFeaturesOverlay