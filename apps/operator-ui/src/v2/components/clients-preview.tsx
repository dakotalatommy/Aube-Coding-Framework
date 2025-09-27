import { useMemo } from 'react'
import { Calendar, Mail, Phone, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import type { DashboardClientPreviewItem } from '../types/dashboard'

interface ClientsPreviewProps {
  clients?: DashboardClientPreviewItem[] | null
  loading?: boolean
  onViewAll?: () => void
}

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const relativeFromEpoch = (epoch?: number | null) => {
  if (!epoch) return 'No visit yet'
  const diffMs = Date.now() - epoch * 1000
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

export function ClientsPreview({ clients, loading = false, onViewAll }: ClientsPreviewProps) {
  const items = useMemo(() => clients?.slice(0, 4) ?? [], [clients])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Top Clients</CardTitle>
        <Button variant="outline" size="sm" onClick={onViewAll}>
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-lg border border-dashed border-muted-foreground/20 bg-muted" />
            ))}
          </div>
        ) : items.length ? (
          <div className="space-y-4">
            {items.map((client) => {
              const initials = client.name
                .split(' ')
                .filter(Boolean)
                .map((part) => part[0]?.toUpperCase())
                .join('')
                .slice(0, 2)
              const status = client.status || (client.totalSpentCents > 50000 ? 'VIP' : 'Regular')
              return (
                <div key={client.id} className="flex items-center space-x-4 rounded-lg border p-3">
                  <Avatar>
                    <AvatarFallback>{initials || 'CL'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center space-x-2">
                      <p className="truncate font-medium">{client.name}</p>
                      <Badge
                        variant={status === 'VIP' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {status}
                      </Badge>
                    </div>
                    <div className="mb-1 flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>{formatter.format(client.totalSpentCents / 100)} spent</span>
                      <span>•</span>
                      <span>{client.visitCount} visits</span>
                      <span>•</span>
                      <span>{relativeFromEpoch(client.lastVisitTs)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      {client.emailHash ? <span>Email consent</span> : <span>Email opt-out</span>}
                      <span>•</span>
                      {client.phoneHash ? <span>SMS consent</span> : <span>SMS opt-out</span>}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            <p>Add clients to see highlights here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
