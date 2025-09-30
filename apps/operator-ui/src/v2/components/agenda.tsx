import { useCallback, useEffect, useMemo, useState } from 'react'
import { 
  Bell,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock, 
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { api, getTenant } from '../../lib/api'
import * as Sentry from '@sentry/react'
import { formatRelativeTime } from '../lib/formatters'
import type { AgendaEventItem, AgendaReminderItem, AgendaTaskItem, AgendaDayBundle } from './types/agenda'
import type { DashboardAgendaItem, DashboardReminderItem } from '../types/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Calendar } from './ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { getTypeIcon, getUrgencyColor } from './client-reminders-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Skeleton } from './ui/skeleton'
import { cn } from './ui/utils'

interface CalendarResponse {
  events?: Array<{
    id: string
    title: string
    start_ts: number
    end_ts?: number | null
    provider?: string | null
    status?: string
    revenue_cents?: number | null
    description?: string | null
    client_name?: string | null
    service_name?: string | null
  }>
  last_sync?: Record<string, { status?: string; ts?: number | null }>
}

interface DashboardAgendaResponse {
  agenda?: DashboardAgendaItem[]
  queue?: DashboardReminderItem[]
}

const mapEvents = (items: CalendarResponse['events'] = []): AgendaEventItem[] =>
  items.map((item) => ({
    id: String(item.id ?? crypto.randomUUID()),
    title: item.title ?? 'Booking',
    description: item.description ?? undefined,
    startTs: item.start_ts ?? 0,
    endTs: item.end_ts ?? null,
    provider: item.provider ?? null,
    status: item.status ?? 'confirmed',
    revenueCents: item.revenue_cents ?? null,
    clientName: item.client_name ?? undefined,
    serviceName: item.service_name ?? undefined,
  }))

const mapAgendaTasks = (items: DashboardAgendaItem[] = []): AgendaTaskItem[] =>
  items.map((item, index) => ({
    id: item.id ?? `task-${index}`,
    title: item.title,
    subtitle: item.subtitle,
    durationLabel: item.durationLabel,
    impactLabel: item.impactLabel,
    priority: item.iconName === 'clients' ? 'High' : 'Medium',
    completed: item.completed,
    type: item.iconName,
    iconName: item.iconName,
    colorClass: item.colorClass,
    todoId: item.todoId,
  }))

const mapReminders = (items: DashboardReminderItem[] = []): AgendaReminderItem[] =>
  items.map((item, index) => ({
    id: item.id ?? `reminder-${index}`,
    title: item.title,
    description: item.description,
    dueTs: item.dueTs,
    urgency: item.urgency,
    type: item.type,
    clientName: item.clientName,
    actionLabel: item.actionLabel,
  }))

const mergeBundles = (
  events: AgendaEventItem[],
  tasks: AgendaTaskItem[],
  reminders: AgendaReminderItem[],
): Record<string, AgendaDayBundle> => {
  const bundles: Record<string, AgendaDayBundle> = {}
  const ensureBundle = (dateKey: string) => {
    if (!bundles[dateKey]) {
      bundles[dateKey] = { dateKey, events: [], tasks: [], reminders: [] }
    }
    return bundles[dateKey]
  }

  events.forEach((event) => {
    const dateKey = new Date((event.startTs ?? 0) * 1000).toDateString()
    ensureBundle(dateKey).events.push(event)
  })

  const todayKey = new Date().toDateString()
  tasks.forEach((task) => {
    ensureBundle(todayKey).tasks.push(task)
  })

  reminders.forEach((reminder) => {
    const key = reminder.dueTs ? new Date(reminder.dueTs * 1000).toDateString() : todayKey
    ensureBundle(key).reminders.push(reminder)
  })

  return bundles
}

const formatTimeRange = (event: AgendaEventItem) => {
  if (!event.startTs) return '—'
  const start = new Date(event.startTs * 1000)
  const end = event.endTs ? new Date(event.endTs * 1000) : null
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const startLabel = start.toLocaleTimeString([], options)
  const endLabel = end ? end.toLocaleTimeString([], options) : null
  return endLabel ? `${startLabel} – ${endLabel}` : startLabel
}

const priorityTone = (priority?: AgendaTaskItem['priority']) => {
  switch (priority) {
    case 'High':
      return 'bg-rose-50 text-rose-700 border border-rose-200'
    case 'Medium':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'Low':
    default:
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  }
}

const statusTone = (status?: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'pending':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border border-rose-200'
    case 'completed':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    default:
      return 'bg-muted text-muted-foreground border border-muted'
  }
}

