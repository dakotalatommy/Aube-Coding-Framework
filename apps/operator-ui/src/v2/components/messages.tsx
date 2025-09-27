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
  TemplateOption,
} from './types/messages'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import { ScrollArea } from './ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Table, TableBody as TBody, TableCell as TD, TableHead as TH, TableHeader as THead, TableRow as TR } from './ui/table'

const CONTACT_FETCH_LIMIT = 500
const HISTORY_LIMIT = 200

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'reminder_24h', label: 'Reminder • 24h before' },
  { id: 'waitlist_open', label: 'Waitlist • Open slot' },
  { id: 'lead_followup', label: 'Lead • Follow-up' },
  { id: 'reengage_30d', label: 'Re-engage • 30 days' },
  { id: 'winback_45d', label: 'Win-back • 45+ days' },
  { id: 'no_show_followup', label: 'No-show • Follow-up' },
  { id: 'first_time_nurture', label: 'First-time • Nurture' },
]

const MESSAGE_FILTERS: Array<{ id: MessageFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'needs_reply', label: 'Needs Reply' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'failed', label: 'Failed' },
]

type ComposeTemplateId = (typeof TEMPLATE_OPTIONS)[number]['id']

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
  const [messageBody, setMessageBody] = useState(DEFAULT_TEMPLATE_TEXT['lead_followup'])
  const [lastAutoBody, setLastAutoBody] = useState(DEFAULT_TEMPLATE_TEXT['lead_followup'])
  const [sendMode, setSendMode] = useState<SendMode>('draft')
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftDownloadUrl, setDraftDownloadUrl] = useState<string>('')
  const [draftStatus, setDraftStatus] = useState<string>('')

  const [quietHours, setQuietHours] = useState<QuietHoursSettings>({})
  const [savingQuietHours, setSavingQuietHours] = useState(false)

  const [twilioStatusError, setTwilioStatusError] = useState<string | null>(null)

  const pendingBundleRef = useRef<FollowupBundle | null>(null)
  const bundleAppliedRef = useRef(false)

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
    }
  }, [])

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
      } catch (error) {
        console.error('Failed to load message history', error)
        setHistoryError('Unable to load messages right now.')
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

    if (bundle.bucket && TEMPLATE_OPTIONS.some((option) => option.id === bundle.bucket)) {
      setTemplateId(bundle.bucket as ComposeTemplateId)
      setLastAutoBody(DEFAULT_TEMPLATE_TEXT[bundle.bucket as ComposeTemplateId])
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
  }, [contacts, contactsById])

  useEffect(() => {
    if (bundleAppliedRef.current) return
    const templateText = DEFAULT_TEMPLATE_TEXT[templateId]
    if (!templateText) return
    if (messageBody.trim().length === 0 || messageBody === lastAutoBody) {
      setMessageBody(templateText)
      setLastAutoBody(templateText)
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
      const names = recipients.map((person) => person.name).join(', ')
      const prompt = [
        'Create a concise, friendly set of SMS drafts for beauty clients. Use warm, professional language and avoid jargon.',
        `Template bucket: ${templateId}`,
        `Clients: ${names}`,
        'Output as a Markdown document with one section per client:',
        '- Heading = client name',
        '- 1–2 sentence SMS, personalised with their name',
        '- No variables like {FirstName}. Use the given name directly.',
      ].join('\n')

      trackEvent('messages.draft', { bucket: templateId, count: recipients.length })
      const response = await api.post(
        '/ai/chat/raw',
        {
          tenant_id: tenantId,
          messages: [
            { role: 'user', content: prompt },
            { role: 'assistant', content: DEFAULT_TEMPLATE_TEXT[templateId] },
          ],
          mode: 'messages',
        },
        { timeoutMs: 60_000 },
      )

      const markdown = String(response?.text || '').trim()
      if (!markdown) {
        toast.error('Draft unavailable', { description: 'The AI did not return any content. Try again shortly.' })
        setDraftStatus('No draft returned')
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
    const templateLabel = TEMPLATE_OPTIONS.find((option) => option.id === templateId)?.label || 'Template'
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
                  <span>{templateLabel}</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px]">
                {TEMPLATE_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.id} onClick={() => setTemplateId(option.id as ComposeTemplateId)}>
                    {option.label}
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
                  <Send className="h-4 w-4 mr-2" />
                )}
                {isDrafting ? 'Drafting...' : 'Generate Draft'}
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
                        ? TEMPLATE_OPTIONS.find((option) => option.id === item.templateId)?.label ?? 'Custom'
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
