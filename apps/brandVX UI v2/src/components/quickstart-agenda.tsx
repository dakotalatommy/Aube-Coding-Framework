import { CheckCircle, Circle, Clock, Sparkles, Users, TrendingUp, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useAgenda } from './agenda-context'

// Get today's date formatted beautifully
const getTodaysDate = () => {
  const today = new Date()
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric'
  }
  return today.toLocaleDateString('en-US', options)
}

interface QuickstartAgendaProps {
  onViewFullAgenda?: () => void
}

export function QuickstartAgenda({ onViewFullAgenda }: QuickstartAgendaProps) {
  const { tasks: agendaItems, toggleTaskCompletion } = useAgenda()
  const completedTasks = agendaItems.filter(item => item.completed).length
  const totalTasks = agendaItems.length

  const handleMarkComplete = (taskId: number) => {
    toggleTaskCompletion(taskId)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-black">Today's Agenda</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{getTodaysDate()}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Progress</div>
            <div className="text-lg font-semibold text-black">
              {completedTasks}/{totalTasks} Complete
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
            ></div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          {agendaItems.map((item, index) => {
            const IconComponent = item.icon
            return (
              <div 
                key={item.id} 
                className={`group relative p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                  item.completed 
                    ? 'bg-gray-50 border-gray-200 opacity-75' 
                    : 'bg-white border-gray-100 hover:border-primary/20'
                }`}
              >
                {/* Task number and completion indicator */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
                      item.completed ? 'bg-green-100' : `bg-gradient-to-br ${item.color}`
                    }`}>
                      {item.completed ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <span className="text-white font-bold text-sm">{index + 1}</span>
                      )}
                    </div>
                    {index < agendaItems.length - 1 && (
                      <div className="w-px h-8 bg-gray-200 mt-2"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Time and duration */}
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{item.time}</span>
                        <span>•</span>
                        <span>{item.duration}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="text-xs bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 text-primary"
                      >
                        {item.impact}
                      </Badge>
                    </div>
                    
                    {/* Task title and subtitle */}
                    <div className="mb-3">
                      <h4 className={`font-semibold text-black mb-1 ${
                        item.completed ? 'line-through text-gray-500' : ''
                      }`}>
                        {item.title}
                      </h4>
                      <p className={`text-sm text-muted-foreground ${
                        item.completed ? 'line-through' : ''
                      }`}>
                        {item.subtitle}
                      </p>
                    </div>
                    
                    {/* Action button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${
                          item.completed ? 'bg-gray-100' : `bg-gradient-to-br ${item.color} opacity-10`
                        }`}>
                          <IconComponent className={`h-4 w-4 ${
                            item.completed ? 'text-gray-400' : 'text-gray-700'
                          }`} />
                        </div>
                      </div>
                      
                      <Button 
                        variant={item.completed ? "outline" : "default"}
                        size="sm" 
                        className={`transition-all duration-200 ${
                          item.completed 
                            ? 'text-gray-500 hover:text-gray-700' 
                            : 'bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white shadow-md'
                        }`}
                        onClick={() => handleMarkComplete(item.id)}
                      >
                        {item.completed ? "Completed ✓" : "Mark Complete"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Motivational footer */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {completedTasks === totalTasks 
                ? "🎉 Amazing! You've completed today's agenda. Your business is growing!" 
                : `${totalTasks - completedTasks} high-impact tasks remaining to boost your business today`
              }
            </p>
            <Button 
              variant="outline" 
              className="text-primary border-primary hover:bg-primary/5"
              onClick={onViewFullAgenda}
            >
              View Full Agenda
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}