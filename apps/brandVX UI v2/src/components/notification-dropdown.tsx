import { useState, useEffect } from 'react'
import { Bell, Clock, Users, AlertCircle, CheckCircle, Calendar, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Card, CardContent } from './ui/card'
import { Separator } from './ui/separator'

interface NotificationDropdownProps {
  onViewAgenda: () => void
}

interface NotificationItem {
  id: string
  type: 'task' | 'appointment'
  title: string
  subtitle: string
  time: string
  priority: 'High' | 'Medium' | 'Low'
  urgent: boolean
  completed?: boolean
  status?: string
}

// Sample notification data based on agenda structure
const getNotificationData = (): NotificationItem[] => {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return [
    // High priority tasks
    {
      id: '1',
      type: 'task',
      title: 'Follow up with Sarah M.',
      subtitle: 'Post-appointment care instructions',
      time: '10:00 AM',
      priority: 'High',
      urgent: true,
      completed: false
    },
    {
      id: '4',
      type: 'task', 
      title: 'Prep for Maya\'s brow treatment',
      subtitle: 'Review her allergy information',
      time: 'Tomorrow 9:30 AM',
      priority: 'High',
      urgent: true,
      completed: false
    },
    // Pending appointments
    {
      id: '3',
      type: 'appointment',
      title: 'Isabella Martinez',
      subtitle: 'Volume Lash Set - Needs confirmation',
      time: '1:00 PM',
      priority: 'High',
      urgent: true,
      status: 'pending'
    },
    // Medium priority tasks
    {
      id: '2',
      type: 'task',
      title: 'Order new lash supplies',
      subtitle: 'Restock individual lashes',
      time: '2:00 PM',
      priority: 'Medium',
      urgent: false,
      completed: false
    },
    {
      id: '5',
      type: 'task',
      title: 'Update client retention report',
      subtitle: 'Monthly analytics review',
      time: 'Tomorrow 1:00 PM',
      priority: 'Medium',
      urgent: false,
      completed: false
    }
  ]
}

export function NotificationDropdown({ onViewAgenda }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const notificationData = getNotificationData()
    // Sort by priority (High first, then urgent items)
    const sortedNotifications = notificationData.sort((a, b) => {
      // First sort by urgent status
      if (a.urgent && !b.urgent) return -1
      if (!a.urgent && b.urgent) return 1
      
      // Then by priority
      const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
    
    setNotifications(sortedNotifications.slice(0, 6)) // Limit to 6 items
    setUnreadCount(sortedNotifications.filter(n => n.urgent || n.priority === 'High').length)
  }, [])

  const getPriorityColor = (priority: string, urgent: boolean) => {
    if (urgent) return 'bg-red-500'
    switch (priority) {
      case 'High': return 'bg-red-400'
      case 'Medium': return 'bg-yellow-400'
      case 'Low': return 'bg-green-400'
      default: return 'bg-gray-400'
    }
  }

  const getTypeIcon = (type: string, priority: string, urgent: boolean) => {
    if (urgent) return AlertCircle
    if (type === 'appointment') return Calendar
    return Clock
  }

  const formatTime = (time: string) => {
    if (time.includes('Tomorrow')) {
      return time
    }
    return `Today ${time}`
  }

  const handleNotificationClick = (notification: NotificationItem) => {
    setIsOpen(false)
    onViewAgenda()
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover:bg-primary/10"
        >
          <Bell className="h-5 w-5 text-black" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-2 border-primary/20">
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Notifications
            </h3>
            <Badge variant="secondary" className="text-xs">
              {notifications.filter(n => !n.completed).length} pending
            </Badge>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            <div className="p-2">
              {notifications.map((notification, index) => {
                const IconComponent = getTypeIcon(notification.type, notification.priority, notification.urgent)
                
                return (
                  <div key={notification.id}>
                    <Card 
                      className="mb-2 cursor-pointer hover:shadow-md transition-all border-l-4 hover:border-l-primary"
                      style={{ borderLeftColor: notification.urgent ? '#E03C91' : '#E5E7EB' }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start space-x-3">
                          <div className={`p-1.5 rounded-full ${getPriorityColor(notification.priority, notification.urgent)} bg-opacity-20`}>
                            <IconComponent className={`h-4 w-4 ${getPriorityColor(notification.priority, notification.urgent).replace('bg-', 'text-')}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-black text-sm truncate">
                                {notification.title}
                              </p>
                              <div className="flex items-center space-x-1 ml-2">
                                {notification.urgent && (
                                  <Badge className="bg-red-100 text-red-700 text-xs px-1 py-0">
                                    Urgent
                                  </Badge>
                                )}
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.subtitle}
                            </p>
                            
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(notification.time)}
                                </span>
                              </div>
                              
                              <Badge 
                                variant="outline" 
                                className={`text-xs px-2 py-0 ${
                                  notification.priority === 'High' 
                                    ? 'border-red-200 text-red-700 bg-red-50' 
                                    : notification.priority === 'Medium'
                                    ? 'border-yellow-200 text-yellow-700 bg-yellow-50'
                                    : 'border-green-200 text-green-700 bg-green-50'
                                }`}
                              >
                                {notification.priority}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                All caught up! No urgent notifications.
              </p>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="p-3">
          <Button 
            variant="outline" 
            className="w-full text-primary border-primary hover:bg-primary/10"
            onClick={() => {
              setIsOpen(false)
              onViewAgenda()
            }}
          >
            <Calendar className="h-4 w-4 mr-2" />
            View Full Agenda
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}