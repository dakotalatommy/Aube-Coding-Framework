import { useState } from 'react'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Circle, 
  Plus, 
  Users, 
  Sparkles, 
  TrendingUp, 
  Star,
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal,
  Bell,
  Edit,
  Trash2
} from 'lucide-react'
import { useAgenda } from './agenda-context'
import { useClientReminders, getTypeIcon, getUrgencyColor } from './client-reminders-context'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Calendar as CalendarComponent } from './ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

// Generate sample data for multiple days
const generateSampleData = () => {
  const today = new Date()
  const sampleData: Record<string, { appointments: any[], tasks: any[] }> = {}
  
  // Today's data
  const todayKey = today.toDateString()
  sampleData[todayKey] = {
    appointments: [
      {
        id: 1,
        client: "Emma Rodriguez",
        service: "Classic Lash Set",
        time: "9:00 AM",
        endTime: "10:30 AM",
        duration: "1h 30m",
        status: "confirmed",
        revenue: 120,
      },
      {
        id: 2,
        client: "Sophia Chen",
        service: "Lash Fill",
        time: "11:00 AM",
        endTime: "12:00 PM",
        duration: "1h",
        status: "confirmed",
        revenue: 75,
      },
      {
        id: 3,
        client: "Isabella Martinez",
        service: "Volume Lash Set",
        time: "1:00 PM",
        endTime: "3:00 PM",
        duration: "2h",
        status: "pending",
        revenue: 180,
      },
    ],
    tasks: [
      {
        id: 1,
        title: "Follow up with Sarah M.",
        subtitle: "Post-appointment care instructions",
        time: "10:00 AM",
        priority: "High",
        completed: false,
        icon: Users,
        color: "from-pink-400 to-rose-400"
      },
      {
        id: 2,
        title: "Order new lash supplies",
        subtitle: "Restock individual lashes",
        time: "2:00 PM",
        priority: "Medium",
        completed: false,
        icon: Sparkles,
        color: "from-blue-400 to-cyan-400"
      },
      {
        id: 3,
        title: "Update Instagram story",
        subtitle: "Feature today's transformations",
        time: "6:00 PM",
        priority: "Low",
        completed: true,
        icon: TrendingUp,
        color: "from-purple-400 to-pink-400"
      },
    ]
  }

  // Tomorrow's data
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toDateString()
  sampleData[tomorrowKey] = {
    appointments: [
      {
        id: 4,
        client: "Maya Patel",
        service: "Brow Lamination",
        time: "10:00 AM",
        endTime: "11:30 AM",
        duration: "1h 30m",
        status: "confirmed",
        revenue: 95,
      },
      {
        id: 5,
        client: "Aria Johnson",
        service: "Classic Lash Set",
        time: "2:00 PM",
        endTime: "3:30 PM",
        duration: "1h 30m",
        status: "confirmed",
        revenue: 120,
      },
    ],
    tasks: [
      {
        id: 4,
        title: "Prep for Maya's brow treatment",
        subtitle: "Review her allergy information",
        time: "9:30 AM",
        priority: "High",
        completed: false,
        icon: Users,
        color: "from-pink-400 to-rose-400"
      },
      {
        id: 5,
        title: "Update client retention report",
        subtitle: "Monthly analytics review",
        time: "4:00 PM",
        priority: "Medium",
        completed: false,
        icon: TrendingUp,
        color: "from-blue-400 to-cyan-400"
      },
    ]
  }

  // Day after tomorrow
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const dayAfterKey = dayAfter.toDateString()
  sampleData[dayAfterKey] = {
    appointments: [
      {
        id: 6,
        client: "Luna Wang",
        service: "Volume Lash Set",
        time: "11:00 AM",
        endTime: "1:00 PM",
        duration: "2h",
        status: "confirmed",
        revenue: 180,
      },
    ],
    tasks: [
      {
        id: 6,
        title: "Social media content planning",
        subtitle: "Plan next week's posts",
        time: "3:00 PM",
        priority: "Low",
        completed: false,
        icon: Sparkles,
        color: "from-purple-400 to-pink-400"
      },
    ]
  }

  // Yesterday (with completed items)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toDateString()
  sampleData[yesterdayKey] = {
    appointments: [
      {
        id: 7,
        client: "Zoe Davis",
        service: "Lash Removal",
        time: "10:00 AM",
        endTime: "10:30 AM",
        duration: "30m",
        status: "completed",
        revenue: 25,
      },
      {
        id: 8,
        client: "Chloe Brown",
        service: "Lash Fill",
        time: "2:00 PM",
        endTime: "3:00 PM",
        duration: "1h",
        status: "completed",
        revenue: 75,
      },
    ],
    tasks: [
      {
        id: 7,
        title: "Clean lash tools",
        subtitle: "Sanitize all equipment",
        time: "5:00 PM",
        priority: "High",
        completed: true,
        icon: Users,
        color: "from-pink-400 to-rose-400"
      },
      {
        id: 8,
        title: "Update Instagram story",
        subtitle: "Feature transformations",
        time: "6:00 PM",
        priority: "Low",
        completed: true,
        icon: Sparkles,
        color: "from-blue-400 to-cyan-400"
      },
    ]
  }

  return sampleData
}

