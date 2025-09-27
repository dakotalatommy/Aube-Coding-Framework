import { Search, Settings, Crown } from 'lucide-react'
import { memo } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { NotificationDropdown, type NotificationItem } from './notification-dropdown'

interface DashboardHeaderProps {
  onNotificationClick?: (notification?: NotificationItem) => void
  onOpenSettings?: () => void
  userData?: {
    plan?: string | null
    fullName?: string | null
    businessName?: string | null
    jobTitle?: string | null
  } | null
}

function DashboardHeaderComponent({ onNotificationClick, onOpenSettings, userData }: DashboardHeaderProps) {
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#2F5D9F' }} />
          <Input 
            placeholder="Search clients, appointments..." 
            className="pl-10 w-64 text-black border-2"
            style={{ borderColor: '#2F5D9F' }}
          />
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