import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList,
  Copy,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

import { api, getTenant } from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import type {
  ConversationContact,
  FollowupBundle,
  MessageFilter,
  MessageHistoryItem,
  QuietHoursSettings,
} from './types/messages'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { ScrollArea } from './ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Table, TableBody as TBody, TableCell as TD, TableHead as TH, TableHeader as THead, TableRow as TR } from './ui/table'

const CONTACT_FETCH_LIMIT = 500
const HISTORY_LIMIT = 200

const PROMPT_REGISTRY = [
  {
    id: 'lead_followup',
    label: 'Lead • Follow-up',
    promptId: 'BVX_lead_nurture_v1',
    cadenceId: 'lead_followup',
    preview: "Hi {{name}}! I saw you were looking at {{service}}. I'd love to answer any questions or get you scheduled. What day works best?",
    guardrails: ['Keep it under 320 characters', 'Name the service they asked about', 'End with a question that prompts a reply'],
  },
  {
    id: 'reminder_24h',
    label: 'Reminder • 24h before',
    promptId: 'BVX_reminder_24h',
    cadenceId: 'reminder',
    preview: 'Hey {{name}} — we are excited to see you tomorrow at {{time}}. Need to change it? Tap the booking link and we will take care of it for you.',
    guardrails: ['Confirm date/time plainly', 'Offer reschedule help', 'Mention STOP/HELP compliance'],
  },
  {
    id: 'waitlist_open',
    label: 'Waitlist • Open slot',
    promptId: 'BVX_waitlist_slot',
    cadenceId: 'reminder_week',
    preview: 'A spot opened for {{service}} at {{time}}. Want it? Reply YES and I will lock it in or send the best alternatives.',
    guardrails: ['Highlight urgency kindly', 'Offer alternative options', 'Keep CTA short'],
  },
  {
    id: 'reengage_30d',
    label: 'Re-engage • 30 days',
    promptId: 'BVX_reengage_30d',
    cadenceId: 'reengage_30d',
    preview: "It has been a minute since your last visit, {{name}}. Would you like me to hold a chair next week? We would love to keep the glow going!",
    guardrails: ['Celebrate their return', 'Offer specific scheduling help', 'One CTA question'],
  },
  {
    id: 'winback_45d',
    label: 'Win-back • 45+ days',
    promptId: 'BVX_winback_45d',
    cadenceId: 'winback_45d_plus',
    preview: 'I would love to see you again, {{name}}! Reply with a day that works and consider it reserved. I have an opening later this week.',
    guardrails: ['Lead with appreciation', 'Offer limited-time perk', 'Invite an easy reply'],
  },
  {
    id: 'no_show_followup',
    label: 'No-show • Follow-up',
    promptId: 'BVX_no_show_followup',
    cadenceId: 'no_show_followup',
    preview: 'Life happens, {{name}}—shall I find a new time for you? I have flexibility over the next few days and can hold something easy.',
    guardrails: ['Start with empathy', 'Offer 2–3 new slots', 'Mention STOP/HELP compliance'],
  },
  {
    id: 'first_time_nurture',
    label: 'First-time • Nurture',
    promptId: 'BVX_first_time_nurture',
    cadenceId: 'first_time_nurture',
    preview: 'Welcome to the studio, {{name}}! Here is 20% off your next visit within 30 days. Want me to reserve your next experience?',
    guardrails: ['Celebrate their first visit', 'Include a time-bound perk', 'Offer concierge-level booking help'],
  },
 ] as const

type PromptTemplate = (typeof PROMPT_REGISTRY)[number]
type ComposeTemplateId = PromptTemplate['id']

const PROMPT_MAP = new Map<ComposeTemplateId, PromptTemplate>(PROMPT_REGISTRY.map((item) => [item.id, item]))

const MESSAGE_FILTERS: Array<{ id: MessageFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'needs_reply', label: 'Needs Reply' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'failed', label: 'Failed' },
]

type SendMode = 'draft' | 'now'

type HistoryRow = MessageHistoryItem & {
  contactName: string
  contactPhone?: string
  timestampLabel: string
}

