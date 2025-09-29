import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { api, getTenant, API_BASE } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../lib/formatters'
import type { ClientsListResponse, ClientRecord, ClientSegmentSummary, ClientsQueryParams } from './types/clients'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback } from './ui/avatar'
import { ScrollArea } from './ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Table, TableBody as TBody, TableCell as TD, TableHead as TH, TableHeader as THead, TableRow as TR } from './ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Skeleton } from './ui/skeleton'
import { cn } from './ui/utils'

// ICU collator just for client search matching (fallback when API results filtered client-side)
const SORT_OPTIONS: Array<{ id: ClientsQueryParams['sortBy']; label: string }> = [
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'lastVisit', label: 'Last visit (newest first)' },
  { id: 'visits', label: 'Visits (most first)' },
  { id: 'totalSpent', label: 'Lifetime value' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
]

const PRIORITY_CLASSES: Record<NonNullable<ClientRecord['priority']>, string> = {
  High: 'bg-rose-50 text-rose-700 border border-rose-200',
  Medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const LIFETIME_CLASSES: Record<NonNullable<ClientRecord['lifetimeValue']>, string> = {
  High: 'bg-primary/10 text-primary border border-primary/20',
  Medium: 'bg-secondary/10 text-secondary-foreground border border-secondary/20',
  Potential: 'bg-blue-50 text-blue-700 border border-blue-200',
  Low: 'bg-muted text-muted-foreground border border-muted',
}

const DEFAULT_SEGMENTS: ClientSegmentSummary[] = [
    {
      id: 'all',
    name: 'All clients',
    count: 0,
    description: 'Complete client list',
  },
]

const PAGE_SIZE = 25

const formatCurrency = (value?: number | null) => {
  if (!value) return '$0'
  return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const formatPhone = (value?: string | null) => {
  if (!value) return '—'
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}

const makeAvatarFallback = (name: string) => {
  const parts = name.split(' ').filter(Boolean)
  if (!parts.length) return 'BV'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
}

interface ClientsProps {
  initialSearch?: string
  onAckSearch?: () => void
}

export function Clients({ initialSearch, onAckSearch }: ClientsProps = {}) {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [totalClients, setTotalClients] = useState(0)
  const [segments, setSegments] = useState<ClientSegmentSummary[]>(DEFAULT_SEGMENTS)
  const [activeSegment, setActiveSegment] = useState<string>('all')
  const [smartLists, setSmartLists] = useState<ClientSegmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<ClientsQueryParams['sortBy']>('lastVisit')
  const [sortDirection, setSortDirection] = useState<ClientsQueryParams['sortDirection']>('desc')
  const [page, setPage] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const initialAppliedRef = useRef<string | undefined>(undefined)

  const loadSegments = useCallback(async () => {
    try {
      const tenantId = await getTenant()
      if (!tenantId) return
      const response = (await api.get(
        `/contacts/segments?tenant_id=${encodeURIComponent(tenantId)}&scope=dashboard`,
        { timeoutMs: 10_000 },
      )) as { segments?: ClientSegmentSummary[]; smart_lists?: ClientSegmentSummary[] }
      const segmentList = Array.isArray(response?.segments) && response.segments.length > 0
        ? response.segments
        : DEFAULT_SEGMENTS
      setSegments(segmentList)
      const smart = Array.isArray(response?.smart_lists) ? response.smart_lists : []
      setSmartLists(smart)
      if (!segmentList.some((segment) => segment.id === activeSegment)) {
        setActiveSegment(segmentList[0]?.id ?? 'all')
      }
    } catch (err) {
      console.warn('Unable to load client segments', err)
    }
  }, [activeSegment])

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tenantId = await getTenant()
      if (!tenantId) {
        setClients([])
        setTotalClients(0)
        return
      }

      const params: ClientsQueryParams = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        segmentId: activeSegment === 'all' ? undefined : activeSegment,
        search: search.trim() || undefined,
        sortBy,
        sortDirection,
      }
      const query = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        query.set(key, String(value))
      })
      query.set('tenant_id', tenantId)

      const response = (await api.get(`/contacts/list?${query.toString()}`, {
        timeoutMs: 15_000,
      })) as ClientsListResponse

      const items = Array.isArray(response?.items) ? response.items : []
      setClients(items)
      setTotalClients(Number(response?.total ?? items.length))
    } catch (err) {
      console.error('Failed to load clients', err)
      setError('We could not load clients right now. Try again shortly.')
    } finally {
      setLoading(false)
    }
  }, [activeSegment, page, search, sortBy, sortDirection])

  const handleImport = useCallback(async () => {
    if (importing) return
    setImporting(true)
    try {
      const tenantId = await getTenant()
      if (!tenantId) throw new Error('Missing tenant context')
      await api.post('/integrations/refresh', { tenant_id: tenantId, provider: 'auto' })
      toast.success('Import kicked off — we will refresh clients once it’s done.')
      await loadClients()
    } catch (err) {
      console.error('Client import failed', err)
      toast.error('Unable to run import right now')
    } finally {
      setImporting(false)
    }
  }, [importing, loadClients])

  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    try {
      const tenantId = await getTenant()
      if (!tenantId) throw new Error('Missing tenant context')
      const session = (await supabase.auth.getSession()).data.session
      const headers: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}

      const downloadUrl = `${API_BASE}/contacts/export.csv?tenant_id=${encodeURIComponent(tenantId)}`
      const response = await fetch(downloadUrl, { headers })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'clients.csv'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (err) {
      console.error('Client export failed', err)
      toast.error('Unable to download export right now')
    } finally {
      setExporting(false)
    }
  }, [exporting])

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const tenantId = await getTenant()
      if (!tenantId) throw new Error('Missing tenant context')
      await api.post('/onboarding/analyze', { tenant_id: tenantId })
      toast.success('Connected tools re-checked')
      await loadSegments()
      await loadClients()
    } catch (err) {
      console.error('Client sync failed', err)
      toast.error('Unable to refresh connections right now')
    } finally {
      setSyncing(false)
    }
  }, [loadClients, loadSegments, syncing])

  useEffect(() => {
    loadSegments().catch((err) => console.warn(err))
  }, [loadSegments])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    if (typeof initialSearch === 'string') {
      if (initialAppliedRef.current === initialSearch) return
      initialAppliedRef.current = initialSearch
      setSearch(initialSearch)
      setPage(0)
      onAckSearch?.()
    }
  }, [initialSearch, onAckSearch])

  const segmentOptions = useMemo(() => {
    return segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      count: segment.count,
      description: segment.description,
    }))
  }, [segments])

  const filteredSmartLists = useMemo(() => smartLists.slice(0, 4), [smartLists])

  const emptyStateLabel = useMemo(() => {
    if (search.trim().length > 0) return 'No clients match your search yet.'
    if (activeSegment !== 'all') return 'This segment is empty for now.'
    return 'Import from Square or re-engage past guests to see clients here.'
  }, [activeSegment, search])

  const renderClientRow = (client: ClientRecord) => {
  return (
      <TR key={client.id} className="hover:bg-muted/40">
        <TD className="w-[280px]">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{makeAvatarFallback(client.displayName)}</AvatarFallback>
            </Avatar>
        <div>
              <p className="font-medium text-foreground">{client.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {client.status ?? 'Active'} · {client.preferredService ?? 'General'}
          </p>
        </div>
          </div>
        </TD>
        <TD>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{formatPhone(client.phone)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>{client.preferredService ?? '—'}</span>
            </div>
          </div>
        </TD>
        <TD>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Last visit</div>
            <div className="text-foreground">
              {client.lastVisitTs ? formatRelativeTime(client.lastVisitTs * 1000) : 'Never'}
            </div>
          </div>
        </TD>
        <TD>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Total visits</div>
            <div className="text-foreground">{client.visitCount ?? 0}</div>
          </div>
        </TD>
        <TD>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Lifetime spend</div>
            <div className="text-foreground">{formatCurrency(client.totalSpentCents ?? 0)}</div>
          </div>
        </TD>
        <TD>
          <div className="flex flex-col gap-2">
            {client.priority ? (
              <Badge className={cn('w-fit text-xs font-medium', PRIORITY_CLASSES[client.priority])}>
                {client.priority} priority
              </Badge>
            ) : null}
            {client.lifetimeValue ? (
              <Badge className={cn('w-fit text-xs font-medium', LIFETIME_CLASSES[client.lifetimeValue])}>
                {client.lifetimeValue} LTV
              </Badge>
            ) : null}
          </div>
        </TD>
        <TD className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Client actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  sessionStorage.setItem(
                    'bvx_followups_bundle',
                    JSON.stringify({
                      ids: [client.id],
                      bucket: 'lead_followup',
                      templateLabel: 'Lead follow-up',
                      ts: Date.now(),
                    }),
                  )
                  window.location.assign('/messages?tab=compose')
                }}
              >
                Send follow-up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.assign(`/clients/${client.id}`)}>
                View profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Archive client (coming soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TD>
      </TR>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-muted/70">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
              <CardTitle className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
                Clients
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                See every relationship, group clients by stage, and take action with one tap.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {syncing ? 'Refreshing…' : 'Refresh connections'}
              </Button>
              <Button variant="outline" onClick={handleImport} disabled={importing}>
                <Upload className="mr-2 h-4 w-4" />
                {importing ? 'Importing…' : 'Import contacts'}
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                <Download className="mr-2 h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add client
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-muted">
        <CardContent className="p-6">
          <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Segments</h3>
                <p className="text-xs text-muted-foreground">
                  Smart groups based on booking behaviour, lifetime value, and retention risk.
                </p>
            </div>
              <ScrollArea className="max-h-[360px]">
                <div className="space-y-2 pr-2">
                  {segmentOptions.map((segment) => (
                    <Button
                      key={segment.id}
                      variant={activeSegment === segment.id ? 'default' : 'ghost'}
                      className="w-full justify-between text-left"
                      onClick={() => {
                        setActiveSegment(segment.id)
                        setPage(0)
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold">{segment.name}</div>
                        <div className="text-xs text-muted-foreground">{segment.description}</div>
          </div>
                      <Badge variant={activeSegment === segment.id ? 'secondary' : 'outline'}>
                        {segment.count ?? 0}
                      </Badge>
                    </Button>
                  ))}
        </div>
              </ScrollArea>
              {filteredSmartLists.length > 0 ? (
        <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Smart lists
                  </h4>
                  <div className="mt-2 space-y-2">
                    {filteredSmartLists.map((list) => (
                      <Button
                        key={list.id}
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => {
                          setActiveSegment(list.id)
                          setPage(0)
                        }}
                      >
                        <span>{list.name}</span>
                        <Badge variant="secondary">{list.count ?? 0}</Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Input
                    placeholder="Search by name, service, or tag"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(0)
                    }}
                  />
                </div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as ClientsQueryParams['sortBy'])}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Sort clients" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id ?? 'name'}>
                        {option.label}
              </SelectItem>
                    ))}
            </SelectContent>
          </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  aria-label="Toggle sort direction"
                >
                  {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full rounded-xl" />
                  ))}
                    </div>
              ) : error ? (
                <Card className="border border-destructive/40 bg-destructive/10">
                  <CardContent className="py-6 text-center text-sm text-destructive">{error}</CardContent>
                </Card>
              ) : clients.length === 0 ? (
                <Card className="border border-muted">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    {emptyStateLabel}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-2xl border bg-card">
                  <ScrollArea className="max-h-[520px]">
                    <Table className="min-w-full text-sm">
                      <THead>
                        <TR>
                          <TH>Client</TH>
                          <TH>Contact</TH>
                          <TH>Last visit</TH>
                          <TH>Visits</TH>
                          <TH>Lifetime value</TH>
                          <TH>Tags</TH>
                          <TH className="text-right">Actions</TH>
                        </TR>
                      </THead>
                      <TBody>{clients.map((client) => renderClientRow(client))}</TBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {clients.length} of {totalClients} clients
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    disabled={page === 0 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => prev + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= totalClients || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>
        <TabsContent value="insights">
          <Card className="border border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Client health recap</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Retention is driven by consistent follow-up and celebrating milestones. Check the segments above to
                prioritize who needs the next touch.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-card/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">VIP clients</p>
                  <p className="text-lg font-semibold text-foreground">
                    {segments.find((segment) => segment.id === 'vip')?.count ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Keep them warm with surprise perks every quarter.</p>
                    </div>
                <div className="rounded-xl border bg-card/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">At-risk guests</p>
                  <p className="text-lg font-semibold text-foreground">
                    {segments.find((segment) => segment.id === 'inactive')?.count ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Offer nurturing touchpoints at 30, 45, and 60 days.</p>
                    </div>
                <div className="rounded-xl border bg-card/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Referral champions</p>
                  <p className="text-lg font-semibold text-foreground">
                    {segments.find((segment) => segment.id === 'referrals')?.count ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Invite them to share their beauty experience with a thank-you gift.</p>
                        </div>
                      </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="actions">
          <Card className="border border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>AI-guided follow-ups</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Use BrandVX templates to rebook no-shows, celebrate birthdays, and nurture new guests without leaving
                the dashboard.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border border-muted bg-card/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4 text-primary" />
                      <span>Win-back routine</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Re-engage beauty pros who missed the last cadence touchpoint.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => {
                        sessionStorage.setItem(
                          'bvx_followups_bundle',
                          JSON.stringify({
                            ids: clients.map((client) => client.id).slice(0, 30),
                            bucket: 'winback_45d',
                            scope: 'clients',
                            templateLabel: 'Win-back cadence',
                            ts: Date.now(),
                          }),
                        )
                        window.location.assign('/messages?tab=compose')
                      }}
                    >
                      Draft win-back campaign
                      <ArrowRightHint />
                    </Button>
                          <p className="text-xs text-muted-foreground">
                      We prepopulate smart drafts inside Messages → Compose. Review, customize, and copy in one tap.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-muted bg-card/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>Birthday spotlight</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Surprise clients celebrating this month with a personal note.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => {
                        sessionStorage.setItem(
                          'bvx_followups_bundle',
                          JSON.stringify({
                            ids: clients
                              .filter((client) => (client.segment ?? '') === 'birthday')
                              .map((client) => client.id),
                            bucket: 'first_time_nurture',
                            scope: 'clients',
                            templateLabel: 'Birthday surprise',
                            ts: Date.now(),
                          }),
                        )
                        window.location.assign('/messages?tab=compose')
                      }}
                    >
                      Draft birthday notes
                      <ArrowRightHint />
                    </Button>
                          <p className="text-xs text-muted-foreground">
                      We highlight upcoming birthdays in your messages queue so you can surprise guests with charm.
                    </p>
          </CardContent>
        </Card>
      </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ArrowRightHint() {
  return 'Review in Messages'
}
