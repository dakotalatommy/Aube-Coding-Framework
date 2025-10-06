import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Bell, Calendar, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import { api, getTenant } from '../../lib/api'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Separator } from './ui/separator'

export type NotificationType = 'task' | 'appointment' | 'inventory' | 'general'
export type NotificationPriority = 'High' | 'Medium' | 'Low'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  subtitle: string
  time?: string | null
  dueTs?: number | null
  priority: NotificationPriority
  urgent: boolean
  completed?: boolean
  status?: string
  link?: string
  pane?: string
}

const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
}

export interface NotificationDropdownProps {
  onViewAgenda?: (notification?: NotificationItem) => void
}

const formatRelativeLabel = (dueTs?: number | null, createdTs?: number | null) => {
  const sourceTs = dueTs ?? createdTs
  if (!sourceTs) return null
  const target = new Date(sourceTs * 1000)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  const sameDay = target.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = target.toDateString() === tomorrow.toDateString()
  const timeLabel = target.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (sameDay) return `Today ${timeLabel}`
  if (isTomorrow) return `Tomorrow ${timeLabel}`
  return target.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const iconForNotification = (item: NotificationItem) => {
  if (item.urgent) return AlertCircle
  if (item.type === 'appointment') return Calendar
  return Clock
}

const priorityTone = (priority: NotificationPriority, urgent: boolean) => {
  if (urgent) return 'bg-red-500'
  switch (priority) {
    case 'High':
      return 'bg-red-400'
    case 'Medium':
      return 'bg-yellow-400'
    case 'Low':
    default:
      return 'bg-green-400'
  }
}

export function NotificationDropdown({ onViewAgenda }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  const loadNotifications = useCallback(async () => {
    const tenantId = await getTenant()
    if (!tenantId) return

    const response = await api.get(`/notifications?limit=12`, {
      timeoutMs: 10_000,
    })

    const items = Array.isArray(response?.items) ? response.items : []
    const mapped: NotificationItem[] = items.map((item: any) => {
      const priority = (item?.priority ?? 'Medium') as NotificationPriority
      return {
        id: String(item?.id ?? Math.random().toString(36).slice(2)),
        type: (item?.type ?? 'general') as NotificationType,
        title: String(item?.title ?? 'Notification'),
        subtitle: String(item?.subtitle ?? 'Tap to view details'),
        time: item?.time_label || formatRelativeLabel(item?.due_ts, item?.created_ts),
        dueTs: typeof item?.due_ts === 'number' ? item.due_ts : null,
        priority,
        urgent: Boolean(item?.urgent) || priority === 'High',
        completed: Boolean(item?.completed),
        status: item?.status ? String(item.status) : undefined,
        link: item?.link ? String(item.link) : undefined,
        pane: item?.pane ? String(item.pane) : undefined,
      }
    })

    mapped.sort((a, b) => {
      if (a.urgent && !b.urgent) return -1
      if (!a.urgent && b.urgent) return 1
      return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
    })

    const limited = mapped.slice(0, 6)
    setNotifications(limited)
    setUnreadCount(limited.filter((item) => item.urgent || item.priority === 'High').length)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      try {
        await loadNotifications()
      } catch (error) {
        console.warn('Failed to load notifications', error)
      }
    }

    load()
    const interval = window.setInterval(load, 120000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [loadNotifications])

  const pendingCount = useMemo(() => notifications.filter((n) => !n.completed).length, [notifications])

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      setIsOpen(false)
      if (notification.pane) {
        window.dispatchEvent(
          new CustomEvent('bvx:navigate', {
            detail: { pane: notification.pane, search: notification.subtitle, source: 'notification-dropdown' },
          }),
        )
      } else if (notification.link) {
        window.location.assign(notification.link)
      }
      onViewAgenda?.(notification)
    },
    [onViewAgenda],
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-primary/10">
          <Bell className="h-5 w-5 text-black" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-2 border-primary/20">
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Notifications
            </h3>
            <Badge variant="secondary" className="text-xs">
              {pendingCount} pending
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            High-priority follow-ups and urgent client tasks appear here.
          </p>
        </div>
        <Separator className="my-2" />
        <Card className="border-none shadow-none">
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-sm text-muted-foreground">
                <CheckCircle className="mb-2 h-5 w-5 text-emerald-500" />
                All caught up!
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = iconForNotification(notification)
                return (
                  <button
                    type="button"
                    key={notification.id}
                    className="flex w-full items-start gap-3 rounded-lg border border-transparent p-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span
                      className={`mt-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white ${priorityTone(notification.priority, notification.urgent)}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                        {notification.time && (
                          <span className="text-xs text-muted-foreground">{notification.time}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{notification.subtitle}</p>
                      {notification.status && (
                        <span className="inline-flex text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {notification.status}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