// Get today's date formatted beautifully
const getTodaysDate = () => {
  const today = new Date()
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  }
  return today.toLocaleDateString('en-US', options)
}

export function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [activeTab, setActiveTab] = useState('today')
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  const { tasks: sharedTasks, toggleTaskCompletion } = useAgenda()
  const { reminders, getRemindersByDate, markReminderComplete } = useClientReminders()
  const sampleData = generateSampleData()
  
  // Get data for selected date including reminders
  const getDataForDate = (date: Date | undefined) => {
    if (!date) return { appointments: [], tasks: [], reminders: [] }
    const dateKey = date.toDateString()
    const today = new Date()
    
    // Get reminders for this date
    const dateReminders = getRemindersByDate(date)
    
    // If it's today, use shared tasks from context
    if (dateKey === today.toDateString()) {
      return {
        appointments: sampleData[dateKey]?.appointments || [],
        tasks: sharedTasks,
        reminders: dateReminders
      }
    }
    
    return {
      ...(sampleData[dateKey] || { appointments: [], tasks: [] }),
      reminders: dateReminders
    }
  }

  const selectedDateData = getDataForDate(selectedDate)
  const todayData = getDataForDate(new Date())
  
  const completedTasks = todayData.tasks.filter(task => task.completed).length
  const totalTasks = todayData.tasks.length
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'Low': return 'bg-green-100 text-green-700 border-green-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const toggleTaskComplete = (taskId: number, date: Date) => {
    const today = new Date()
    // If it's today's task, use the shared context
    if (date.toDateString() === today.toDateString()) {
      toggleTaskCompletion(taskId)
    } else {
      // For other dates, you'd update the task in your data store
      console.log(`Toggle task ${taskId} for date ${date.toDateString()}`)
    }
  }

  // Check if a date has events
  const dateHasEvents = (date: Date) => {
    const dateData = getDataForDate(date)
    return dateData.appointments.length > 0 || dateData.tasks.length > 0 || dateData.reminders.length > 0
  }

  return (
    <div className="space-y-6">
      {/* Header with current day and notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
            Agenda
          </h2>
          <div className="flex items-center space-x-3 mt-2">
            <p className="text-lg text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {getTodaysDate()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Today's Progress</div>
            <div className="text-lg text-black">
              {completedTasks}/{totalTasks} Tasks Complete
            </div>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Task title" />
                <Textarea placeholder="Description (optional)" />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="time" placeholder="Time" />
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-primary hover:bg-primary/90">
                    Add Task
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-secondary/20 rounded-full h-3">
        <div 
          className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-500"
          style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
        ></div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/10">
          <TabsTrigger value="today" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Today's Schedule
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Calendar View
          </TabsTrigger>
        </TabsList>

        {/* Today's Schedule */}
        <TabsContent value="today" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span>Appointments</span>
                  <Badge className="bg-primary/10 text-primary">
                    {todayData.appointments.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {todayData.appointments.length > 0 ? (
                  todayData.appointments.map((appointment) => (
                    <div key={appointment.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{appointment.time}</span>
                          <span className="text-muted-foreground">- {appointment.endTime}</span>
                        </div>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="font-semibold text-black">{appointment.client}</h4>
                        <p className="text-sm text-muted-foreground">{appointment.service}</p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm text-muted-foreground">{appointment.duration}</span>
                          <span className="font-semibold text-primary">${appointment.revenue}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No appointments today</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Priority Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-accent" />
                  <span>Priority Tasks</span>
                  <Badge className="bg-accent/10 text-accent">
                    {todayData.tasks.filter(t => !t.completed).length} remaining
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {todayData.tasks.length > 0 ? (
                  todayData.tasks.map((task) => {
                    const IconComponent = task.icon
                    return (
                      <div 
                        key={task.id} 
                        className={`p-4 rounded-lg border transition-all duration-200 ${
                          task.completed 
                            ? 'bg-gray-50 border-gray-200 opacity-75' 
                            : 'bg-card border-gray-200 hover:border-primary/20 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => toggleTaskComplete(task.id, new Date())}
                          >
                            {task.completed ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                            )}
                          </Button>
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{task.time}</span>
                                <Badge className={getPriorityColor(task.priority)}>
                                  {task.priority}
                                </Badge>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className={`font-medium text-black ${
                                task.completed ? 'line-through text-gray-500' : ''
                              }`}>
                                {task.title}
                              </h4>
                              <p className={`text-sm text-muted-foreground ${
                                task.completed ? 'line-through' : ''
                              }`}>
                                {task.subtitle}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No tasks for today</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-6">
          {/* Enhanced Calendar */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
              <CardTitle className="text-center text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
                Schedule Calendar
              </CardTitle>
              <p className="text-center text-sm text-muted-foreground">
                Click on any date to view appointments and tasks
              </p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex justify-center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-lg border border-border/50 shadow-sm bg-card p-4"
                  classNames={{
                    months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4 w-full",
                    caption: "flex justify-center pt-1 relative items-center mb-4",
                    caption_label: "text-lg font-semibold text-black",
                    nav: "space-x-1 flex items-center",
                    nav_button: "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-primary/20 bg-background hover:bg-primary hover:text-white hover:border-primary h-8 w-8",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse",
                    head_row: "flex mb-2",
                    head_cell: "text-muted-foreground rounded-md w-12 h-12 font-semibold text-sm flex items-center justify-center",
                    row: "flex w-full mb-1",
                    cell: "relative p-0 text-center focus-within:relative focus-within:z-20 w-12 h-12",
                    day: "h-12 w-12 p-0 font-medium inline-flex items-center justify-center rounded-lg text-sm transition-all hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold shadow-md",
                    day_today: "bg-accent/30 text-accent-foreground font-bold border-2 border-accent",
                    day_outside: "text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-30",
                    day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    day_hidden: "invisible",
                  }}
                  modifiers={{
                    hasEvents: (date) => dateHasEvents(date)
                  }}
                  modifiersClassNames={{
                    hasEvents: "bg-secondary/40 border border-primary/30 font-semibold"
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'Select a date'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {selectedDate ? (
                selectedDateData.appointments.length > 0 || selectedDateData.tasks.length > 0 || selectedDateData.reminders.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Appointments for selected date */}
                    <div>
                      <h4 className="font-semibold text-black mb-4 flex items-center space-x-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>Appointments</span>
                        <Badge className="bg-primary/10 text-primary">
                          {selectedDateData.appointments.length}
                        </Badge>
                      </h4>
                      <div className="space-y-3">
                        {selectedDateData.appointments.length > 0 ? (
                          selectedDateData.appointments.map((appointment) => (
                            <div key={appointment.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{appointment.time}</span>
                                  <span className="text-muted-foreground">- {appointment.endTime}</span>
                                </div>
                                <Badge className={getStatusColor(appointment.status)}>
                                  {appointment.status}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <h5 className="font-medium text-black">{appointment.client}</h5>
                                <p className="text-sm text-muted-foreground">{appointment.service}</p>
                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-sm text-muted-foreground">{appointment.duration}</span>
                                  <span className="font-semibold text-primary">${appointment.revenue}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-muted-foreground py-6">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No appointments scheduled</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tasks for selected date */}
                    <div>
                      <h4 className="font-semibold text-black mb-4 flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-accent" />
                        <span>Tasks</span>
                        <Badge className="bg-accent/10 text-accent">
                          {selectedDateData.tasks.filter(t => !t.completed).length} pending
                        </Badge>
                      </h4>
                      <div className="space-y-3">
                        {selectedDateData.tasks.length > 0 ? (
                          selectedDateData.tasks.map((task) => {
                            const IconComponent = task.icon
                            return (
                              <div key={task.id} className={`p-4 rounded-lg border transition-all ${
                                task.completed 
                                  ? 'bg-gray-50 border-gray-200 opacity-75' 
                                  : 'bg-card hover:shadow-sm'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{task.time}</span>
                                    <Badge className={getPriorityColor(task.priority)}>
                                      {task.priority}
                                    </Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-0 h-auto"
                                    onClick={() => toggleTaskComplete(task.id, selectedDate)}
                                  >
                                    {task.completed ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                    )}
                                  </Button>
                                </div>
                                <div className="flex items-start space-x-3">
                                  <div className={`p-2 rounded-md ${
                                    task.completed ? 'bg-gray-100' : `bg-gradient-to-br ${task.color} opacity-20`
                                  }`}>
                                    <IconComponent className="h-4 w-4 text-gray-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className={`font-medium text-black ${
                                      task.completed ? 'line-through text-gray-500' : ''
                                    }`}>
                                      {task.title}
                                    </h5>
                                    <p className={`text-sm text-muted-foreground ${
                                      task.completed ? 'line-through' : ''
                                    }`}>
                                      {task.subtitle}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="text-center text-muted-foreground py-6">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No tasks scheduled</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Client Reminders for selected date */}
                    <div>
                      <h4 className="font-semibold text-black mb-4 flex items-center space-x-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <span>Client Reminders</span>
                        <Badge className="bg-primary/10 text-primary">
                          {selectedDateData.reminders.filter(r => !r.completed).length} pending
                        </Badge>
                      </h4>
                      <div className="space-y-3">
                        {selectedDateData.reminders.length > 0 ? (
                          selectedDateData.reminders.map((reminder) => {
                            const IconComponent = getTypeIcon(reminder.type)
                            return (
                              <div key={reminder.id} className={`p-4 rounded-lg border transition-all ${
                                reminder.completed 
                                  ? 'bg-gray-50 border-gray-200 opacity-75' 
                                  : 'bg-card hover:shadow-sm'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <IconComponent className="h-4 w-4 text-primary" />
                                    <Badge className={getUrgencyColor(reminder.urgency)}>
                                      {reminder.urgency}
                                    </Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-0 h-auto"
                                    onClick={() => markReminderComplete(reminder.id)}
                                  >
                                    {reminder.completed ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                    )}
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  <h5 className={`font-medium text-black ${
                                    reminder.completed ? 'line-through text-gray-500' : ''
                                  }`}>
                                    {reminder.title}
                                  </h5>
                                  <p className={`text-sm text-muted-foreground ${
                                    reminder.completed ? 'line-through' : ''
                                  }`}>
                                    {reminder.description}
                                  </p>
                                  <div className="flex items-center justify-between pt-2">
                                    <span className="text-sm text-muted-foreground font-medium">{reminder.client}</span>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="text-xs h-6 px-2 border-primary/30 text-primary hover:bg-primary/10"
                                      onClick={() => markReminderComplete(reminder.id)}
                                    >
                                      {reminder.action}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="text-center text-muted-foreground py-6">
                            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No reminders for this date</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <h4 className="font-medium text-black mb-2">No Events Scheduled</h4>
                    <p className="text-sm">This date has no appointments, tasks, or client reminders scheduled</p>
                    <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h4 className="font-medium text-black mb-2">Select a Date</h4>
                  <p className="text-sm">Choose a date from the calendar to view appointments, tasks, and client reminders</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}