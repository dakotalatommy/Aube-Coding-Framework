import type { ComponentType, ReactNode } from 'react'
import {
  ArrowRightLeft,
  Crown,
  DollarSign,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

type ChangeDirection = 'positive' | 'negative' | 'neutral'

export interface DashboardStat {
  title: string
  value: string
  description?: ReactNode
  icon?: ComponentType<{ className?: string }>
  change?: {
    label: string
    direction: ChangeDirection
  }
  celebrationMessage?: string
  proFeature?: boolean
}

interface StatsCardsProps {
  stats?: DashboardStat[]
  loading?: boolean
}

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  revenue: DollarSign,
  clients: Users,
  retention: Repeat,
  roi: ArrowRightLeft,
}

function getIcon(stat: DashboardStat) {
  if (stat.icon) return stat.icon
  const key = stat.title.toLowerCase()
  if (key.includes('revenue')) return iconMap.revenue
  if (key.includes('client')) return iconMap.clients
  if (key.includes('retention')) return iconMap.retention
  if (key.includes('roi')) return iconMap.roi
  return DollarSign
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="h-28">
            <CardContent className="h-full">
              <div className="flex h-full flex-col justify-between py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats?.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        KPI data will appear here once activity is recorded.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const IconComponent = getIcon(stat)
        const celebration = Boolean(stat.celebrationMessage)
        return (
          <Card
            key={stat.title}
            className={celebration ? 'relative overflow-hidden' : undefined}
          >
            {celebration && (
              <div className="absolute right-2 top-2 z-10">
                <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
              </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center space-x-1 text-sm font-medium text-muted-foreground">
                <span>{stat.title}</span>
                {stat.proFeature && <Crown className="h-3 w-3 text-primary" />}
              </CardTitle>
              <IconComponent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-black">{stat.value}</div>
              {stat.change && stat.change.label ? (
                <div className="flex items-center space-x-1 text-xs">
                  {stat.change.direction === 'positive' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : stat.change.direction === 'negative' ? (
                    <TrendingDown className="h-3 w-3 text-rose-500" />
                  ) : null}
                  <span
                    className={
                      stat.change.direction === 'positive'
                        ? 'text-emerald-500'
                        : stat.change.direction === 'negative'
                          ? 'text-rose-500'
                          : 'text-muted-foreground'
                    }
                  >
                    {stat.change.label}
                  </span>
                  {stat.description ? (
                    <span className="text-muted-foreground">{stat.description}</span>
                  ) : null}
                </div>
              ) : stat.description ? (
                <div className="text-xs text-muted-foreground">{stat.description}</div>
              ) : null}
              {celebration && (
                <div className="text-xs font-medium text-primary">
                  {stat.celebrationMessage}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

StatsCards.defaultProps = {
  stats: undefined,
  loading: false,
}
