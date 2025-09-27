// @ts-nocheck
import { TrendingUp, Users, Calendar, Target, Clock, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

// Simulated personalized insights based on user behavior and data
const personalInsights = [
  {
    id: 1,
    type: "opportunity",
    title: "Peak Booking Window Detected",
    insight: "Your clients book most often on Tuesday evenings around 7 PM",
    action: "Schedule social posts for Tuesday at 6 PM to capture this window",
    impact: "Potential 23% booking increase",
    icon: Calendar,
    color: "from-blue-400 to-cyan-400",
    priority: "high"
  },
  {
    id: 2,
    type: "achievement",
    title: "Client Retention Superstar",
    insight: "Your retention rate is 15% higher than industry average",
    action: "Share your success story to attract similar clients",
    impact: "Brand credibility boost",
    icon: Star,
    color: "from-yellow-400 to-orange-400",
    priority: "medium"
  },
  {
    id: 3,
    type: "recommendation",
    title: "Untapped Revenue Stream",
    insight: "3 clients asked about skincare consultations this month",
    action: "Consider adding skincare consultation packages",
    impact: "Est. $800+ monthly revenue",
    icon: TrendingUp,
    color: "from-green-400 to-emerald-400",
    priority: "high"
  }
]

const getInsightIcon = (type: string) => {
  switch (type) {
    case "opportunity":
      return <Target className="w-4 h-4" />
    case "achievement":
      return <Star className="w-4 h-4" />
    case "recommendation":
      return <TrendingUp className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-700 border-red-200"
    case "medium":
      return "bg-yellow-50 text-yellow-700 border-yellow-200"
    case "low":
      return "bg-green-50 text-green-700 border-green-200"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

export function PersonalInsights() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-black flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Personal Insights</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered recommendations just for your business
            </p>
          </div>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            3 New Insights
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {personalInsights.map((insight, index) => {
          const IconComponent = insight.icon
          return (
            <div 
              key={insight.id}
              className="p-4 rounded-xl border bg-white hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start space-x-4">
                {/* Insight icon with gradient background */}
                <div className={`p-3 rounded-xl bg-gradient-to-br ${insight.color} flex items-center justify-center`}>
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                
                <div className="flex-1 space-y-3">
                  {/* Header with priority badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold text-black">{insight.title}</h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(insight.priority)}`}
                        >
                          {insight.priority} priority
                        </Badge>
                      </div>
                      {getInsightIcon(insight.type)}
                    </div>
                  </div>
                  
                  {/* Insight details */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Insight:</span> {insight.insight}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Recommended Action:</span> {insight.action}
                    </p>
                    <p className="text-sm text-primary font-medium">
                      💰 {insight.impact}
                    </p>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 pt-2">
                    <Button 
                      size="sm" 
                      className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white"
                    >
                      Take Action
                    </Button>
                    <Button variant="outline" size="sm" className="text-gray-600 hover:text-gray-800">
                      Learn More
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        
        {/* Footer with more insights link */}
        <div className="pt-4 border-t border-gray-100 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Based on your business patterns and client interactions
          </p>
          <Button variant="outline" className="text-primary border-primary hover:bg-primary/5">
            View All Insights & Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}