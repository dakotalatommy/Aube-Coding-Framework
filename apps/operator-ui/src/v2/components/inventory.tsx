import { useCallback, useEffect, useMemo, useState } from 'react'
import { 
  AlertTriangle,
  BarChart3,
  Clock,
  DollarSign,
  ExternalLink,
  Link,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../lib/api'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { ScrollArea } from './ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { cn } from './ui/utils'
import type {
  InventoryMetricsResponse,
  InventoryProduct,
  InventoryRecommendation,
  InventorySyncProvider,
} from './types/inventory'
import { formatCurrency, formatPercent, formatRelativeTime } from '../lib/formatters'

interface InventoryState {
  metrics: InventoryMetricsResponse['summary']
  products: InventoryProduct[]
  recommendations: InventoryRecommendation[]
  integrations: InventoryMetricsResponse['integrations']
  lastSync: InventoryMetricsResponse['last_sync']
}

const DEFAULT_STATE: InventoryState = {
  metrics: {
    total_products: 0,
    low_stock: 0,
    out_of_stock: 0,
    top_sku: null,
    revenue_30d_cents: 0,
    margin_30d_percent: 0,
  },
  products: [],
  recommendations: [],
  integrations: [],
  lastSync: {},
}

const LOW_STOCK_FALLBACK = 5

const PROVIDER_LABELS: Record<InventorySyncProvider, string> = {
  auto: 'Auto detect',
  manual: 'Manual',
  shopify: 'Shopify',
  square: 'Square',
}

const PROVIDER_ICONS: Record<InventorySyncProvider, React.ComponentType<{ className?: string }>> = {
  auto: Zap,
  manual: Settings,
  shopify: ShoppingCart,
  square: BarChart3,
}

type SegmentKey = 'all' | 'low' | 'out'

type SortKey = 'recent' | 'stock' | 'sales' | 'revenue' | 'margin'

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'recent', label: 'Recently refreshed' },
  { id: 'stock', label: 'Stock (low first)' },
  { id: 'sales', label: 'Units sold (high first)' },
  { id: 'revenue', label: 'Revenue (high first)' },
  { id: 'margin', label: 'Margin % (high first)' },
]

const deriveSegment = (product: InventoryProduct, lowThreshold: number) => {
  if ((product.stock_quantity ?? 0) <= 0) return 'out'
  if ((product.stock_quantity ?? 0) <= lowThreshold) return 'low'
  return 'all'
}

