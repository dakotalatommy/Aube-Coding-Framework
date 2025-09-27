// @ts-nocheck
import { Clock, MapPin, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

const todayAppointments = [
  {
    id: 1,
    client: "Emma Johnson",
    service: "Deep Cleansing Facial",
    time: "9:00 AM",
    duration: "60 min",
    status: "confirmed",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100",
    phone: "+1 (555) 123-4567",
  },
  {
    id: 2,
    client: "Sarah Williams",
    service: "Balayage & Style",
    time: "11:30 AM",
    duration: "120 min",
    status: "in-progress",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    phone: "+1 (555) 234-5678",
  },
  {
    id: 3,
    client: "Jessica Brown",
    service: "Gel Manicure",
    time: "2:00 PM",
    duration: "45 min",
    status: "confirmed",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
    phone: "+1 (555) 345-6789",
  },
  {
    id: 4,
    client: "Michelle Davis",
    service: "Relaxing Massage",
    time: "4:30 PM",
    duration: "90 min",
    status: "pending",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100",
    phone: "+1 (555) 456-7890",
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "bg-green-500"
    case "in-progress":
      return "bg-blue-500"
    case "pending":
      return "bg-yellow-500"
    default:
      return "bg-gray-500"
  }
}

export function AppointmentsPreview() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Today's Appointments</CardTitle>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {todayAppointments.map((appointment) => (
            <div key={appointment.id} className="flex items-center space-x-4 p-3 rounded-lg border">
              <div className="relative">
                <Avatar>
                  <AvatarImage src={appointment.avatar} />
                  <AvatarFallback>{appointment.client.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${getStatusColor(appointment.status)}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <p className="font-medium truncate">{appointment.client}</p>
                  <Badge variant="outline" className="text-xs">
                    {appointment.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{appointment.service}</p>
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{appointment.time}</span>
                  </div>
                  <span>•</span>
                  <span>{appointment.duration}</span>
                </div>
              </div>
              
              <Button variant="ghost" size="icon">
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}