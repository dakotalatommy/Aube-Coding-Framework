import { Bell, Calendar, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { useClientReminders, getTypeIcon, getUrgencyColor } from './client-reminders-context'
import type { ClientReminder } from './client-reminders-context'
import type { DashboardReminderItem } from '../types/dashboard'

interface ClientRemindersProps {
  reminders?: DashboardReminderItem[] | null
  loading?: boolean
  onViewAll?: () => void
}

interface NormalizedReminder {
  id: string
  title: string
  description?: string
  urgency: 'high' | 'medium' | 'low'
  dueTs?: number | null
  clientLabel: string
  type: string
  actionLabel: string
}

const formatRelativeDate = (epoch?: number | null) => {
  if (!epoch) return 'Anytime'
  const date = new Date(epoch * 1000)
  const today = new Date()
  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`
  return date.toLocaleDateString()
}

const isDashboardReminder = (reminder: DashboardReminderItem | ClientReminder): reminder is DashboardReminderItem =>
  (reminder as DashboardReminderItem).title !== undefined && (reminder as DashboardReminderItem).id !== undefined

const normalizeReminder = (reminder: DashboardReminderItem | ClientReminder): NormalizedReminder => {
  if (isDashboardReminder(reminder)) {
    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description ?? undefined,
      urgency: (reminder.urgency ?? 'medium') as NormalizedReminder['urgency'],
      dueTs: reminder.dueTs ?? undefined,
      clientLabel: reminder.clientName ?? 'Client',
      type: reminder.type ?? 'follow-up',
      actionLabel: reminder.actionLabel ?? 'Open task',
    }
  }
  return {
    id: String(reminder.id),
    title: reminder.title,
    description: reminder.description,
    urgency: reminder.urgency,
    dueTs: reminder.date.getTime() / 1000,
    clientLabel: reminder.client,
    type: reminder.type,
    actionLabel: reminder.action,
  }
}

const renderAction = (
  reminder: NormalizedReminder,
  markReminderComplete: (id: number) => void,
  showViewAll: boolean,
  onViewAll?: () => void,
) => {
  if (!showViewAll) {
    return (
      <Button
        size="sm"
        className="bg-accent text-white"
        onClick={() => markReminderComplete(Number(reminder.id))}
      >
        {reminder.actionLabel}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="border-primary text-primary hover:bg-primary/5"
      onClick={onViewAll}
    >
      {reminder.actionLabel}
    </Button>
  )
}

export function ClientReminders({ reminders, loading = false, onViewAll }: ClientRemindersProps) {
  const { reminders: contextReminders, markReminderComplete } = useClientReminders()
  const items = reminders && reminders.length ? reminders.slice(0, 5) : contextReminders.slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2 text-black">
          <Bell className="h-5 w-5 text-primary" />
          <span>Important Client Reminders</span>
        </CardTitle>
        <Button variant="outline" size="sm" className="border-primary text-black" onClick={onViewAll}>
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-lg border border-dashed border-muted-foreground/20 bg-muted" />
            ))}
          </div>
        ) : items.length ? (
          <div className="space-y-4">
            {items.map((raw: DashboardReminderItem | ClientReminder) => {
              const reminder = normalizeReminder(raw)
              const IconComponent = getTypeIcon(reminder.type)
              return (
                <div
                  key={reminder.id}
                  className="flex items-center space-x-4 rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-500">
                    <IconComponent className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center space-x-2">
                      <h4 className="font-medium text-black">{reminder.title}</h4>
                      <Badge variant="outline" className={`text-xs ${getUrgencyColor(reminder.urgency)}`}>
                        {reminder.urgency}
                      </Badge>
                    </div>
                    {reminder.description ? (
                      <p className="mb-2 text-sm text-gray-600">{reminder.description}</p>
                    ) : null}
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatRelativeDate(reminder.dueTs)}</span>
                      </div>
                      <span>•</span>
                      <span>{reminder.clientLabel}</span>
                    </div>
                  </div>
                  {renderAction(
                    reminder,
                    markReminderComplete,
                    Boolean(reminders && reminders.length),
                    onViewAll,
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            <p>No reminders queued. Scheduled tasks will appear here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
