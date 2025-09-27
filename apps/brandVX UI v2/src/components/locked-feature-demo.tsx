import { TierSystem } from './tier-system'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { BarChart3, Users, Target, Zap } from 'lucide-react'

// Demo locked features to show the tier system in action
export function LockedFeatureDemo() {
  // Simulating current user is on 'basic' tier
  const currentTier = 'basic' as const

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Advanced Analytics - Pro Feature */}
      <TierSystem
        currentTier={currentTier}
        requiredTier="pro"
        featureName="Advanced Analytics"
        description="Deep insights into client behavior, revenue forecasting, and ROI optimization tools"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Advanced Analytics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* This would be the actual feature content */}
            <p>Advanced analytics content would go here...</p>
          </CardContent>
        </Card>
      </TierSystem>

      {/* AI Client Insights - Premium Feature */}
      <TierSystem
        currentTier={currentTier}
        requiredTier="premium"
        featureName="AI Client Insights"
        description="AI-powered client analysis, personalized marketing recommendations, and predictive analytics"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>AI Client Insights</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* This would be the actual feature content */}
            <p>AI insights content would go here...</p>
          </CardContent>
        </Card>
      </TierSystem>

      {/* Automated Campaigns - Pro Feature */}
      <TierSystem
        currentTier={currentTier}
        requiredTier="pro"
        featureName="Automated Campaigns"
        description="Set up complex automation workflows, A/B testing, and multi-channel campaigns"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Automated Campaigns</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* This would be the actual feature content */}
            <p>Automated campaigns content would go here...</p>
          </CardContent>
        </Card>
      </TierSystem>

      {/* VIP Client Management - Premium Feature */}
      <TierSystem
        currentTier={currentTier}
        requiredTier="premium"
        featureName="VIP Client Management"
        description="Exclusive client tiers, personalized experiences, and premium retention tools"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>VIP Client Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* This would be the actual feature content */}
            <p>VIP management content would go here...</p>
          </CardContent>
        </Card>
      </TierSystem>
    </div>
  )
}