import { Star, Phone, Mail, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const topClients = [
  {
    id: 1,
    name: "Emma Johnson",
    email: "emma@example.com",
    phone: "+1 (555) 123-4567",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100",
    totalSpent: 2840,
    visits: 12,
    rating: 5,
    lastVisit: "2 days ago",
    status: "VIP"
  },
  {
    id: 2,
    name: "Sarah Williams",
    email: "sarah@example.com",
    phone: "+1 (555) 234-5678",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    totalSpent: 1950,
    visits: 8,
    rating: 5,
    lastVisit: "1 week ago",
    status: "Regular"
  },
  {
    id: 3,
    name: "Jessica Brown",
    email: "jessica@example.com",
    phone: "+1 (555) 345-6789",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
    totalSpent: 1420,
    visits: 6,
    rating: 4,
    lastVisit: "3 days ago",
    status: "Regular"
  },
  {
    id: 4,
    name: "Michelle Davis",
    email: "michelle@example.com",
    phone: "+1 (555) 456-7890",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100",
    totalSpent: 890,
    visits: 4,
    rating: 5,
    lastVisit: "5 days ago",
    status: "New"
  },
]

export function ClientsPreview() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Top Clients</CardTitle>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topClients.map((client) => (
            <div key={client.id} className="flex items-center space-x-4 p-3 rounded-lg border">
              <Avatar>
                <AvatarImage src={client.avatar} />
                <AvatarFallback>{client.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <p className="font-medium truncate">{client.name}</p>
                  <Badge 
                    variant={client.status === 'VIP' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {client.status}
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-1 mb-1">
                  {Array.from({ length: client.rating }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({client.rating}.0)
                  </span>
                </div>
                
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <span>${client.totalSpent} spent</span>
                  <span>•</span>
                  <span>{client.visits} visits</span>
                  <span>•</span>
                  <span>{client.lastVisit}</span>
                </div>
              </div>
              
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Mail className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}