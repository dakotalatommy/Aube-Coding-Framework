import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { Users, Sparkles, TrendingUp } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

export interface AgendaTask {
  id: number
  title: string
  subtitle: string
  time: string
  duration?: string
  impact?: string
  priority?: string
  completed: boolean
  type?: string
  icon: any
  color: string
}

interface AgendaContextType {
  tasks: AgendaTask[]
  toggleTaskCompletion: (taskId: number) => void
  addTask: (task: Omit<AgendaTask, 'id'>) => void
  updateTask: (taskId: number, updates: Partial<AgendaTask>) => void
  deleteTask: (taskId: number) => void
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined)

// Initial high-impact marketing tasks for today - only 3 per day
const initialTasks: AgendaTask[] = [
  {
    id: 1,
    title: "Send personalized follow-ups to 3 VIP clients",
    subtitle: "Boost retention with personal touch",
    time: "10:00 AM",
    duration: "15 min",
    impact: "High Revenue",
    priority: "High",
    completed: false,
    type: "client-care",
    icon: Users,
    color: "from-pink-400 to-rose-400"
  },
  {
    id: 2,
    title: "Post before/after transformation story",
    subtitle: "Showcase your amazing work",
    time: "2:00 PM", 
    duration: "10 min",
    impact: "Brand Growth",
    priority: "Medium",
    completed: false,
    type: "marketing",
    icon: Sparkles,
    color: "from-blue-400 to-cyan-400"
  },
  {
    id: 3,
    title: "Review & respond to client inquiries",
    subtitle: "Convert leads into bookings",
    time: "4:30 PM",
    duration: "20 min",
    impact: "New Revenue",
    priority: "High",
    completed: false,
    type: "growth",
    icon: TrendingUp,
    color: "from-purple-400 to-pink-400"
  }
]

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<AgendaTask[]>(initialTasks)

  const toggleTaskCompletion = (taskId: number) => {
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => {
        if (task.id === taskId) {
          const updatedTask = { ...task, completed: !task.completed }
          
          // Show celebration when task is completed
          if (updatedTask.completed) {
            const celebrationMessages = [
              "🎉 Task completed! Your business is growing!",
              "✨ Great work! Another step towards success!",
              "🚀 You're crushing it today! Keep going!",
              "💪 Productivity mode activated! Well done!",
              "🌟 Another win for your beauty business!"
            ]
            const randomMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)]
            toast.success(randomMessage)
          }
          
          return updatedTask
        }
        return task
      })
      
      // Check if all tasks are completed for monthly goal celebration
      const completedCount = updatedTasks.filter(t => t.completed).length
      const totalCount = updatedTasks.length
      
      if (completedCount === totalCount && totalCount > 0) {
        setTimeout(() => {
          toast.success("🏆 Daily goal achieved! You're building a thriving beauty business!", {
            duration: 5000
          })
        }, 500)
      }
      
      return updatedTasks
    })
  }

  const addTask = (newTask: Omit<AgendaTask, 'id'>) => {
    const id = Math.max(...tasks.map(t => t.id), 0) + 1
    setTasks(prevTasks => [...prevTasks, { ...newTask, id }])
  }

  const updateTask = (taskId: number, updates: Partial<AgendaTask>) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    )
  }

  const deleteTask = (taskId: number) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId))
  }

  return (
    <AgendaContext.Provider value={{
      tasks,
      toggleTaskCompletion,
      addTask,
      updateTask,
      deleteTask
    }}>
      {children}
    </AgendaContext.Provider>
  )
}

export function useAgenda() {
  const context = useContext(AgendaContext)
  if (context === undefined) {
    throw new Error('useAgenda must be used within an AgendaProvider')
  }
  return context
}