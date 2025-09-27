export type InventorySyncProvider = 'auto' | 'manual' | 'shopify' | 'square'

export interface InventoryMetricsSummary {
  total_products?: number
  low_stock?: number
  out_of_stock?: number
  top_sku?: string | null
  revenue_30d_cents?: number
  margin_30d_percent?: number
}

export interface InventoryIntegrationStatus {
  provider?: InventorySyncProvider | null
  status?: 'connected' | 'disconnected' | 'pending'
  updated_ts?: number | null
  connect_url?: string | null
}

export interface InventoryRecommendation {
  id: string
  product: string
  reason: string
  targetClients: string
  suggestedMessage: string
  potentialRevenueCents?: number
  expectedConversion?: number
}

export interface InventoryProduct {
  id: string
  tenant_id?: string
  sku?: string | null
  name: string
  category?: string | null
  brand?: string | null
  provider?: InventorySyncProvider | null
  stock_quantity: number
  reorder_level?: number | null
  units_sold?: number | null
  revenue_cents?: number | null
  margin_percent?: number | null
  updated_ts?: number | null
}

export interface InventoryMetricsResponse {
  summary?: InventoryMetricsSummary
  items?: InventoryProduct[]
  integrations?: InventoryIntegrationStatus[]
  last_sync?: Record<string, { status?: string; ts?: number | null }>
  recommendations?: InventoryRecommendation[]
}