const segmentStyles: Record<SegmentKey | 'monitor' | 'healthy', string> = {
  all: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  low: 'bg-amber-50 text-amber-700 border border-amber-200',
  out: 'bg-rose-50 text-rose-700 border border-rose-200',
  monitor: 'bg-blue-50 text-blue-700 border border-blue-200',
  healthy: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const segmentLabel: Record<SegmentKey | 'monitor' | 'healthy', string> = {
  all: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
  monitor: 'Monitor',
  healthy: 'Healthy',
}

const formatMoney = (cents?: number | null) => formatCurrency((cents ?? 0) / 100)

const formatPercentValue = (value?: number | null) => {
  if (value === undefined || value === null) return '—'
  return formatPercent(value)
}

const formatStock = (quantity?: number | null) => {
  const value = quantity ?? 0
  if (value <= 0) return 'Out'
  if (value === 1) return '1 unit'
  return `${value} units`
}

const sortProducts = (products: InventoryProduct[], key: SortKey) => {
  switch (key) {
    case 'stock':
      return [...products].sort((a, b) => (a.stock_quantity ?? 0) - (b.stock_quantity ?? 0))
    case 'sales':
      return [...products].sort((a, b) => (b.units_sold ?? 0) - (a.units_sold ?? 0))
    case 'revenue':
      return [...products].sort((a, b) => (b.revenue_cents ?? 0) - (a.revenue_cents ?? 0))
    case 'margin':
      return [...products].sort((a, b) => (b.margin_percent ?? 0) - (a.margin_percent ?? 0))
    case 'recent':
    default:
      return [...products].sort((a, b) => (b.updated_ts ?? 0) - (a.updated_ts ?? 0))
  }
}

const filterProducts = (products: InventoryProduct[], segment: SegmentKey, search: string, lowThreshold: number) => {
  const query = search.trim().toLowerCase()
  return products.filter((product) => {
    const matchesSegment =
      segment === 'all' ? true : deriveSegment(product, lowThreshold) === segment
    const matchesQuery =
      query.length === 0 ||
      product.name.toLowerCase().includes(query) ||
      (product.category ?? '').toLowerCase().includes(query) ||
      (product.brand ?? '').toLowerCase().includes(query) ||
      (product.sku ?? '').toLowerCase().includes(query)
    return matchesSegment && matchesQuery
  })
}

const formatProvider = (provider?: InventorySyncProvider | null) => {
  if (!provider) return 'Manual'
  return PROVIDER_LABELS[provider] ?? provider
}

const providerBadge = (provider?: InventorySyncProvider | null) => {
  const Icon = provider ? PROVIDER_ICONS[provider] ?? Settings : Settings
  return (
    <Badge variant="outline" className="flex items-center gap-1 text-xs">
      <Icon className="h-3 w-3" />
      <span>{formatProvider(provider)}</span>
    </Badge>
  )
}

export function Inventory() {
  const [state, setState] = useState<InventoryState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [segment, setSegment] = useState<SegmentKey>('all')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [search, setSearch] = useState('')
  const [lowThreshold, setLowThreshold] = useState(() => {
    try {
      const raw = localStorage.getItem('bvx_inventory_low_threshold')
      if (!raw) return LOW_STOCK_FALLBACK
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed)) return LOW_STOCK_FALLBACK
      return Math.max(0, parsed)
    } catch {
      return LOW_STOCK_FALLBACK
    }
  })
  const [syncing, setSyncing] = useState(false)
  const [syncProvider, setSyncProvider] = useState<InventorySyncProvider>('auto')

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = (await api.get(
        `/inventory/metrics`,
        { timeoutMs: 12_000 },
      )) as InventoryMetricsResponse

      setState({
        metrics: response.summary ?? DEFAULT_STATE.metrics,
        products: Array.isArray(response.items) ? response.items : [],
        recommendations: Array.isArray(response.recommendations)
          ? response.recommendations
          : [],
        integrations: Array.isArray(response.integrations) ? response.integrations : [],
        lastSync: response.last_sync ?? {},
      })
    } catch (err) {
      console.error('Inventory load failed', err)
      setError('We could not load your inventory just now. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSync = useCallback(
    async (provider: InventorySyncProvider) => {
      if (syncing) return
      setSyncing(true)
      try {
        await api.post(
          '/inventory/sync',
          {
            provider,
          },
          { timeoutMs: 25_000 },
        )

        toast.success('Inventory sync queued', {
          description: 'We will pull updated numbers once the sync finishes.',
        })
        await loadInventory()
      } catch (err) {
        console.error('Inventory sync failed', err)
        toast.error('Unable to launch inventory sync right now')
      } finally {
        setSyncing(false)
      }
    },
    [loadInventory, syncing],
  )

  const handleMergeDuplicates = useCallback(async () => {
    try {
      await api.post(
        '/inventory/merge',
        {
          strategy: 'sku_then_name',
        },
        { timeoutMs: 20_000 },
      )
      toast.success('Duplicate merge queued')
      await loadInventory()
    } catch (err) {
      console.error('Inventory merge failed', err)
      toast.error('Unable to queue merge right now')
    }
  }, [loadInventory])

  const handleLowThresholdChange = useCallback((value: number) => {
    setLowThreshold(value)
    try {
      localStorage.setItem('bvx_inventory_low_threshold', String(value))
    } catch {}
  }, [])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const filteredProducts = useMemo(() => {
    const filtered = filterProducts(state.products, segment, search, lowThreshold)
    return sortProducts(filtered, sortBy)
  }, [state.products, search, segment, sortBy, lowThreshold])

  const segmentCounts = useMemo(() => {
    return state.products.reduce(
      (acc, product) => {
        const key = deriveSegment(product, lowThreshold)
        acc[key] += 1
        return acc
      },
      { all: state.products.length, low: 0, out: 0 } as Record<SegmentKey, number>,
    )
  }, [state.products, lowThreshold])

  const integrationStatus = useMemo(() => {
    return (state.integrations ?? []).map((integration) => {
      const Icon = integration.provider ? PROVIDER_ICONS[integration.provider] ?? Settings : Settings
      return {
        id: integration.provider ?? 'manual',
        label: formatProvider(integration.provider),
        status: integration.status ?? 'disconnected',
        updatedLabel: integration.updated_ts ? formatRelativeTime(integration.updated_ts * 1000) : 'Never',
        ctaUrl: integration.connect_url ?? '',
        icon: Icon,
      }
    })
  }, [state.integrations])

  const recommendations = useMemo(() => (state.recommendations ?? []).slice(0, 3), [state.recommendations])

  const metrics = state.metrics
  const summary = {
    total_products: metrics?.total_products ?? 0,
    low_stock: metrics?.low_stock ?? 0,
    out_of_stock: metrics?.out_of_stock ?? 0,
    top_sku: metrics?.top_sku ?? null,
    revenue_30d_cents: metrics?.revenue_30d_cents ?? 0,
    margin_30d_percent: metrics?.margin_30d_percent ?? 0,
  }

  const heroTiles = [
    {
      id: 'products',
      label: 'Products',
      value: (summary.total_products ?? 0).toLocaleString(),
      subtitle: 'SKUs in your catalog',
      icon: Package,
    },
    {
      id: 'low',
      label: 'Low stock',
      value: (summary.low_stock ?? 0).toLocaleString(),
      subtitle: 'Need attention soon',
      icon: AlertTriangle,
      tone: 'text-amber-600',
    },
    {
      id: 'out',
      label: 'Out of stock',
      value: (summary.out_of_stock ?? 0).toLocaleString(),
      subtitle: 'Restock to keep selling',
      icon: TrendingDown,
      tone: 'text-rose-600',
    },
    {
      id: 'revenue',
      label: 'Shop revenue (30d)',
      value: summary.revenue_30d_cents ? formatCurrency(summary.revenue_30d_cents / 100) : '$0',
      subtitle: 'High-margin retail wins',
      icon: DollarSign,
    },
  ]

  const renderHeroTiles = () => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {heroTiles.map((tile) => {
        const Icon = tile.icon
  return (
          <Card key={tile.id} className="border border-muted bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{tile.label}</span>
                <Icon className={cn('h-4 w-4 text-primary', tile.tone)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-foreground">{tile.value}</div>
              <p className="text-xs text-muted-foreground">{tile.subtitle}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
  )

  const renderIntegrations = () => (
    <Card className="border border-muted">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link className="h-5 w-5 text-primary" />
          <span>Keep inventory in sync</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrationStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Connect Shopify or Square to automatically pull product performance, low-stock alerts, and retail ROI.
          </p>
        ) : (
          <div className="space-y-3">
            {integrationStatus.map((integration) => {
              const Icon = integration.icon
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-primary" />
                <div>
                      <div className="text-sm font-medium text-foreground">{integration.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {integration.status === 'connected' ? 'Connected' : 'Not connected'} · Updated {integration.updatedLabel}
                </div>
              </div>
                  </div>
                  {integration.ctaUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={integration.ctaUrl} target="_blank" rel="noreferrer">
                        Manage
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  ) : (
              <Button 
                variant="outline" 
                size="sm" 
                      onClick={() => handleSync(integration.id as InventorySyncProvider)}
                      disabled={syncing}
              >
                      Sync now
              </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {Object.entries(state.lastSync ?? {})
              .map(([provider, info]) => {
                const ts = Number((info as { ts?: number }).ts)
                const label = ts ? formatRelativeTime(ts * 1000) : 'No recent sync'
                return `${formatProvider(provider as InventorySyncProvider)} · ${label}`
              })
              .join(' • ') || 'No sync runs yet'}
          </span>
            </div>
          </CardContent>
        </Card>
  )

  const renderRecommendations = () => {
    if (recommendations.length === 0) return null
    return (
      <Card className="border border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-primary" />
            <span>Upsell opportunities</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="rounded-lg border bg-card/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">{rec.product}</h4>
                  <p className="text-xs text-muted-foreground">{rec.reason}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {rec.targetClients}
                </Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Suggested message</div>
                  <p className="text-sm text-foreground">{rec.suggestedMessage}</p>
                </div>
                <div className="rounded-md bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Potential revenue</div>
                  <p className="text-sm font-semibold text-foreground">
                    {rec.potentialRevenueCents ? formatCurrency(rec.potentialRevenueCents / 100) : '$0'}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Expected conversion: {rec.expectedConversion ? `${Math.round(rec.expectedConversion * 100)}%` : '—'}
              </div>
            </div>
              </div>
            </div>
          ))}
          </CardContent>
        </Card>
    )
  }

  const renderProductsTable = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
              </div>
      )
    }

    if (error) {
      return (
        <Card className="border border-destructive/50 bg-destructive/10">
          <CardContent className="py-6 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      )
    }

    if (filteredProducts.length === 0) {
      return (
        <Card className="border border-muted">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No products match your filters yet. Try syncing your booking tools or widening your search.
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="rounded-2xl border bg-card shadow-sm">
        <ScrollArea className="max-h-[520px]">
          <Table className="min-w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Reorder level</TableHead>
                <TableHead>Units sold</TableHead>
                <TableHead>Revenue (30d)</TableHead>
                    <TableHead>Margin</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                const seg = deriveSegment(product, lowThreshold)
                    return (
                      <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{product.name}</span>
                        <Badge className={cn('rounded-full text-xs font-normal', segmentStyles[seg])}>
                          {segmentLabel[seg]}
                        </Badge>
                            </div>
                      <div className="text-xs text-muted-foreground">{product.sku || 'No SKU set'}</div>
                        </TableCell>
                    <TableCell>{product.category || '—'}</TableCell>
                    <TableCell>{formatStock(product.stock_quantity)}</TableCell>
                    <TableCell>{product.reorder_level ?? '—'}</TableCell>
                    <TableCell>{product.units_sold?.toLocaleString() ?? '0'}</TableCell>
                    <TableCell>{formatMoney(product.revenue_cents)}</TableCell>
                    <TableCell>{formatPercentValue(product.margin_percent)}</TableCell>
                    <TableCell>{providerBadge(product.provider)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {product.updated_ts ? formatRelativeTime(product.updated_ts * 1000) : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
          <h1
            className="text-3xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Track retail performance, replenish fast movers, and surface upsell moments inside your daily workflow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={syncProvider} onValueChange={(value) => setSyncProvider(value as InventorySyncProvider)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sync provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto detect</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleSync(syncProvider)} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button variant="outline" onClick={handleMergeDuplicates}>
            Merge duplicates
          </Button>
        </div>
                    </div>

      {renderHeroTiles()}

      <Card className="border border-muted/70">
        <CardContent className="grid gap-4 p-6 md:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Search products, categories, or SKUs"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full min-w-[220px] md:w-64"
                />
                <div className="flex flex-wrap gap-2">
                  {( ['all', 'low', 'out'] as const ).map((entry) => (
                    <Button 
                      key={entry}
                      variant={segment === entry ? 'default' : 'outline'}
                      size="sm" 
                      className="rounded-full"
                      onClick={() => setSegment(entry)}
                    >
                      <span className="font-medium capitalize">{entry}</span>
                      <Badge variant="secondary" className="ml-2 rounded-full bg-white/80 text-xs">
                        {segmentCounts[entry] ?? 0}
                      </Badge>
                    </Button>
                  ))}
                </div>
                  </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">Low-stock threshold</div>
                <Input
                  type="number"
                  min={0}
                  value={lowThreshold}
                  onChange={(event) => handleLowThresholdChange(Number(event.target.value))}
                  className="w-20"
                />
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort products" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {renderProductsTable()}
          </div>
          <div className="space-y-4">
            {renderIntegrations()}
            {renderRecommendations()}
          </div>
              </CardContent>
            </Card>

      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="insights">Performance insights</TabsTrigger>
          <TabsTrigger value="messaging">AI messaging</TabsTrigger>
        </TabsList>
        <TabsContent value="insights">
          <Card className="border border-muted">
              <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Performance snapshot</span>
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                      <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Top SKU</div>
                    <div className="text-lg font-semibold text-foreground">{summary.top_sku ?? '—'}</div>
                  </div>
                  {/* Star icon removed */}
                </div>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>Revenue (30d)</span>
                  <span>{summary.revenue_30d_cents ? formatCurrency(summary.revenue_30d_cents / 100) : '$0'}</span>
                </div>
                <Progress
                  value={Math.min(100, Math.max(0, summary.margin_30d_percent ?? 0))}
                  className="mt-2"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  Gross margin {formatPercentValue(summary.margin_30d_percent)} from the last 30 days of retail sales insight.
                </div>
              </div>
              </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="messaging">
          <Card className="border border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-primary" />
                <span>AI retail follow-ups</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Select a product segment and BrandVX will draft messaging bundles in the Messages composer.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {( ['low', 'out'] as const ).map((bucket) => (
                  <div key={bucket} className="rounded-xl border bg-card/70 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold capitalize">{segmentLabel[bucket]}</div>
                        <div className="text-xs text-muted-foreground">Draft a batch outreach bundle</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          sessionStorage.setItem(
                            'bvx_followups_bundle',
                            JSON.stringify({
                              ids: filteredProducts
                                .filter((product) => deriveSegment(product, lowThreshold) === bucket)
                                .map((product) => product.id)
                                .slice(0, 50),
                              bucket: bucket === 'low' ? 'reengage_30d' : 'winback_45d',
                              scope: 'inventory',
                              templateLabel: bucket === 'low' ? 'Low stock restock' : 'Out of stock win-back',
                              ts: Date.now(),
                            }),
                          )
                          window.location.assign('/messages?tab=compose')
                        }}
                      >
                        Draft outreach
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