export function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AgendaEventItem[]>([])
  const [tasks, setTasks] = useState<AgendaTaskItem[]>([])
  const [reminders, setReminders] = useState<AgendaReminderItem[]>([])
  const [lastSync, setLastSync] = useState<Record<string, { status?: string; ts?: number | null }>>({})
  const [syncing, setSyncing] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [clearingReminderId, setClearingReminderId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [newTaskTime, setNewTaskTime] = useState('')

  const loadAgenda = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tenantId = await getTenant()
      if (!tenantId) {
        setEvents([])
        setTasks([])
        setReminders([])
        return
      }

      const [agendaResponse, calendarResponse] = await Promise.all([
        api.get(`/dashboard/agenda`, { timeoutMs: 10_000 }),
        api.get(
          `/calendar/list?start_ts=${Math.floor(Date.now() / 1000) - 7 * 86400}&end_ts=${Math.floor(Date.now() / 1000) + 21 * 86400}`,
          { timeoutMs: 12_000 },
        ),
      ])

      const agendaData = agendaResponse as DashboardAgendaResponse
      const calendarData = calendarResponse as CalendarResponse

      setEvents(mapEvents(calendarData.events))
      setTasks(mapAgendaTasks(agendaData.agenda))
      setReminders(mapReminders(agendaData.queue))
      setLastSync(calendarData.last_sync ?? {})
    } catch (err) {
      console.error('Agenda load failed', err)
      setError('We could not load your agenda right now. Try refreshing shortly.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCalendarSync = useCallback(
    async (provider: 'auto' | 'google' | 'apple' | 'square' | 'acuity' = 'auto') => {
      if (syncing) return
      setSyncing(true)
      try {
        const tenantId = await getTenant()
        if (!tenantId) throw new Error('Missing tenant context')
        await api.post('/calendar/sync', { tenant_id: tenantId, provider }, { timeoutMs: 20_000 })
        toast.success('Calendar sync queued')
        await loadAgenda()
      } catch (err) {
        console.error('Calendar sync failed', err)
        toast.error('Unable to launch sync right now')
      } finally {
        setSyncing(false)
      }
    },
    [loadAgenda, syncing],
  )

  const handleCompleteTask = useCallback(
    async (task: AgendaTaskItem) => {
      if (!task.todoId || task.completed) return
      try {
        const tenantId = await getTenant()
        if (!tenantId) throw new Error('Missing tenant context')
        setCompletingTaskId(task.id)
        await api.post('/todo/ack', { tenant_id: tenantId, id: task.todoId })
        toast.success('Task completed')
        await loadAgenda()
        window.dispatchEvent(new CustomEvent('bvx:navigate', { detail: { pane: 'agenda' } }))
      } catch (error) {
        console.error('Task completion failed', error)
        try { Sentry.addBreadcrumb({ category: 'agenda', level: 'error', message: 'Task completion failed', data: { error: String(error) } }) } catch {}
        toast.error('Unable to mark the task complete right now')
      } finally {
        setCompletingTaskId(null)
      }
    },
    [loadAgenda],
  )

  const handleCompleteReminder = useCallback(
    async (reminder: AgendaReminderItem) => {
      if (!reminder.id) return
      try {
        const tenantId = await getTenant()
        if (!tenantId) throw new Error('Missing tenant context')
        setClearingReminderId(reminder.id)
        await api.post('/todo/ack', { tenant_id: tenantId, id: reminder.id })
        toast.success('Reminder cleared')
        await loadAgenda()
        window.dispatchEvent(new CustomEvent('bvx:navigate', { detail: { pane: 'agenda' } }))
      } catch (error) {
        console.error('Reminder completion failed', error)
        try { Sentry.addBreadcrumb({ category: 'agenda', level: 'error', message: 'Reminder completion failed', data: { error: String(error) } }) } catch {}
        toast.error('Unable to clear the reminder right now')
      } finally {
        setClearingReminderId(null)
      }
    },
    [loadAgenda],
  )

  const handleCreateTask = useCallback(
    async () => {
      if (!newTaskTitle.trim()) {
        toast.error('Please enter a task title before saving.')
        return
      }
      try {
        setCreatingTask(true)
        const tenantId = await getTenant()
        if (!tenantId) throw new Error('Missing tenant context')
        await api.post(
          '/todo/create',
          {
            tenant_id: tenantId,
            title: newTaskTitle.trim(),
            description: newTaskDescription.trim() || undefined,
            priority: newTaskPriority,
            due_time: newTaskTime || undefined,
          },
          { timeoutMs: 10_000 },
        )
        toast.success('Task created')
        setNewTaskTitle('')
        setNewTaskDescription('')
        setNewTaskPriority('medium')
        setNewTaskTime('')
        setShowAddDialog(false)
        await loadAgenda()
        window.dispatchEvent(new CustomEvent('bvx:navigate', { detail: { pane: 'agenda' } }))
      } catch (error) {
        console.error('Task creation failed', error)
        try { Sentry.addBreadcrumb({ category: 'agenda', level: 'error', message: 'Task creation failed', data: { error: String(error) } }) } catch {}
        toast.error('Unable to create the task right now')
      } finally {
        setCreatingTask(false)
      }
    },
    [newTaskTitle, newTaskDescription, newTaskPriority, newTaskTime, loadAgenda],
  )

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

  const bundlesByDate = useMemo(() => mergeBundles(events, tasks, reminders), [events, tasks, reminders])
  const selectedKey = selectedDate?.toDateString() ?? new Date().toDateString()
  const selectedBundle = bundlesByDate[selectedKey] ?? {
    dateKey: selectedKey,
    events: [],
    tasks: [],
    reminders: [],
  }

  const todaysBundle = bundlesByDate[new Date().toDateString()]
  const completedCount = (todaysBundle?.tasks ?? []).filter((task) => task.completed).length
  const totalCount = todaysBundle?.tasks.length ?? 0
  const progressValue = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const upcomingEvents = events.filter((event) => (event.startTs ?? 0) * 1000 >= Date.now())
  const completedEvents = events.filter((event) => (event.startTs ?? 0) * 1000 < Date.now())

  const renderEventCard = (event: AgendaEventItem) => (
    <Card key={event.id} className="border border-muted/60 bg-card">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{event.title}</div>
            <div className="text-xs text-muted-foreground">
              {event.clientName ?? 'Client'} • {event.serviceName ?? 'Service'}
            </div>
          </div>
          <Badge className={cn('text-xs font-medium', statusTone(event.status))}>{event.status ?? 'open'}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatTimeRange(event)}
          </span>
          {event.revenueCents ? (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> ${Math.round((event.revenueCents ?? 0) / 100)}
            </span>
          ) : null}
          {event.provider ? (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {event.provider}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )

  const renderTaskCard = (task: AgendaTaskItem) => (
    <Card key={task.id} className="border border-muted/60 bg-card">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">{task.title}</div>
            {task.subtitle ? <div className="text-xs text-muted-foreground">{task.subtitle}</div> : null}
          </div>
          <Badge className={cn('text-xs font-medium', priorityTone(task.priority))}>
            {task.priority ?? 'Medium'} priority
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            {task.durationLabel ? <span>{task.durationLabel}</span> : null}
            {task.impactLabel ? <span>• {task.impactLabel}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={task.completed ? 'default' : 'outline'}
              disabled={task.completed || completingTaskId === task.id}
              onClick={() => handleCompleteTask(task)}
            >
              {task.completed
                ? 'Completed'
                : completingTaskId === task.id
                ? 'Completing…'
                : 'Mark complete'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Task actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem disabled>Edit task</DropdownMenuItem>
                <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderReminderCard = (reminder: AgendaReminderItem) => {
    const Icon = getTypeIcon(reminder.type ?? 'follow-up')
    return (
      <Card key={reminder.id} className="border border-muted/60 bg-card">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-500">
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-foreground">{reminder.title}</div>
                <Badge className={cn('text-xs font-medium', getUrgencyColor(reminder.urgency ?? 'medium'))}>
                  {reminder.urgency ?? 'medium'}
                </Badge>
              </div>
              {reminder.description ? <div className="text-xs text-muted-foreground">{reminder.description}</div> : null}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                <span>
                  {reminder.dueTs ? formatRelativeTime(reminder.dueTs * 1000) : 'Anytime'} • {reminder.clientName ?? 'Client'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={clearingReminderId === reminder.id}
              onClick={() => handleCompleteReminder(reminder)}
            >
              {clearingReminderId === reminder.id
                ? 'Clearing…'
                : reminder.actionLabel ?? 'Mark done'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Stay ahead of bookings, VIP milestones, and marketing follow-ups in one unified timeline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select defaultValue="auto" onValueChange={(value) => handleCalendarSync(value as any)} disabled={syncing}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sync calendar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto detect</SelectItem>
              <SelectItem value="google">Google Calendar</SelectItem>
              <SelectItem value="apple">Apple Calendar</SelectItem>
              <SelectItem value="square">Square Appointments</SelectItem>
              <SelectItem value="acuity">Acuity Scheduling</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleCalendarSync('auto')} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Run sync'}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" /> New task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Task title" value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} />
                <Textarea placeholder="Description" value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="time" value={newTaskTime} onChange={(event) => setNewTaskTime(event.target.value)} />
                  <Select value={newTaskPriority} onValueChange={(value) => setNewTaskPriority(value as 'high' | 'medium' | 'low')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTask} disabled={creatingTask}>
                    {creatingTask ? 'Saving…' : 'Add task'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border border-muted">
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-xl border bg-card"
              modifiers={{ busy: (date) => Boolean(bundlesByDate[date.toDateString()]) }}
              modifiersClassNames={{ busy: 'bg-primary/10 text-primary rounded-full' }}
            />
            <div className="rounded-xl border bg-card/70 p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Last synced</div>
              <ul className="mt-2 space-y-1 text-xs">
                {Object.entries(lastSync).length === 0 ? (
                  <li>No sync runs yet</li>
                ) : (
                  Object.entries(lastSync).map(([provider, info]) => (
                    <li key={provider} className="flex items-center justify-between">
                      <span className="capitalize">{provider}</span>
                      <span>{info.ts ? formatRelativeTime((info.ts ?? 0) * 1000) : '—'}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {selectedDate
                      ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                      : 'Select a day'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedBundle.events.length} appointments · {selectedBundle.tasks.length} tasks · {selectedBundle.reminders.length} reminders
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  Daily progress {completedCount}/{totalCount}
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${progressValue}%` }} />
                              </div>
                            </div>
                            
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <Card className="border border-destructive/40 bg-destructive/10">
                <CardContent className="py-6 text-center text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upcoming' | 'completed')}>
                <TabsList className="grid w-full grid-cols-2 md:w-96">
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
                <TabsContent value="upcoming" className="space-y-4">
                  {selectedBundle.events.map((event) => renderEventCard(event))}
                  {selectedBundle.tasks.filter((task) => !task.completed).map((task) => renderTaskCard(task))}
                  {selectedBundle.reminders.map((reminder) => renderReminderCard(reminder))}
                  {selectedBundle.events.length === 0 &&
                  selectedBundle.tasks.filter((task) => !task.completed).length === 0 &&
                  selectedBundle.reminders.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
                      No upcoming items for this day.
                    </div>
                  ) : null}
                </TabsContent>
                <TabsContent value="completed" className="space-y-4">
                  {selectedBundle.tasks.filter((task) => task.completed).length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
                      No completed tasks yet. Knock out a follow-up and we’ll mark it here.
                    </div>
                  ) : (
                    selectedBundle.tasks
                      .filter((task) => task.completed)
                      .map((task) => (
                        <Card key={task.id} className="border border-muted/60 bg-emerald-50/60">
                          <CardContent className="flex items-center justify-between p-4 text-sm">
                            <div>
                              <div className="font-medium text-emerald-800">{task.title}</div>
                              <div className="text-xs text-emerald-700">Completed recently</div>
                            </div>
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
              </CardContent>
            </Card>
                      ))
                  )}
                </TabsContent>
              </Tabs>
            )}
              </div>
            </CardContent>
          </Card>

      <Card className="border border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-primary" />
            <span>Today’s follow-ups</span>
              </CardTitle>
            </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(bundlesByDate[new Date().toDateString()]?.reminders ?? []).slice(0, 4).map((reminder) => (
            <div key={reminder.id} className="rounded-xl border bg-card/70 p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{reminder.title}</div>
                  <div className="text-xs text-muted-foreground">{reminder.description ?? 'Queued follow-up'}</div>
                                  </div>
                                </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{reminder.clientName ?? 'Client'}</span>
                <Button size="sm" variant="outline">
                  {reminder.actionLabel ?? 'Mark done'}
                                    </Button>
                                  </div>
                                </div>
          ))}
          {(bundlesByDate[new Date().toDateString()]?.reminders ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No reminders for today.
                              </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Calendar summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid_cols-2">
          <div className="rounded-xl border bg-card/70 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming bookings</div>
            <div className="text-2xl font-semibold text-foreground">{upcomingEvents.length}</div>
            <div className="text-xs text-muted-foreground">Next two weeks</div>
                          </div>
          <div className="rounded-xl border bg-card/70 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Completed this week</div>
            <div className="text-2xl font-semibold text-foreground">{completedEvents.length}</div>
            <div className="text-xs text-muted-foreground">Keep momentum with quick follow-ups</div>
                </div>
            </CardContent>
          </Card>
    </div>
  )
}