const DEFAULT_TEMPLATE_TEXT: Record<ComposeTemplateId, string> = {
  reminder_24h:
    'Hey {{name}} — we are excited to see you tomorrow at {{time}}. Need to change it? Tap the booking link and we will take care of it for you.',
  waitlist_open:
    'A spot opened for {{service}} at {{time}}. Want it? Reply YES and I will lock it in or send the best alternatives.',
  lead_followup:
    "Hi {{name}}! I saw you were looking at {{service}}. I'd love to answer any questions or get you scheduled. What day works best?",
  reengage_30d:
    "It has been a minute since your last visit, {{name}}. Would you like me to hold a chair next week? We would love to keep the glow going!",
  winback_45d:
    'I would love to see you again, {{name}}! Reply with a day that works and consider it reserved. I have an opening later this week.',
  no_show_followup:
    'Life happens, {{name}}—shall I find a new time for you? I have flexibility over the next few days and can hold something easy.',
  first_time_nurture:
    'Welcome to the studio, {{name}}! Here is 20% off your next visit within 30 days. Want me to reserve your next experience?',
}

const formatTimestamp = (epoch?: number | null) => {
  if (!epoch) return '—'
  try {
    const date = new Date(Number(epoch) * 1000)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return String(epoch)
  }
}

const formatPhone = (value?: string | null) => {
  if (!value) return undefined
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}

const ensureTenant = async (cacheRef: React.MutableRefObject<string | null>) => {
  if (cacheRef.current) return cacheRef.current
  const tid = await getTenant()
  if (!tid) throw new Error('Missing tenant context')
  cacheRef.current = tid
  return tid
}

