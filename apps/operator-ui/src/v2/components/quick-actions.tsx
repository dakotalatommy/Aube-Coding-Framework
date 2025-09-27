// @ts-nocheck
import { Plus, Calendar, Users, Package, CreditCard, MessageCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const actions = [
  {
    title: "New Appointment",
    icon: Plus,
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    title: "Schedule Client",
    icon: Calendar,
    color: "bg-purple-500 hover:bg-purple-600",
  },
  {
    title: "Add Client",
    icon: Users,
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    title: "Inventory",
    icon: Package,
    color: "bg-orange-500 hover:bg-orange-600",
  },
  {
    title: "Payment",
    icon: CreditCard,
    color: "bg-pink-500 hover:bg-pink-600",
  },
  {
    title: "Messages",
    icon: MessageCircle,
    color: "bg-teal-500 hover:bg-teal-600",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-black">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {actions.map((action) => (
            <Button
              key={action.title}
              variant="ghost"
              className="h-20 flex flex-col items-center justify-center space-y-2 bg-primary hover:bg-blue-600 text-white hover:text-white transition-colors"
            >
              <action.icon className="h-6 w-6" />
              <span className="text-sm">{action.title}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}