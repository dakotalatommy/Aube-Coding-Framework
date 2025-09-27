import { useMemo } from 'react'
import { Calendar, CheckCircle, Clock, Sparkles, Users, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useAgenda } from './agenda-context'
import type { DashboardAgendaItem } from '../types/dashboard'

interface QuickstartAgendaProps {
  items?: DashboardAgendaItem[] | null
  loading?: boolean
  onViewFullAgenda?: () => void
}

const fallbackColors = [
  'from-primary to-purple-500',
  'from-purple-500 to-fuchsia-500',
  'from-rose-500 to-orange-400',
]

const iconLookup: Record<NonNullable<DashboardAgendaItem['iconName']>, typeof Users> = {
  clients: Users,
  revenue: TrendingUp,
  retention: Sparkles,
  automation: Clock,
}

const formatDateHeading = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

export function QuickstartAgenda({ items, loading = false, onViewFullAgenda }: QuickstartAgendaProps) {
  const { tasks: contextTasks, toggleTaskCompletion } = useAgenda()

  const composedItems = useMemo<DashboardAgendaItem[]>(() => {
    if (items && items.length) return items
    return contextTasks.map((task, index) => ({
      id: String(task.id ?? index),
      title: task.title,
      subtitle: task.subtitle,
      timeLabel: task.time,
      durationLabel: task.duration,
      impactLabel: task.impact,
      completed: task.completed,
      colorClass: task.color,
      iconName: 'clients',
    }))
  }, [contextTasks, items])

  const usingContextAgenda = !items || !items.length

  const completedCount = composedItems.filter((item) => item.completed).length
  const totalCount = composedItems.length || 1
  const progressPct = Math.min(100, Math.round((completedCount / totalCount) * 100))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-purple-500/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-black">Today's Agenda</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{formatDateHeading()}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Progress</div>
            <div className="text-lg font-semibold text-black">
              {completedCount}/{totalCount} Complete
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {composedItems.map((item, index) => {
              const gradient = item.colorClass || fallbackColors[index % fallbackColors.length]
              const IconComponent = item.iconName ? iconLookup[item.iconName] || Sparkles : Sparkles
              return (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border-2 bg-white p-5 transition-all duration-200 hover:shadow-md ${
                    item.completed ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-100 hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex flex-shrink-0 flex-col items-center">
                      <div
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
                          item.completed ? 'bg-green-100' : `bg-gradient-to-br ${gradient}`
                        }`}
                      >
                        {item.completed ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <span className="text-sm font-bold text-white">{index + 1}</span>
                        )}
                      </div>
                      {index < composedItems.length - 1 ? <div className="mt-2 h-8 w-px bg-gray-200" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center space-x-2 text-sm text-muted-foreground">
                        {item.timeLabel ? (
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">{item.timeLabel}</span>
                          </div>
                        ) : null}
                        {item.durationLabel ? (
                          <>
                            <span>•</span>
                            <span>{item.durationLabel}</span>
                          </>
                        ) : null}
                        {item.impactLabel ? (
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-primary/10 to-purple-500/10 text-xs text-primary"
                          >
                            {item.impactLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mb-3">
                        <h4
                          className={`mb-1 font-semibold text-black ${
                            item.completed ? 'text-gray-500 line-through' : ''
                          }`}
                        >
                          {item.title}
                        </h4>
                        {item.subtitle ? (
                          <p
                            className={`text-sm text-muted-foreground ${
                              item.completed ? 'line-through' : ''
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`rounded-lg p-2 ${item.completed ? 'bg-gray-100' : `bg-gradient-to-br ${gradient} opacity-10`}`}>
                          <IconComponent className={`h-4 w-4 ${item.completed ? 'text-gray-400' : 'text-gray-700'}`} />
                        </div>
                        {usingContextAgenda ? (
                          <Button
                            variant={item.completed ? 'outline' : 'default'}
                            size="sm"
                            className={
                              item.completed
                                ? 'text-gray-500 hover:text-gray-700'
                                : 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-md hover:from-primary/90 hover:to-purple-500/90'
                            }
                            onClick={() => toggleTaskCompletion(Number(item.id))}
                          >
                            {item.completed ? 'Completed ✓' : 'Mark Complete'}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary text-primary hover:bg-primary/5"
                            onClick={onViewFullAgenda}
                          >
                            View task
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {!composedItems.length && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No tasks queued yet. Once cadences are scheduled, they will appear here.
              </div>
            )}
          </div>
        )}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              {completedCount === totalCount
                ? '🎉 Amazing! You have cleared today\'s agenda.'
                : `${totalCount - completedCount} high-impact task${totalCount - completedCount === 1 ? '' : 's'} remaining to boost your business today.`}
            </p>
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5"
              onClick={onViewFullAgenda}
            >
              View Full Agenda
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
