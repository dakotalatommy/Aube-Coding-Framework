import { Crown, Loader2, Search, Settings } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { NotificationDropdown, type NotificationItem } from './notification-dropdown'
import { api, getTenant } from '../../lib/api'

interface SearchResult {
  id: string
  type: 'client' | 'appointment'
  title: string
  subtitle?: string
  badge?: string
  searchTerm?: string
}

interface DashboardHeaderProps {
  onNotificationClick?: (notification?: NotificationItem) => void
  onOpenSettings?: () => void
  onNavigate?: (pane: string, payload?: { search?: string }) => void
  userData?: {
    plan?: string | null
    fullName?: string | null
    businessName?: string | null
    jobTitle?: string | null
  } | null
}

function DashboardHeaderComponent({ onNotificationClick, onOpenSettings, onNavigate, userData }: DashboardHeaderProps) {
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastQueryRef = useRef('')

  const fetchResults = useCallback(async (query: string) => {
    const term = query.trim()
    if (!term) {
      setSearchResults([])
      setResultsOpen(false)
      setSearchError(null)
      return
    }
    setSearchLoading(true)
    try {
      const tenantId = await getTenant()
      if (!tenantId) {
        setSearchResults([])
        setResultsOpen(false)
        setSearchError(null)
        return
      }
      const response = await api.get(
        `/search?q=${encodeURIComponent(term)}&limit=6`,
        { timeoutMs: 8000 },
      )
      const clients = Array.isArray(response?.clients) ? response.clients : []
      const appointments = Array.isArray(response?.appointments) ? response.appointments : []

      const mapped: SearchResult[] = []

      clients.forEach((client: any) => {
        const names = [client?.display_name, client?.first_name, client?.last_name]
          .filter((part: unknown) => typeof part === 'string' && part.trim().length > 0)
        const title = names[0] || 'Client'
        const subtitleParts: string[] = []
        if (client?.last_visit) {
          const ts = Number(client.last_visit)
          if (!Number.isNaN(ts)) {
            const date = new Date(ts * 1000)
            subtitleParts.push(`Last visit ${date.toLocaleDateString()}`)
          }
        }
        if (client?.status) subtitleParts.push(String(client.status))
        mapped.push({
          id: `client:${client?.contact_id || title}`,
          type: 'client',
          title,
          subtitle: subtitleParts.join(' • ') || undefined,
          badge: client?.priority || undefined,
          searchTerm: title,
        })
      })

      appointments.forEach((appt: any) => {
        const ts = Number(appt?.start_ts)
        const date = !Number.isNaN(ts) ? new Date(ts * 1000) : null
        const timeLabel = date
          ? `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : undefined
        const subtitleParts: string[] = []
        if (appt?.contact_name) subtitleParts.push(String(appt.contact_name))
        if (timeLabel) subtitleParts.push(timeLabel)
        mapped.push({
          id: `appointment:${appt?.id}`,
          type: 'appointment',
          title: appt?.service || 'Appointment',
          subtitle: subtitleParts.join(' • ') || undefined,
          badge: appt?.status || undefined,
          searchTerm: appt?.contact_name || appt?.service || term,
        })
      })

      setSearchResults(mapped)
      setResultsOpen(true)
      setSearchError(null)
    } catch (error) {
      console.warn('Global search failed', error)
      setSearchResults([])
      setResultsOpen(true)
      setSearchError('Unable to search right now')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchValue.trim().length < 2) {
      setSearchResults([])
      setResultsOpen(false)
      setSearchError(null)
      lastQueryRef.current = ''
      return
    }
    const handle = window.setTimeout(() => {
      const trimmed = searchValue.trim()
      if (trimmed === lastQueryRef.current) return
      lastQueryRef.current = trimmed
      void fetchResults(trimmed)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [fetchResults, searchValue])

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setResultsOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setResultsOpen(false)
      setSearchValue('')
      lastQueryRef.current = ''
      const payload = { pane: result.type === 'client' ? 'clients' : 'agenda', search: result.searchTerm || result.title }
      onNavigate?.(payload.pane, { search: payload.search })
      window.dispatchEvent(new CustomEvent('bvx:navigate', { detail: payload }))
    },
    [onNavigate]
  )

  const renderResults = useMemo(() => {
    if (!resultsOpen) return null
    if (searchLoading) {
      return (
        <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg p-4 flex items-center space-x-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Searching…</span>
        </div>
      )
    }
    if (searchError) {
      return (
        <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg p-4 text-sm text-destructive">
          {searchError}
        </div>
      )
    }
    if (!searchResults.length) {
      return (
        <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg p-4 text-sm text-muted-foreground">
          No matches yet. Try another name or service.
        </div>
      )
    }
    return (
      <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg">
        <ul className="divide-y">
          {searchResults.map((item) => (
            <li
              key={item.id}
              className="p-3 hover:bg-primary/5 cursor-pointer"
              onClick={() => handleResultClick(item)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{item.subtitle}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs capitalize">
                  {item.type === 'client' ? 'Client' : 'Appointment'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }, [handleResultClick, resultsOpen, searchError, searchLoading, searchResults])

  const handleInputFocus = () => {
    if (searchResults.length) setResultsOpen(true)
  }

  return (
    <header className="flex items-center justify-between p-6 bg-card border-b">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold">VX</span>
          </div>
          <h1 className="text-2xl font-bold text-black">Dashboard</h1>
          {userData?.plan && ['pro', 'premium'].includes(userData.plan.toLowerCase()) && (
            <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0 px-2 py-1">
              <Crown className="h-3 w-3 mr-1" />
              {userData.plan === 'premium' ? 'Premium' : 'Pro'}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative" ref={containerRef}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#2F5D9F' }} />
          <Input
            placeholder="Search clients, appointments..."
            className="pl-10 w-64 text-black border-2"
            style={{ borderColor: '#2F5D9F' }}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onFocus={handleInputFocus}
          />
          {renderResults}
        </div>

        <NotificationDropdown onViewAgenda={onNotificationClick ?? (() => {})} />

        <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Open settings">
          <Settings className="h-5 w-5 text-black" />
        </Button>

        <Avatar>
          <AvatarImage src="https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100" alt={userData?.fullName ?? 'Operator avatar'} />
          <AvatarFallback>
            {(userData?.fullName ?? userData?.businessName ?? 'BrandVX')
              .split(' ')
              .slice(0, 2)
              .map(part => part.charAt(0).toUpperCase())
              .join('') || 'BV'}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

export const DashboardHeader = memo(DashboardHeaderComponent)
