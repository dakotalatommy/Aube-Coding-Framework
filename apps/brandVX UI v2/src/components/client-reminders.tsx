import { Calendar, Bell, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { useClientReminders, getTypeIcon, getUrgencyColor } from './client-reminders-context'

// Helper function to format date relative to today
const formatRelativeDate = (date: Date): string => {
  const today = new Date()
  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays > 7 && diffDays <= 14) return "Next week"
  if (diffDays > 14) return "In 2 weeks"
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  
  return date.toLocaleDateString()
}



export function ClientReminders() {
  const { reminders, markReminderComplete } = useClientReminders()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-black flex items-center space-x-2">
          <Bell className="h-5 w-5 text-primary" />
          <span>Important Client Reminders</span>
        </CardTitle>
        <Button variant="outline" size="sm" className="text-black border-primary">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reminders.slice(0, 5).map((reminder) => {
            const IconComponent = getTypeIcon(reminder.type)
            return (
              <div key={reminder.id} className="flex items-center space-x-4 p-4 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0">
                  {reminder.avatar ? (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={reminder.avatar} />
                      <AvatarFallback>{reminder.client.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to right, #E03C91, #2F5D9F)' }}>
                      <IconComponent className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-black">{reminder.title}</h4>
                    <IconComponent className="h-4 w-4 text-primary" />
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getUrgencyColor(reminder.urgency)}`}
                    >
                      {reminder.urgency}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {reminder.description}
                  </p>
                  
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatRelativeDate(reminder.date)}</span>
                    </div>
                    <span>•</span>
                    <span>{reminder.client}</span>
                  </div>
                </div>
                
                <Button 
                  size="sm" 
                  className="text-white flex items-center space-x-1 bg-accent"
                  onClick={() => markReminderComplete(reminder.id)}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{reminder.action}</span>
                </Button>
              </div>
            )
          })}
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <div className="flex space-x-2">
            <Button className="flex-1 text-white bg-primary">
              Schedule Campaign
            </Button>
            <Button variant="outline" className="flex-1 text-accent border-accent border-2">
              Set Auto-Reminders
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}