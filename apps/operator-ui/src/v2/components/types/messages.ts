export type MessageFilter = 'all' | 'unread' | 'needs_reply' | 'scheduled' | 'failed'

export interface MessageHistoryItem {
  id: number | string
  contactId: string
  channel: string
  direction: string
  status: string
  templateId?: string | null
  timestamp: number
  metadata?: string | null
}

export interface InboxMessageItem {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  createdAt: Date
}

export interface ConversationContact {
  id: string
  name: string
  phone?: string
  email?: string
  lastService?: string
  totalVisits?: number
  totalSpentCents?: number
  tags?: string[]
}

export interface Conversation {
  id: string
  contact: ConversationContact
  messages: InboxMessageItem[]
  lastMessagePreview: string
  lastMessageTime: Date
  unreadCount: number
  pinned?: boolean
}

export interface FollowupCandidate {
  contactId: string
  reason?: string
}

export interface FollowupBundle {
  ids: string[]
  bucket: string
  scope?: string
  templateLabel?: string
  markdown?: string
  jobId?: string
  todoId?: number
  ts: number
}

export interface FollowupDraftResult {
  status: 'ready' | 'queued' | 'running' | 'pending' | 'empty' | 'error' | 'invalid_template'
  count?: number
  draftMarkdown?: string
  details?: {
    contact_ids?: string[]
    template_label?: string
    draft_status?: string
    job_id?: string
  }
  job_id?: string
  todo_id?: number
  detail?: string
}

export interface TemplateOption {
  id: string
  label: string
  description?: string
  cadenceId?: string
}

export interface QuietHoursSettings {
  start?: string
  end?: string
}
