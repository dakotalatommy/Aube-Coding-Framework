// @ts-nocheck
import { Lock, Crown, Star, Zap } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'

export type TierLevel = 'basic' | 'pro' | 'premium'

interface TierSystemProps {
  currentTier: TierLevel
  requiredTier: TierLevel
  children: React.ReactNode
  featureName: string
  description?: string
  className?: string
}

const tierConfig = {
  basic: {
    name: 'Basic',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Star,
    price: '$97/month'
  },
  pro: {
    name: 'Pro',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Zap,
    price: '$147/month'
  },
  premium: {
    name: 'Premium',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: Crown,
    price: '$197/month'
  }
}

const tierHierarchy = { basic: 1, pro: 2, premium: 3 }

export function TierSystem({ 
  currentTier, 
  requiredTier, 
  children, 
  featureName, 
  description,
  className = "" 
}: TierSystemProps) {
  const hasAccess = tierHierarchy[currentTier] >= tierHierarchy[requiredTier]
  const requiredTierConfig = tierConfig[requiredTier]
  const RequiredIcon = requiredTierConfig.icon

  if (hasAccess) {
    return <div className={className}>{children}</div>
  }

  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 opacity-90"></div>
      <div className="absolute inset-0 backdrop-blur-sm"></div>
      
      <CardContent className="relative p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
        <div className="relative">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-gray-500" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-primary to-purple-500 rounded-full flex items-center justify-center">
            <RequiredIcon className="w-4 h-4 text-white" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="font-bold text-black text-lg">{featureName}</h3>
          {description && (
            <p className="text-sm text-gray-600 max-w-sm">{description}</p>
          )}
        </div>
        
        <Badge 
          variant="outline" 
          className={`${requiredTierConfig.color} flex items-center space-x-1`}
        >
          <RequiredIcon className="w-3 h-3" />
          <span>{requiredTierConfig.name} Feature</span>
        </Badge>
        
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Upgrade to unlock this feature
          </p>
          <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white">
            Upgrade to {requiredTierConfig.name} - {requiredTierConfig.price}
          </Button>
        </div>
        
        <div className="absolute top-4 right-4">
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Lock className="w-3 h-3" />
            <span>Locked</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper component for locked sidebar items
interface LockedNavItemProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  requiredTier: TierLevel
  currentTier: TierLevel
}

export function LockedNavItem({ title, icon: Icon, requiredTier, currentTier }: LockedNavItemProps) {
  const hasAccess = tierHierarchy[currentTier] >= tierHierarchy[requiredTier]
  const requiredTierConfig = tierConfig[requiredTier]
  const RequiredIcon = requiredTierConfig.icon

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className={`w-full justify-start ${!hasAccess ? 'opacity-60 cursor-not-allowed' : ''}`}
        disabled={!hasAccess}
      >
        <Icon className="mr-2 h-4 w-4" />
        {title}
        {!hasAccess && (
          <div className="ml-auto flex items-center space-x-1">
            <RequiredIcon className="w-3 h-3 text-primary" />
            <Lock className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </Button>
    </div>
  )
}