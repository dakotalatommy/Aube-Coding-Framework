// @ts-nocheck
import { ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  Lock,
  Sparkles,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface LockedFeaturesOverlayProps {
  title: string
  description: string
  benefits?: string[]
  mockupContent?: ReactNode
  planLabel?: string
  onUpgrade?: () => void
}

export function LockedFeaturesOverlay({
  title,
  description,
  benefits = [],
  mockupContent,
  planLabel = 'Pro',
  onUpgrade,
}: LockedFeaturesOverlayProps) {
  const handleUpgrade = () => {
    if (typeof onUpgrade === 'function') {
      onUpgrade()
      return
    }
    window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/settings?tab=plan' }))
  }

  const handleContact = () => {
    window.open('mailto:support@brandvx.io?subject=Upgrade%20to%20BrandVX', '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </span>
          {title}
          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
            <Crown className="mr-1 h-3 w-3" /> {planLabel} feature
          </Badge>
        </h1>
        <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {description}
        </p>
      </div>

      <div className="relative">
        {mockupContent ? <div className="pointer-events-none blur-sm opacity-40">{mockupContent}</div> : null}
        <div className="absolute inset-0 flex items-center justify-center">
          <Card className="w-full max-w-xl border border-primary/20 bg-background/95 shadow-lg backdrop-blur">
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                  <Crown className="h-6 w-6" />
                </span>
              </div>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Unlock {title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Access marketing playbooks, automation templates, and concierge support with the {planLabel} plan.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {benefits.length ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>
                    What you’ll gain
                  </h3>
                  <div className="space-y-2 text-sm text-foreground">
                    {benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-primary" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-primary">
                  Customers who upgrade to {planLabel} report 2× faster onboarding and $5K+ in incremental revenue during the first quarter.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Button onClick={handleUpgrade} className="flex-1">
                  <Crown className="mr-2 h-4 w-4" /> Upgrade to {planLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleContact}>
                  <Sparkles className="mr-2 h-4 w-4" /> Talk to us
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                ⚡ Instant access • Cancel anytime • Concierge setup included for {planLabel}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default LockedFeaturesOverlay