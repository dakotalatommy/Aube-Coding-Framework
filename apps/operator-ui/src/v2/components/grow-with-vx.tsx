import { useMemo, useState } from 'react'
import { ChevronRight, Clock, Crown, Play, Sparkles, Star, Target, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import type { GrowthCategory, GrowthLesson } from './types/growth'
import { cn } from './ui/utils'

const DEFAULT_CATEGORIES: GrowthCategory[] = [
  {
    id: 'marketing',
    title: 'Marketing mastery',
    description: 'Demand generation made for beauty professionals.',
    iconName: 'target',
    colorClass: 'bg-primary/10 text-primary',
  },
  {
    id: 'sales',
    title: 'Sales excellence',
    description: 'Lead-to-booked scripts, pricing, and offer design.',
    iconName: 'sales',
    colorClass: 'bg-accent/10 text-accent',
  },
  {
    id: 'operations',
    title: 'Operations',
    description: 'Retention, capacity planning, and automation playbooks.',
    iconName: 'operations',
    colorClass: 'bg-secondary/20 text-primary',
  },
  {
    id: 'growth',
    title: 'Scale & growth',
    description: 'Partnerships, referrals, and expansion readiness.',
    iconName: 'growth',
    colorClass: 'bg-green-100 text-green-700',
  },
]

const CURATED_LESSONS: GrowthLesson[] = [
  {
    id: 'lesson-instagram',
    title: 'Instagram marketing that converts',
    category: 'marketing',
    description: 'Audit your grid, pair Stories with AI captions, and drive bookings in minutes.',
    durationMinutes: 24,
    featured: true,
    locked: true,
  },
  {
    id: 'lesson-pricing',
    title: 'Pricing for profit partners',
    category: 'sales',
    description: 'Invent tiered menu offers and protect margins with beauty-specific templates.',
    durationMinutes: 18,
    featured: true,
    locked: true,
  },
  {
    id: 'lesson-retention',
    title: 'Retention rhythms that stick',
    category: 'operations',
    description: 'Turn service cadence data into follow-up campaigns that feel handcrafted.',
    durationMinutes: 31,
    locked: true,
  },
  {
    id: 'lesson-referrals',
    title: 'Referral flywheel masterclass',
    category: 'growth',
    description: 'Design loyalty perks and track ROI from your top advocates.',
    durationMinutes: 22,
    locked: true,
  },
]

interface GrowWithVXProps {
  plan?: string
  lessons?: GrowthLesson[]
  categories?: GrowthCategory[]
}

export function GrowWithVX({ plan, lessons, categories }: GrowWithVXProps) {
  const isPremium = (plan ?? '').toLowerCase() === 'premium'
  const visibleCategories = useMemo(() => {
    if (Array.isArray(categories) && categories.length) return categories
    return DEFAULT_CATEGORIES
  }, [categories])
  const visibleLessons = useMemo(() => {
    if (Array.isArray(lessons) && lessons.length) return lessons
    return CURATED_LESSONS
  }, [lessons])

  const [selectedLesson, setSelectedLesson] = useState<GrowthLesson | null>(null)

  const renderCTA = () => (
    <Card className="border border-amber-200 bg-amber-50">
      <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900">Premium launches soon</p>
          <p className="text-xs text-amber-800">
            Marketing automation workshops unlock with the Premium plan. Upgrade from Settings → Plan or chat with our team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/settings?tab=plan' }))}
          >
            View plans
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
          <Button size="sm" onClick={() => window.open('mailto:support@brandvx.io', '_blank')}>Talk to us</Button>
        </div>
      </CardContent>
    </Card>
  )

  const iconForCategory = (category: GrowthCategory) => {
    switch (category.iconName) {
      case 'target':
        return <Target className="h-4 w-4 text-primary" />
      case 'sales':
        return <TrendingUp className="h-4 w-4 text-accent" />
      case 'operations':
        return <Zap className="h-4 w-4 text-primary" />
      case 'growth':
        return <Sparkles className="h-4 w-4 text-green-600" />
      default:
        return <Sparkles className="h-4 w-4 text-primary" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </span>
          Grow with VX
        </h1>
        <p className="text-sm text-muted-foreground">
          Audience building, offer strategy, and retention automations—curated for beauty entrepreneurs.
        </p>
      </div>

      {!isPremium ? renderCTA() : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleCategories.map((category) => (
          <Card key={category.id} className="border border-muted/60 bg-card">
            <CardContent className="space-y-3 p-4">
              <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', category.colorClass)}>
                {iconForCategory(category)}
                <span>{category.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">{category.description}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedLesson({
                    id: `${category.id}-overview`,
                    title: `${category.title} preview`,
                    category: category.id,
                    description: category.description ?? '',
                    durationMinutes: 10,
                    locked: !isPremium,
                  })
                }
              >
                {isPremium ? 'Browse lessons' : 'Preview curriculum'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Play className="h-5 w-5 text-primary" />
            Featured workshops
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Weekly sprints covering Instagram, client retention, and revenue operations inside high-performing studios.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleLessons.slice(0, 6).map((lesson) => (
            <Card key={lesson.id} className="border border-muted/70 bg-card/70">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {lesson.category}
                  </Badge>
                  {lesson.featured ? <Badge className="bg-primary/10 text-primary">Featured</Badge> : null}
                  {lesson.locked && !isPremium ? <Badge className="bg-emerald-100 text-emerald-800">Coming soon</Badge> : null}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>{lesson.title}</h3>
                  <p className="text-sm text-muted-foreground">{lesson.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lesson.durationMinutes ? `${lesson.durationMinutes} min` : 'Workshop'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-primary" />
                    {lesson.rating ?? 4.9}
                  </span>
                </div>
                <Button
                  variant={isPremium && !lesson.locked ? 'default' : 'outline'}
                  onClick={() => setSelectedLesson(lesson)}
                >
                  {isPremium && !lesson.locked ? 'Watch now' : 'Preview syllabus'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedLesson)} onOpenChange={() => setSelectedLesson(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLesson?.title}</DialogTitle>
            <DialogDescription>{selectedLesson?.description}</DialogDescription>
          </DialogHeader>
          {selectedLesson ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                {isPremium && !selectedLesson.locked
                  ? 'This workshop will open in a new window with chapter navigation and downloadable templates.'
                  : 'Premium unlocks hands-on playbooks, templates, and AI-assisted workflows for this lesson.'}
              </p>
              <Button
                variant={isPremium && !selectedLesson.locked ? 'default' : 'outline'}
                onClick={() => {
                  if (isPremium && !selectedLesson.locked && selectedLesson.resourceUrl) {
                    window.open(selectedLesson.resourceUrl, '_blank', 'noopener')
                  } else {
                    window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/settings?tab=plan' }))
                  }
                }}
              >
                {isPremium && !selectedLesson.locked ? (
                  <>
                    <Play className="mr-2 h-4 w-4" /> Start lesson
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-4 w-4" /> Upgrade to Premium
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GrowWithVX