export function Messages() {
  const tenantRef = useRef<string | null>(null)

  const [historyFilter, setHistoryFilter] = useState<MessageFilter>('all')
  const [historyItems, setHistoryItems] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [contacts, setContacts] = useState<ConversationContact[]>([])
  const [contactQuery, setContactQuery] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<ConversationContact[]>([])

  const [templateId, setTemplateId] = useState<ComposeTemplateId>('lead_followup')
  const activeTemplate = PROMPT_MAP.get(templateId)
  const draftStorageKey = 'bvx_messages_draft'
  const [messageBody, setMessageBody] = useState(() => {
    try {
      const cached = sessionStorage.getItem(draftStorageKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { templateId?: ComposeTemplateId; body?: string }
        if (parsed.templateId && PROMPT_MAP.has(parsed.templateId)) {
          return parsed.body ?? activeTemplate?.preview ?? ''
        }
      }
    } catch {
      // ignore
    }
    return activeTemplate?.preview || ''
  })
  const [lastAutoBody, setLastAutoBody] = useState(activeTemplate?.preview || '')
  const [sendMode, setSendMode] = useState<SendMode>('draft')
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftDownloadUrl, setDraftDownloadUrl] = useState<string>('')
  const [draftStatus, setDraftStatus] = useState<string>('')
  const [, setDraftJobId] = useState<string | null>(null)
  const [, setDraftTodoId] = useState<number | null>(null)
  const [, setDraftContacts] = useState<string[]>([])
  const [sendingMode, setSendingMode] = useState<'idle' | 'sending' | 'queued'>('idle')

  const [quietHours, setQuietHours] = useState<QuietHoursSettings>({})
  const [savingQuietHours, setSavingQuietHours] = useState(false)

  const [twilioStatusError, setTwilioStatusError] = useState<string | null>(null)

  const pendingBundleRef = useRef<FollowupBundle | null>(null)
  const bundleAppliedRef = useRef(false)
  const followupStatusErrorNotifiedRef = useRef(false)

  const contactsById = useMemo(() => {
    const map = new Map<string, ConversationContact>()
    contacts.forEach((contact) => map.set(contact.id, contact))
    return map
  }, [contacts])

  const filteredSuggestions = useMemo(() => {
    const query = contactQuery.trim().toLowerCase()
    if (!query) return contacts.slice(0, 8)
    return contacts
      .filter((contact) => contact.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [contactQuery, contacts])

  const loadContacts = useCallback(async () => {
    try {
      const tenantId = await ensureTenant(tenantRef)
      const response = await api.get(
        `/contacts/list?tenant_id=${encodeURIComponent(tenantId)}&limit=${CONTACT_FETCH_LIMIT}&offset=0`,
      )
      const items = Array.isArray(response?.items) ? response.items : []
      const mapped: ConversationContact[] = items.map((item: any) => ({
        id: String(item.contact_id || item.id || ''),
        name:
          String(item.friendly_name || item.display_name || `${item.first_name || ''} ${item.last_name || ''}` || 'Client')
            .trim() || 'Client',
        phone: item.phone_number ? String(item.phone_number) : undefined,
        email: item.email ? String(item.email) : undefined,
        lastService: item.last_service ? String(item.last_service) : undefined,
        totalVisits: typeof item.txn_count === 'number' ? item.txn_count : undefined,
        totalSpentCents: typeof item.lifetime_cents === 'number' ? item.lifetime_cents : undefined,
        tags: item.tags && Array.isArray(item.tags) ? item.tags.map((tag: any) => String(tag)) : undefined,
      }))
      setContacts(mapped)
    } catch (error) {
      console.error('Failed to load contacts', error)
      toast.error('Unable to load contacts right now')
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({ templateId, body: messageBody }),
      )
    } catch {
      // ignore storage issues
    }
  }, [messageBody, templateId])

  const loadQuietHours = useCallback(async () => {
    try {
      const tenantId = await ensureTenant(tenantRef)
      const response = await api.get(`/settings?tenant_id=${encodeURIComponent(tenantId)}`)
      const quiet = response?.data?.quiet_hours || {}
      setQuietHours({
        start: typeof quiet.start === 'string' ? quiet.start : undefined,
        end: typeof quiet.end === 'string' ? quiet.end : undefined,
      })
    } catch (error) {
      console.error('Failed to load quiet hours', error)
      toast.error('Unable to load quiet hours right now')
    }
  }, [])

  const loadTwilioStatus = useCallback(async () => {
    try {
      setTwilioStatusError(null)
      const tenantId = await ensureTenant(tenantRef)
      await api.get(`/integrations/status?tenant_id=${encodeURIComponent(tenantId)}`)
    } catch (error) {
      console.error('Failed to load Twilio status', error)
      setTwilioStatusError('Unable to verify Twilio status right now.')
      toast.error('Unable to verify messaging status right now')
    }
  }, [])

  const loadHistory = useCallback(
    async (filter: MessageFilter) => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const tenantId = await ensureTenant(tenantRef)
        const params = new URLSearchParams({ tenant_id: tenantId, limit: String(HISTORY_LIMIT) })
        if (filter !== 'all') params.set('filter', filter)
        const response = await api.get(`/messages/list?${params.toString()}`)
        const items = Array.isArray(response?.items) ? response.items : []
        const mapped: HistoryRow[] = items.map((item: any) => {
          const contact = contactsById.get(String(item.contact_id || ''))
          return {
            id: item.id,
            contactId: String(item.contact_id || ''),
            channel: String(item.channel || 'sms'),
            direction: String(item.direction || 'outbound'),
            status: String(item.status || ''),
            templateId: item.template_id ? String(item.template_id) : null,
            timestamp: Number(item.ts || 0),
            metadata:
              typeof item.metadata === 'string'
                ? item.metadata
                : item.metadata
                ? JSON.stringify(item.metadata)
                : null,
            contactName: contact?.name || String(item.contact_id || ''),
            contactPhone: contact?.phone ? formatPhone(contact.phone) : undefined,
            timestampLabel: formatTimestamp(item.ts),
          }
        })
        setHistoryItems(mapped)
        followupStatusErrorNotifiedRef.current = false
      } catch (error) {
        console.error('Failed to load message history', error)
        setHistoryError('Unable to load messages right now.')
        toast.error('Unable to load messages right now')
      } finally {
        setHistoryLoading(false)
      }
    },
    [contactsById],
  )

  useEffect(() => {
    loadContacts()
    loadQuietHours()
    loadTwilioStatus()
  }, [loadContacts, loadQuietHours, loadTwilioStatus])

  useEffect(() => {
    loadHistory(historyFilter)
  }, [historyFilter, loadHistory])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('bvx_followups_bundle')
      if (raw) {
        sessionStorage.removeItem('bvx_followups_bundle')
        const bundle = JSON.parse(raw) as FollowupBundle
        pendingBundleRef.current = bundle
      }
    } catch (error) {
      console.warn('Unable to load follow-up bundle', error)
    }
  }, [])

  useEffect(() => {
    const bundle = pendingBundleRef.current
    if (!bundle || !contacts.length) return
    pendingBundleRef.current = null

    if (bundle.bucket && PROMPT_REGISTRY.some((option) => option.id === bundle.bucket)) {
      setTemplateId(bundle.bucket as ComposeTemplateId)
      setLastAutoBody(activeTemplate?.preview || DEFAULT_TEMPLATE_TEXT[bundle.bucket as ComposeTemplateId])
    }
    if (bundle.markdown) {
      setMessageBody(bundle.markdown)
      setLastAutoBody(bundle.markdown)
    }
    if (Array.isArray(bundle.ids) && bundle.ids.length) {
      const matches = bundle.ids
        .map((id) => contactsById.get(id))
        .filter((contact): contact is ConversationContact => Boolean(contact))
      if (matches.length) {
        setSelectedContacts(matches)
        bundleAppliedRef.current = true
      }
    }
  }, [contacts, contactsById, activeTemplate])

  useEffect(() => {
    if (bundleAppliedRef.current) return
    const template = PROMPT_MAP.get(templateId)
    const preview = template?.preview
    if (preview && (messageBody.trim().length === 0 || messageBody === lastAutoBody)) {
      setMessageBody(preview)
      setLastAutoBody(preview)
    }
  }, [templateId, messageBody, lastAutoBody])

  const handleAddRecipient = (contact: ConversationContact) => {
    setSelectedContacts((prev) => {
      if (prev.some((existing) => existing.id === contact.id)) return prev
      return [...prev, contact]
    })
    setContactQuery('')
  }

  const handleRemoveRecipient = (contactId: string) => {
    setSelectedContacts((prev) => prev.filter((contact) => contact.id !== contactId))
  }

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(messageBody || '')
      toast.success('Message copied to clipboard')
    } catch (error) {
      console.error('Copy failed', error)
      toast.error('Unable to copy right now')
    }
  }

  const buildPromptMessages = (template: PromptTemplate, people: ConversationContact[]) => {
    const clientLines = people.map((person) => {
      const name = person.name || 'client'
      const tags = Array.isArray(person.tags) && person.tags.length ? `Tags: ${person.tags.join(', ')}` : ''
      const lastVisit = person.totalVisits ? `${person.totalVisits} visits recorded` : ''
      return `- ${name}${lastVisit ? ` (${lastVisit})` : ''}${tags ? ` | ${tags}` : ''}`
    })

    return [
      {
        role: 'system',
        content: 'You are BrandVX, a concierge for beauty professionals. Tone: celebratory, direct, consent-first.',
      },
      {
        role: 'user',
        content: [
          `Prompt template: ${template.promptId}`,
          'Write one SMS per client in Markdown format (## Name).',
          'Keep each message under 320 characters, no placeholders like {{name}}—use the real name.',
          'Respect STOP/HELP compliance and consent context.',
          template.preview ? `Reference this sample tone: ${template.preview}` : '',
          '',
          'Client roster:',
          ...clientLines,
        ].join('\n'),
      },
    ]
  }

  const handleDraft = async () => {
    if (isDrafting) return
    const recipients = selectedContacts
    if (!recipients.length) {
      toast.error('Choose at least one client before drafting')
      return
    }

    try {
      setIsDrafting(true)
      setDraftStatus('Generating draft…')
      const tenantId = await ensureTenant(tenantRef)
      const templateMeta = PROMPT_MAP.get(templateId)
      const messagesPayload = templateMeta ? buildPromptMessages(templateMeta, recipients) : []

      trackEvent('messages.draft', { bucket: templateId, count: recipients.length })

      let markdown = ''
      if (messagesPayload.length) {
        try {
          const response = await api.post(
            '/ai/chat/raw',
            {
              tenant_id: tenantId,
              messages: messagesPayload,
              mode: 'messages',
              metadata: {
                feature: 'messages.workspace',
                template_id: templateId,
              },
            },
            { timeoutMs: 60_000 },
          )
          markdown = String(response?.text || response?.choices?.[0]?.message?.content || '').trim()
        } catch (error) {
          console.warn('Responses API draft failed, falling back to template preview', error)
        }
      }

      if (!markdown) {
        const fallbackCopy = templateMeta?.preview
        if (fallbackCopy) {
          setMessageBody(fallbackCopy)
          setLastAutoBody(fallbackCopy)
        }
        setDraftStatus('Draft service unavailable — using template preview copy for now')
        toast.error('Draft unavailable', { description: 'Using saved template copy until the assistant responds.' })
        return
      }

      setMessageBody(markdown)
      setLastAutoBody(markdown)
      setDraftStatus('Draft ready — copied to editor')
      try {
        if (draftDownloadUrl) URL.revokeObjectURL(draftDownloadUrl)
      } catch {}
      try {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        setDraftDownloadUrl(url)
      } catch {}

      try {
        await navigator.clipboard.writeText(markdown)
        toast.success('Markdown copied to clipboard')
      } catch {}
    } catch (error) {
      console.error('Draft failed', error)
      toast.error('Unable to create draft right now')
      setDraftStatus('Draft failed')
    } finally {
      setIsDrafting(false)
    }
  }

  const pollFollowupStatus = useCallback(async () => {
    try {
      const tenantId = await ensureTenant(tenantRef)
      const res = await api.get(`/followups/draft_status?tenant_id=${encodeURIComponent(tenantId)}`)
      const details = res?.details || {}
      setDraftJobId(res?.job_id ? String(res.job_id) : null)
      setDraftTodoId(typeof res?.todo_id === 'number' ? res.todo_id : null)
      setDraftContacts(Array.isArray(details?.contact_ids) ? details.contact_ids.map((cid: any) => String(cid)) : [])
      const status = String(res?.status || 'pending')
      if (status === 'ready' && details?.draft_markdown) {
        setMessageBody(String(details.draft_markdown))
        setLastAutoBody(String(details.draft_markdown))
        setDraftStatus('Draft ready — copied to editor')
        toast.success('Follow-up drafts ready', {
          description: 'Open the notifications drawer to approve and send.',
        })
        followupStatusErrorNotifiedRef.current = false
      } else if (status === 'error') {
        setDraftStatus('Draft failed — check notifications for details')
        toast.error('Draft failed', { description: res?.detail || details?.error || 'See To-Do for more information.' })
        followupStatusErrorNotifiedRef.current = false
      } else if (status === 'queued' || status === 'running') {
        setDraftStatus('Draft running — we will notify you when ready')
        followupStatusErrorNotifiedRef.current = false
      }
    } catch (error) {
      console.warn('followups status poll failed', error)
      if (!followupStatusErrorNotifiedRef.current) {
        followupStatusErrorNotifiedRef.current = true
        toast.error('Unable to refresh follow-up status right now')
      }
    }
  }, [tenantRef])

  useEffect(() => {
    const handle = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void pollFollowupStatus()
      }
    }, 8000)
    return () => window.clearInterval(handle)
  }, [pollFollowupStatus])

  const handleSend = useCallback(async () => {
    if (!selectedContacts.length) {
      toast.error('Choose at least one client before sending')
      return
    }
    if (!messageBody.trim()) {
      toast.error('Draft is empty', { description: 'Generate or write a message before sending.' })
      return
    }

    try {
      setSendingMode('sending')
      const tenantId = await ensureTenant(tenantRef)
      const cadenceId = activeTemplate?.cadenceId || 'custom'

      if (sendMode === 'now' && selectedContacts.length === 1) {
        const target = selectedContacts[0]
        await api.post(
          '/messages/send',
          {
            tenant_id: tenantId,
            contact_id: target.id,
            channel: 'sms',
            template_id: templateId,
            body: messageBody,
          },
          { timeoutMs: 20_000 },
        )
        toast.success('Message sent', { description: 'Queued via messaging worker.' })
      } else {
        const payload = {
          tenant_id: tenantId,
          contact_ids: selectedContacts.map((contact) => contact.id),
          cadence_id: cadenceId,
          template_id: templateId,
          body: messageBody,
          send_immediately: sendMode === 'now',
        }
        await api.post('/followups/enqueue', payload, { timeoutMs: 20_000 })
        toast.success('Follow-ups scheduled', {
          description:
            selectedContacts.length === 1
              ? 'We will draft and send this follow-up shortly.'
              : `We will draft and send ${selectedContacts.length} follow-ups shortly.`,
        })
      }

      setSendingMode('idle')
      setMessageBody('')
      setSelectedContacts([])
      loadHistory(historyFilter)
      pollFollowupStatus()
    } catch (error) {
      console.error('Send failed', error)
      toast.error('Unable to send messages right now')
      setSendingMode('idle')
    }
  }, [activeTemplate?.cadenceId, historyFilter, loadHistory, messageBody, pollFollowupStatus, selectedContacts, sendMode, templateId])

  const handleSaveQuietHours = async () => {
    try {
      setSavingQuietHours(true)
      const tenantId = await ensureTenant(tenantRef)
      await api.post('/settings', {
        tenant_id: tenantId,
        quiet_hours: quietHours,
      })
      toast.success('Quiet hours saved')
    } catch (error) {
      console.error('Saving quiet hours failed', error)
      toast.error('Unable to save quiet hours right now')
    } finally {
      setSavingQuietHours(false)
    }
  }

  const renderComposeTab = () => {
    const activeTemplate = PROMPT_MAP.get(templateId)
  return (
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Compose</span>
            </CardTitle>
          <CardDescription>Generate ready-to-send SMS drafts for one or more clients.</CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Template</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{activeTemplate?.label || 'Template'}</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[320px] space-y-2">
                {PROMPT_REGISTRY.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => {
                      setTemplateId(option.id as ComposeTemplateId)
                      if (option.preview) {
                        setMessageBody(option.preview)
                        setLastAutoBody(option.preview)
                      }
                    }}
                    className="flex flex-col items-start space-y-1"
                  >
                    <span className="font-semibold text-sm text-slate-900">{option.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      {option.preview.replace(/\{\{name\}\}/g, 'Jess').slice(0, 96)}...
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>

                  <div className="space-y-3">
            <Label className="text-sm font-medium">Recipients</Label>
            <Input
              placeholder="Search clients"
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              onFocus={() => {
                if (!contacts.length) loadContacts()
              }}
            />
            {contactQuery && (
              <Card className="border-dashed">
                <CardContent className="p-2 space-y-1">
                  {filteredSuggestions.length ? (
                    filteredSuggestions.map((contact) => (
                      <Button
                        key={contact.id}
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleAddRecipient(contact)}
                      >
                        {contact.name}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No matches found</p>
                  )}
          </CardContent>
        </Card>
      )}
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedContacts.map((contact) => (
                  <Badge key={contact.id} className="flex items-center gap-1">
                    {contact.name}
                    <button
                      onClick={() => handleRemoveRecipient(contact.id)}
                      className="ml-1 text-muted-foreground hover:text-red-500"
                    >
                      ×
                    </button>
                </Badge>
                ))}
              </div>
            )}
                </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Message Body</Label>
            {activeTemplate?.guardrails && activeTemplate.guardrails.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                <div className="font-semibold mb-1">Draft checklist</div>
                <ul className="list-disc ml-4 space-y-1">
                  {activeTemplate.guardrails.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <Textarea
              placeholder="Write your message here..."
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              className="min-h-[150px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCopyDraft}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Draft
              </Button>
              <Button onClick={handleDraft} disabled={isDrafting}>
                {isDrafting ? (
                  <Loader2 className="h-4 w-4 mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isDrafting ? 'Drafting…' : 'Generate Draft'}
              </Button>
      <Button variant="outline" onClick={handleSend} disabled={sendingMode === 'sending'}>
        {sendingMode === 'sending' ? (
          <Loader2 className="h-4 w-4 mr-2" />
        ) : sendMode === 'now' && selectedContacts.length <= 1 ? (
          <Send className="h-4 w-4 mr-2" />
        ) : (
          <Clock className="h-4 w-4 mr-2" />
        )}
        {sendingMode === 'sending'
          ? 'Sending…'
          : sendMode === 'now' && selectedContacts.length <= 1
          ? 'Send Now'
          : 'Queue Follow-ups'}
      </Button>
            </div>
            {draftDownloadUrl && (
              <div className="mt-4">
                <a
                  href={draftDownloadUrl}
                  download="sms_drafts.md"
                  className="flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Download Drafts
                </a>
                    </div>
            )}
            {draftStatus && (
              <Alert className="border-primary/40 bg-primary/5 text-primary">
                <AlertTitle>Draft status</AlertTitle>
                <AlertDescription>{draftStatus}</AlertDescription>
              </Alert>
            )}
                  </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Send Mode</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSendMode('draft')} className={sendMode === 'draft' ? 'bg-primary text-white' : ''}>
                Draft
                </Button>
              <Button variant="outline" onClick={() => setSendMode('now')} className={sendMode === 'now' ? 'bg-primary text-white' : ''}>
                Send Now
                  </Button>
                </div>
            {sendMode === 'now' && (
              <div className="mt-4">
                <Alert className="border-amber-400/40 bg-amber-100 text-amber-800">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <AlertDescription>
                    Direct SMS sending is coming soon. Drafts are ready to copy today.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Quiet Hours</Label>
            <div className="flex items-center gap-2">
                  <Input
                type="time"
                value={quietHours.start || ''}
                onChange={(event) => setQuietHours((prev) => ({ ...prev, start: event.target.value }))}
                className="w-32"
              />
              <span>to</span>
              <Input
                type="time"
                value={quietHours.end || ''}
                onChange={(event) => setQuietHours((prev) => ({ ...prev, end: event.target.value }))}
                className="w-32"
              />
              <Button onClick={handleSaveQuietHours} disabled={savingQuietHours}>
                {savingQuietHours ? <Loader2 className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {savingQuietHours ? 'Saving...' : 'Save Quiet Hours'}
                </Button>
              </div>
            {twilioStatusError && (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertDescription>{twilioStatusError}</AlertDescription>
              </Alert>
                              )}
                            </div>
                </CardContent>
              </Card>
    )
  }

  const renderHistoryTab = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <Inbox className="h-5 w-5 text-primary" />
          <span>History</span>
        </CardTitle>
        <CardDescription>View and manage your message history.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="historyFilter" className="text-sm font-medium">
              Filter:
            </Label>
            <select
              id="historyFilter"
              value={historyFilter}
              onChange={(event) => setHistoryFilter(event.target.value as MessageFilter)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              {MESSAGE_FILTERS.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label}
                </option>
              ))}
            </select>
                        </div>
          <Button variant="outline" onClick={() => loadHistory(historyFilter)} disabled={historyLoading}>
            {historyLoading ? <Loader2 className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh History
                          </Button>
                      </div>

        {historyError && (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{historyError}</AlertDescription>
          </Alert>
        )}
        {historyLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                </div>
        ) : historyItems.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No messages found in this filter.</p>
                              </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)]">
            <Table>
              <THead>
                <TR>
                  <TH>Contact</TH>
                  <TH>Channel</TH>
                  <TH>Direction</TH>
                  <TH>Status</TH>
                  <TH>Template</TH>
                  <TH>Timestamp</TH>
                </TR>
              </THead>
              <TBody>
                {historyItems.map((item) => (
                  <TR key={item.id}>
                    <TD>{item.contactName}</TD>
                    <TD>{item.channel}</TD>
                    <TD>{item.direction}</TD>
                    <TD>{item.status}</TD>
                    <TD>
                      {item.templateId
                        ? PROMPT_REGISTRY.find((option) => option.id === item.templateId)?.label ?? 'Custom'
                        : 'N/A'}
                    </TD>
                    <TD>{item.timestampLabel}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
                      </ScrollArea>
        )}
                    </CardContent>
                  </Card>
  )

  return (
    <Tabs defaultValue="compose" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="compose">Compose</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="compose">
        {renderComposeTab()}
      </TabsContent>
      <TabsContent value="history">
        {renderHistoryTab()}
        </TabsContent>
      </Tabs>
  )
}
