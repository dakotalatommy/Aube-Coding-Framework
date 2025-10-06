import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  MessageCircle,
  UserCheck,
  Sparkles,
  Target,
  ClipboardList,
  MousePointer,
  PlayCircle,
  TrendingUp,
  Crown,
  HelpCircle,
  Calendar,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from './ui/utils'
import bvxLogo from '../assets/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'
import { flags } from '../../lib/flags'
import { supabase } from '../../lib/supabase'

interface NavItem {
  title: string
  icon: LucideIcon
  href: string
  requiresPro?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    title: 'AskVX',
    icon: Sparkles,
    href: '/askvx',
  },
  {
    title: 'BrandVZN',
    icon: Target,
    href: '/brandvzn',
  },
  {
    title: 'Messages',
    icon: MessageCircle,
    href: '/messages',
  },
  {
    title: 'Clients',
    icon: Users,
    href: '/clients',
  },
  {
    title: 'Agenda',
    icon: ClipboardList,
    href: '/agenda',
  },
  {
    title: 'Follow Ups',
    icon: UserCheck,
    href: '/follow-ups',
  },
  {
    title: 'Fill Your Chair',
    icon: MousePointer,
    href: '/grow-your-list',
    requiresPro: true,
  },
  {
    title: 'Grow with VX',
    icon: TrendingUp,
    href: '/grow-with-vx',
    requiresPro: true,
  },
  {
    title: 'Inventory',
    icon: Package,
    href: '/inventory',
  },
  {
    title: 'Tutorials',
    icon: PlayCircle,
    href: '/tutorials',
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
  },
]

interface SidebarNavProps {
  currentPage: string
  onNavigate: (page: string) => void
  userData?: {
    plan?: string | null
  } | null
  onNavigateToSettings?: () => void
}

const isFounderTier = (userData?: SidebarNavProps['userData']) => {
  const plan = userData?.plan?.toLowerCase() ?? ''
  return plan === 'founder_unlimited'
}

const isTrialUser = (userData?: SidebarNavProps['userData']) => {
  // Founder tier users are not trial users
  if (isFounderTier(userData)) return false
  const plan = userData?.plan?.toLowerCase() ?? ''
  return !plan || plan === 'trial' || plan === 'essentials'
}

export function SidebarNav({ currentPage, onNavigate, userData, onNavigateToSettings }: SidebarNavProps) {
  const navigate = useNavigate()
  const userIsOnTrial = isTrialUser(userData)
  const BOOKING_URL = (import.meta as any).env?.VITE_BOOKING_URL || ''

  const handleNavClick = (page: string) => {
    if (page === 'settings' && onNavigateToSettings) {
      onNavigateToSettings()
      return  // Don't double-navigate for settings
    }
    onNavigate(page)
  }

  const handleSupportClick = () => {
    try {
      window.dispatchEvent(new CustomEvent('bvx:support:open', { detail: { source: 'sidebar-cta' } }))
    } catch (error) {
      console.warn('Failed to open support:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      localStorage.setItem('bvx_signed_out', '1')
    } catch {}

    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Sign out error:', error)
    }

    try {
      localStorage.removeItem('bvx_tenant')
    } catch {}

    try {
      navigate('/brandvx', { replace: true })
    } catch (error) {
      console.warn('Router navigate to /brandvx failed, falling back to hard redirect', error)
      window.location.href = '/brandvx'
    }
  }

  // Filter nav items based on feature flags
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.href === '/follow-ups' && !flags.follow_ups()) return false
    return true
  })

  return (
    <div className="w-64 bg-card border-r h-full">
      <div className="p-6">
        <div className="flex items-center justify-center mb-0 overflow-hidden">
          <img 
            src={bvxLogo} 
            alt="BVX Logo" 
            className="h-[110px] w-auto object-contain -my-6"
          />
        </div>
        
        <nav className="space-y-2">
          {visibleNavItems.map((item) => {
            const page = item.href.slice(1) || 'dashboard'
            const isActive = currentPage === page
            const isLocked = userIsOnTrial && item.requiresPro
            const isProFeature = item.requiresPro && !userIsOnTrial
            
            return (
              <div key={item.href} className="relative">
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  className={cn(
                    'w-full justify-start space-x-3',
                    isActive && 'bg-primary text-primary-foreground',
                    isLocked && 'opacity-75'
                  )}
                  onClick={() => handleNavClick(page)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{item.title}</span>
                  {isLocked && (
                    <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs px-2 py-1">
                      <Crown className="h-3 w-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                  {isProFeature && (
                    <Badge className="bg-gradient-to-r from-primary to-accent text-white text-xs px-1 py-0.5 border-0">
                      <Crown className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                </Button>
              </div>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div className="mt-6 pt-4 border-t space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start space-x-3"
            onClick={handleSupportClick}
          >
            <HelpCircle className="h-5 w-5" />
            <span className="flex-1 text-left">Support</span>
          </Button>

          {BOOKING_URL && (
            <Button
              variant="ghost"
              className="w-full justify-start space-x-3"
              asChild
            >
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:text-foreground"
              >
                <Calendar className="h-5 w-5" />
                <span className="flex-1 text-left">Book Onboarding</span>
              </a>
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full justify-start space-x-3 border-primary/20 text-primary hover:bg-primary/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            <span className="flex-1 text-left">Sign out</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
