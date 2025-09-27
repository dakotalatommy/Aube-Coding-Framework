// @ts-nocheck
import { useMemo } from 'react'
import {
  BookOpen,
  CheckCircle,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Separator } from './ui/separator'
import type { TutorialItem } from './types/growth'
import { cn } from './ui/utils'

const CURATED_TUTORIALS: TutorialItem[] = [
  {
    id: 'dashboard-overview',
    title: 'Dashboard tour',
    description: 'Navigate the BrandVX dashboard, KPIs, and quick actions in under four minutes.',
    durationMinutes: 4,
    tags: ['getting-started'],
    locked: false,
  },
  {
    id: 'askvx-basics',
    title: 'Ask VX basics',
    description: 'Draft AI prompts, capture approvals, and route follow-ups with the floating assistant.',
    durationMinutes: 5,
    tags: ['tools'],
    locked: false,
  },
  {
    id: 'follow-ups-automation',
    title: 'Automated follow-ups',
    description: 'Let BrandVX nudge dormant guests and win back revenue with cadence templates.',
    durationMinutes: 6,
    tags: ['advanced'],
    locked: true,
  },
  {
    id: 'analytics',
    title: 'Retention analytics deep dive',
    description: 'Understand the revenue and retention metrics that power Fill Your Chair.',
    durationMinutes: 7,
    tags: ['advanced'],
    locked: true,
  },
]

interface TutorialsProps {
  plan?: string
  tutorials?: TutorialItem[]
}

export function Tutorials({ plan, tutorials }: TutorialsProps) {
  const isPremium = (plan ?? '').toLowerCase() === 'premium'
  const items = useMemo(() => {
    if (Array.isArray(tutorials) && tutorials.length) return tutorials
    return CURATED_TUTORIALS
  }, [tutorials])

  const unlockedCount = items.filter((item) => !item.locked).length
  const totalCount = items.length
  const progressValue = Math.round((unlockedCount / totalCount) * 100)

  const renderLockedOverlay = () => (
    <Card className="border border-amber-200 bg-amber-50">
      <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900">Premium tutorials coming soon</p>
          <p className="text-xs text-amber-800">
            Unlock advanced launch playbooks, marketing flows, and automation walkthroughs with the Premium plan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/settings?tab=plan' }))}
          >
            View plans
          </Button>
          <Button size="sm" onClick={() => window.open('mailto:support@brandvx.io', '_blank')}>Talk to us</Button>
        </div>
      </CardContent>
    </Card>
  )

  const categories: Array<{ key: string; title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
    {
      key: 'getting-started',
      title: 'Getting started',
      description: 'Essential walkthroughs to launch your workspace.',
      icon: BookOpen,
    },
    {
      key: 'tools',
      title: 'Core tools',
      description: 'Go hands-on with Ask VX, messaging, and inventory.',
      icon: Sparkles,
    },
    {
      key: 'advanced',
      title: 'Advanced',
      description: 'Automation, analytics, and premium growth strategy.',
      icon: TrendingUp,
    },
  ]

  const renderTutorialCard = (tutorial: TutorialItem) => (
    <Card key={tutorial.id} className="border border-muted/70 bg-card/70">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {(tutorial.tags?.[0] ?? 'tutorial').replace('-', ' ')}
          </Badge>
          {tutorial.locked && !isPremium ? <Badge className="bg-emerald-100 text-emerald-800">Coming soon</Badge> : null}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>{tutorial.title}</h3>
          <p className="text-sm text-muted-foreground">{tutorial.description}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {tutorial.durationMinutes ? `${tutorial.durationMinutes} min` : 'Quick lesson'}
          </span>
          <Button
            size="sm"
            variant={tutorial.locked && !isPremium ? 'outline' : 'default'}
            onClick={() => {
              if (tutorial.locked && !isPremium) {
                window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/settings?tab=plan' }))
              } else if (tutorial.videoUrl) {
                window.open(tutorial.videoUrl, '_blank', 'noopener')
              } else {
                window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/demo?tour=1' }))
              }
            }}
          >
            {tutorial.locked && !isPremium ? 'Upgrade to watch' : 'Launch tutorial'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </span>
          Tutorials
        </h1>
        <p className="text-sm text-muted-foreground">
          Quick walkthroughs to help you and your team master BrandVX workflows.
        </p>
      </div>

      <Card className="border border-muted">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
                Onboarding progress
              </CardTitle>
              <CardDescription>
                Complete the guided tour to unlock AI playbooks, follow-ups, and more.
              </CardDescription>
            </div>
            <Button onClick={() => window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/demo?tour=1' }))}>
              Start guided tour
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{unlockedCount} of {totalCount} tutorials unlocked</span>
              <span>{progressValue}% complete</span>
            </div>
            <Progress value={progressValue} />
          </div>
        </CardContent>
      </Card>

      {!isPremium ? renderLockedOverlay() : null}

      <Tabs defaultValue="getting-started" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          {categories.map((category) => (
            <TabsTrigger key={category.key} value={category.key} className="flex items-center gap-2 text-xs md:text-sm">
              <category.icon className="h-3 w-3" />
              {category.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {categories.map((category) => (
          <TabsContent key={category.key} value={category.key} className="space-y-4">
            <p className="text-sm text-muted-foreground">{category.description}</p>
            <Separator />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.filter((item) => (item.tags ?? []).includes(category.key)).map(renderTutorialCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}