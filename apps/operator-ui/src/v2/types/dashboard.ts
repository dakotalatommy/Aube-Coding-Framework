export interface DashboardAgendaItem {
  id: string
  title: string
  subtitle?: string
  timeLabel?: string
  durationLabel?: string
  impactLabel?: string
  priority?: 'High' | 'Medium' | 'Low'
  completed?: boolean
  colorClass?: string
  iconName?: 'clients' | 'revenue' | 'retention' | 'automation'
  todoId?: string
}

export interface DashboardClientPreviewItem {
  id: string
  name: string
  totalSpentCents: number
  visitCount: number
  lastVisitTs?: number | null
  status?: 'VIP' | 'New' | 'Regular'
  emailHash?: string | null
  phoneHash?: string | null
}

export interface DashboardReminderItem {
  id: string
  title: string
  description?: string
  clientName?: string
  actionLabel?: string
  dueTs?: number | null
  urgency?: 'high' | 'medium' | 'low'
  type?: 'birthday' | 'anniversary' | 'holiday' | 'follow-up'
}

export interface DashboardReferralInfo {
  shareUrl: string
  qrUrl?: string
  code?: string
  monthlySavingsCents?: number
  referralCount?: number
}
