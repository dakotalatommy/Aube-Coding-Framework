export interface ClientRecord {
  id: string
  displayName: string
  email?: string
  phone?: string
  lastVisitTs?: number | null
  nextVisitTs?: number | null
  totalSpentCents?: number
  visitCount?: number
  preferredService?: string
  serviceTags?: string[]
  segment?: string
  status?: string
  priority?: 'High' | 'Medium' | 'Low'
  lifetimeValue?: 'High' | 'Medium' | 'Potential' | 'Low'
  referralsCount?: number
  notes?: string
  birthday?: string | null
  source?: string | null
}

export interface ClientSegmentSummary {
  id: string
  name: string
  count: number
  description?: string
  icon?: string
}

export interface ClientsState {
  segments: ClientSegmentSummary[]
  smartLists: ClientSegmentSummary[]
  totalCount: number
  lastSyncTs?: number | null
  connectedPlatform?: 'square' | 'acuity' | 'none'
}

export interface ClientsQueryParams {
  limit?: number
  offset?: number
  segmentId?: string
  search?: string
  sortBy?: 'name' | 'priority' | 'lastVisit' | 'totalSpent' | 'visits' | 'status'
  sortDirection?: 'asc' | 'desc'
}

export interface ClientsListResponse {
  items: ClientRecord[]
  total: number
}
