import { 
  LayoutDashboard, 
  Calendar, 
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
  Lock,
  Crown
} from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from './ui/utils'
import bvxLogo from 'figma:asset/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'

const navItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    active: true,
    requiresFullPlan: false, // Lite included
  },
  {
    title: "AskVX",
    icon: Sparkles,
    href: "/askvx",
    requiresFullPlan: false, // Lite included
  },
  {
    title: "BrandVZN",
    icon: Target,
    href: "/brandvzn",
    requiresFullPlan: false, // Lite included
  },
  {
    title: "Messages",
    icon: MessageCircle,
    href: "/messages",
    requiresFullPlan: false, // Lite included
  },
  {
    title: "Clients",
    icon: Users,
    href: "/clients",
    requiresFullPlan: false, // Lite included
  },
  {
    title: "Agenda",
    icon: ClipboardList,
    href: "/agenda",
    requiresFullPlan: false, // Lite included
  },
  {
    title: "Follow Ups",
    icon: UserCheck,
    href: "/follow-ups",
    requiresFullPlan: true, // Full plan only
  },
  {
    title: "Fill Your Chair",
    icon: MousePointer,
    href: "/grow-your-list",
    requiresFullPlan: true, // Full plan only
  },
  {
    title: "Grow with VX",
    icon: TrendingUp,
    href: "/grow-with-vx",
    requiresFullPlan: true, // Full plan only
  },
  {
    title: "Inventory",
    icon: Package,
    href: "/inventory",
    requiresFullPlan: true, // Full plan only
  },
  {
    title: "Tutorials",
    icon: PlayCircle,
    href: "/tutorials",
    requiresFullPlan: false, // Lite included
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    requiresFullPlan: false, // Lite included
  },
]

interface SidebarNavProps {
  currentPage: string
  setCurrentPage: (page: string) => void
  userData?: any
  tenantPlan?: 'lite' | 'starter' | 'growth' | 'pro'
  hasFullAccess?: boolean
  onNavigateToSettings?: () => void
  onUpgrade?: () => void
}

export function SidebarNav({ 
  currentPage, 
  setCurrentPage, 
  userData, 
  tenantPlan = 'pro',
  hasFullAccess = true,
  onNavigateToSettings,
  onUpgrade
}: SidebarNavProps) {
  const isLitePlan = tenantPlan === 'lite'
  
  const handleNavClick = (page: string, requiresFullPlan: boolean) => {
    // If feature requires full plan and user is on Lite, show upgrade modal
    if (requiresFullPlan && isLitePlan) {
      if (onUpgrade) {
        onUpgrade()
      }
      return
    }
    
    if (page === 'settings' && onNavigateToSettings) {
      onNavigateToSettings()
    }
    setCurrentPage(page)
  }

  return (
    <div className="w-64 bg-card border-r h-full">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <img 
            src={bvxLogo} 
            alt="BVX Logo" 
            className="h-16 w-auto object-contain"
          />
        </div>
        
        <nav className="space-y-2">
          {navItems.map((item) => {
            const page = item.href.slice(1) || 'dashboard'
            const isActive = currentPage === page
            const isLocked = isLitePlan && item.requiresFullPlan
            const showBadge = item.requiresFullPlan && hasFullAccess
            
            return (
              <div key={item.href} className="relative">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start space-x-3",
                    isActive && "bg-primary text-primary-foreground",
                    isLocked && "opacity-75 cursor-pointer"
                  )}
                  onClick={() => handleNavClick(page, item.requiresFullPlan)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{item.title}</span>
                  {isLocked && (
                    <div className="flex items-center space-x-1">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-1 border-0">
                        Full
                      </Badge>
                    </div>
                  )}
                  {showBadge && !isLocked && (
                    <Badge variant="secondary" className="text-xs px-1 py-0.5 border-0 opacity-60">
                      <Crown className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                </Button>
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}