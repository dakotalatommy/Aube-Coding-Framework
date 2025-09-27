// @ts-nocheck
import { Clock, Check, X, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'

const activities = [
  {
    id: 1,
    type: "appointment_completed",
    client: "Emma Johnson",
    service: "Facial Treatment",
    time: "2 hours ago",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100",
    status: "completed",
  },
  {
    id: 2,
    type: "new_booking",
    client: "Sarah Williams",
    service: "Hair Styling",
    time: "4 hours ago",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    status: "scheduled",
  },
  {
    id: 3,
    type: "review_received",
    client: "Jessica Brown",
    service: "Manicure",
    time: "6 hours ago",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
    status: "review",
    rating: 5,
  },
  {
    id: 4,
    type: "appointment_cancelled",
    client: "Michelle Davis",
    service: "Massage Therapy",
    time: "8 hours ago",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100",
    status: "cancelled",
  },
]

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <Check className="h-4 w-4 text-green-500" />
    case "cancelled":
      return <X className="h-4 w-4 text-red-500" />
    case "review":
      return <Star className="h-4 w-4 text-yellow-500" />
    default:
      return <Clock className="h-4 w-4 text-blue-500" />
  }
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    scheduled: "secondary",
    cancelled: "destructive",
    review: "outline",
  }
  
  return (
    <Badge variant={variants[status] || "default"}>
      {status}
    </Badge>
  )
}

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={activity.avatar} />
                <AvatarFallback>{activity.client.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="font-medium truncate">{activity.client}</p>
                  {getStatusIcon(activity.status)}
                </div>
                <p className="text-sm text-muted-foreground">{activity.service}</p>
                {activity.rating && (
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: activity.rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="text-right">
                {getStatusBadge(activity.status)}
                <p className="text-sm text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}