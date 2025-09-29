export interface AgendaTaskItem {
  id: string
  title: string
  subtitle?: string
  startTs?: number | null
  endTs?: number | null
  durationLabel?: string
  impactLabel?: string
  priority?: 'High' | 'Medium' | 'Low'
  completed?: boolean
  type?: string
  iconName?: string
  colorClass?: string
  todoId?: string | number
}

export interface AgendaEventItem {
  id: string
  title: string
  description?: string
  startTs: number
  endTs?: number | null
  clientName?: string
  serviceName?: string
  status?: string
  revenueCents?: number | null
  provider?: string | null
}

export interface AgendaDayBundle {
  dateKey: string
  events: AgendaEventItem[]
  tasks: AgendaTaskItem[]
  reminders: AgendaReminderItem[]
}

export interface AgendaReminderItem {
  id: string
  title: string
  description?: string
  dueTs?: number | null
  urgency?: 'high' | 'medium' | 'low'
  type?: string
  clientName?: string
  actionLabel?: string
}

export interface AgendaSyncMeta {
  lastSyncByProvider: Record<string, { status?: string; ts?: number | null }>
}
