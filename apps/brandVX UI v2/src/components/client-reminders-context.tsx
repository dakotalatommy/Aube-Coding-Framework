import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Gift, Heart, Sparkles, Calendar as CalendarIcon } from 'lucide-react'

export interface ClientReminder {
  id: number
  type: 'birthday' | 'anniversary' | 'holiday' | 'follow-up'
  title: string
  description: string
  date: Date
  urgency: 'high' | 'medium' | 'low'
  avatar?: string
  client: string
  action: string
  completed?: boolean
}

interface ClientRemindersContextType {
  reminders: ClientReminder[]
  addReminder: (reminder: Omit<ClientReminder, 'id'>) => void
  updateReminder: (id: number, updates: Partial<ClientReminder>) => void
  deleteReminder: (id: number) => void
  markReminderComplete: (id: number) => void
  getRemindersByDate: (date: Date) => ClientReminder[]
}

const ClientRemindersContext = createContext<ClientRemindersContextType | undefined>(undefined)

// Initial client reminders with specific dates
const generateInitialReminders = (): ClientReminder[] => {
  const today = new Date()
  
  // Tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // In 3 days
  const in3Days = new Date(today)
  in3Days.setDate(in3Days.getDate() + 3)
  
  // In 5 days
  const in5Days = new Date(today)
  in5Days.setDate(in5Days.getDate() + 5)
  
  // Next week (7 days)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  
  // In 2 weeks
  const in2Weeks = new Date(today)
  in2Weeks.setDate(in2Weeks.getDate() + 14)

  return [
    {
      id: 1,
      type: "birthday",
      title: "Emma Johnson's Birthday",
      description: "Send birthday wishes + 20% off promo",
      date: tomorrow,
      urgency: "high",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100",
      client: "Emma Johnson",
      action: "Send Text",
      completed: false
    },
    {
      id: 2,
      type: "anniversary",
      title: "2-Year Client Anniversary",
      description: "Sarah Williams - loyal customer milestone",
      date: in3Days,
      urgency: "medium",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
      client: "Sarah Williams",
      action: "Send Text",
      completed: false
    },
    {
      id: 3,
      type: "holiday",
      title: "Valentine's Day Promotion",
      description: "Send couples spa package deals",
      date: in5Days,
      urgency: "high",
      client: "All Clients",
      action: "Broadcast",
      completed: false
    },
    {
      id: 4,
      type: "birthday",
      title: "Jessica Brown's Birthday",
      description: "VIP client - send personalized offer",
      date: nextWeek,
      urgency: "medium",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
      client: "Jessica Brown",
      action: "Send Text",
      completed: false
    },
    {
      id: 5,
      type: "holiday",
      title: "Spring Break Prep Campaign",
      description: "Target younger demographics with glow-up packages",
      date: in2Weeks,
      urgency: "low",
      client: "Targeted List",
      action: "Campaign",
      completed: false
    }
  ]
}

export function ClientRemindersProvider({ children }: { children: ReactNode }) {
  const [reminders, setReminders] = useState<ClientReminder[]>(generateInitialReminders())

  const addReminder = (newReminder: Omit<ClientReminder, 'id'>) => {
    const id = Math.max(...reminders.map(r => r.id), 0) + 1
    setReminders(prevReminders => [...prevReminders, { ...newReminder, id }])
  }

  const updateReminder = (id: number, updates: Partial<ClientReminder>) => {
    setReminders(prevReminders =>
      prevReminders.map(reminder =>
        reminder.id === id ? { ...reminder, ...updates } : reminder
      )
    )
  }

  const deleteReminder = (id: number) => {
    setReminders(prevReminders => prevReminders.filter(reminder => reminder.id !== id))
  }

  const markReminderComplete = (id: number) => {
    setReminders(prevReminders =>
      prevReminders.map(reminder =>
        reminder.id === id ? { ...reminder, completed: true } : reminder
      )
    )
  }

  const getRemindersByDate = (date: Date) => {
    const dateStr = date.toDateString()
    return reminders.filter(reminder => reminder.date.toDateString() === dateStr)
  }

  return (
    <ClientRemindersContext.Provider value={{
      reminders,
      addReminder,
      updateReminder,
      deleteReminder,
      markReminderComplete,
      getRemindersByDate
    }}>
      {children}
    </ClientRemindersContext.Provider>
  )
}

export function useClientReminders() {
  const context = useContext(ClientRemindersContext)
  if (context === undefined) {
    throw new Error('useClientReminders must be used within a ClientRemindersProvider')
  }
  return context
}

export const getTypeIcon = (type: string) => {
  switch (type) {
    case "birthday":
      return Gift
    case "anniversary":
      return Heart
    case "holiday":
      return Sparkles
    default:
      return CalendarIcon
  }
}

export const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "low":
      return "bg-green-100 text-green-800 border-green-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}