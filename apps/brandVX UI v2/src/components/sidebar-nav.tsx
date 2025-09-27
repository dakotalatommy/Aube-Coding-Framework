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
  },
  {
    title: "AskVX",
    icon: Sparkles,
    href: "/askvx",
  },
  {
    title: "BrandVZN",
    icon: Target,
    href: "/brandvzn",
  },
  {
    title: "Messages",
    icon: MessageCircle,
    href: "/messages",
  },
  {
    title: "Clients",
    icon: Users,
    href: "/clients",
  },
  {
    title: "Agenda",
    icon: ClipboardList,
    href: "/agenda",
  },
  {
    title: "Follow Ups",
    icon: UserCheck,
    href: "/follow-ups",
  },
  {
    title: "Fill Your Chair",
    icon: MousePointer,
    href: "/grow-your-list",
    requiresPro: true,
  },
  {
    title: "Grow with VX",
    icon: TrendingUp,
    href: "/grow-with-vx",
    requiresPro: true,
  },
  {
    title: "Inventory",
    icon: Package,
    href: "/inventory",
  },
  {
    title: "Tutorials",
    icon: PlayCircle,
    href: "/tutorials",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
  },
]

interface SidebarNavProps {
  currentPage: string
  setCurrentPage: (page: string) => void
  userData?: any
  onNavigateToSettings?: () => void
}

// Helper function to check if user is on trial
const isTrialUser = (userData?: any) => {
  return !userData?.plan || userData?.plan === 'trial'
}

export function SidebarNav({ currentPage, setCurrentPage, userData, onNavigateToSettings }: SidebarNavProps) {
  const userIsOnTrial = isTrialUser(userData)
  
  const handleNavClick = (page: string) => {
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
            const isLocked = userIsOnTrial && item.requiresPro
            const isProFeature = item.requiresPro && !userIsOnTrial
            
            return (
              <div key={item.href} className="relative">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start space-x-3",
                    isActive && "bg-primary text-primary-foreground",
                    isLocked && "opacity-75"
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
      </div>
    </div>
  )
}