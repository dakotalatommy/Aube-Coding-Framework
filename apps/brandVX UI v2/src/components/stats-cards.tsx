import { DollarSign, Users, TrendingUp, TrendingDown, Repeat, Calculator, Sparkles, Crown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const stats = [
  {
    title: "Monthly Revenue",
    value: "$18,750",
    change: "+24.8%",
    changeType: "positive" as const,
    icon: DollarSign,
    description: "vs last month",
    celebration: false,
    proFeature: false
  },
  {
    title: "Active Clients",
    value: "247",
    change: "+23",
    changeType: "positive" as const,
    icon: Users,
    description: "vs last month", 
    celebration: true,
    celebrationMessage: "New client goal achieved! 🎉",
    proFeature: false
  },
  {
    title: "Client Retention Rate",
    value: "92.8%",
    change: "+3.1%",
    changeType: "positive" as const,
    icon: Repeat,
    description: "vs last month",
    celebration: true,
    celebrationMessage: "Pro retention goals exceeded! ⭐",
    proFeature: true
  },
  {
    title: "ROI from BVX Platform",
    value: "1,247%",
    change: "+187%",
    changeType: "positive" as const,
    icon: Calculator,
    description: "vs pre-BVX average",
    celebration: false,
    proFeature: true
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <Card key={stat.title} className={stat.celebration ? "relative overflow-hidden" : ""}>
          {/* Celebration sparkle effect */}
          {stat.celebration && (
            <div className="absolute top-2 right-2 z-10">
              <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
            </div>
          )}
          
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
              <span>{stat.title}</span>
              {stat.proFeature && (
                <Crown className="h-3 w-3 text-primary" />
              )}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black">{stat.value}</div>
            <div className="flex items-center space-x-1 text-xs">
              {stat.changeType === "positive" ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={stat.changeType === "positive" ? "text-green-500" : "text-red-500"}>
                {stat.change}
              </span>
              <span className="text-muted-foreground">{stat.description}</span>
            </div>
            {/* Celebration message */}
            {stat.celebration && (
              <div className="mt-2 text-xs font-medium text-primary">
                {stat.celebrationMessage}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}