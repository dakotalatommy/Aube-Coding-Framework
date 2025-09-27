import { Calendar, TrendingUp, Star, Target, Clock } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'

// Get personalized greeting based on time of day
const getTimeBasedGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

// Get current day info
const getCurrentDayInfo = () => {
  const today = new Date()
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  }
  return {
    fullDate: today.toLocaleDateString('en-US', options),
    dayName: today.toLocaleDateString('en-US', { weekday: 'long' }),
    isWeekend: today.getDay() === 0 || today.getDay() === 6
  }
}

// Simulated user data - this would come from your user context/API
const userData = {
  name: "Sarah",
  businessName: "Glow Beauty Studio",
  memberSince: "March 2024",
  currentStreak: 12,
  todaysGoal: "Increase client bookings by 15%",
  nextMilestone: "50 client milestone",
  progressToMilestone: 85,
  recentAchievement: "Hit monthly revenue goal",
  profileCompleteness: 78
}

export function PersonalizedWelcome() {
  const greeting = getTimeBasedGreeting()
  const dayInfo = getCurrentDayInfo()
  
  return (
    <div className="space-y-4">
      {/* Main welcome section */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-black">
            {greeting}, {userData.name}! 
            {dayInfo.isWeekend && " 🌟"}
          </h1>
          <p className="text-muted-foreground">
            {dayInfo.isWeekend 
              ? "Hope you're having a wonderful weekend! Here's your business snapshot."
              : `Ready to make this ${dayInfo.dayName} amazing? Here's your business overview.`
            }
          </p>
          <div className="flex items-center space-x-3 mt-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Calendar className="w-3 h-3 mr-1" />
              {dayInfo.fullDate}
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <TrendingUp className="w-3 h-3 mr-1" />
              {userData.currentStreak} day streak
            </Badge>
          </div>
        </div>

        {/* Personal achievement card */}
        <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-black">Latest Achievement</span>
            </div>
            <p className="text-sm text-muted-foreground">{userData.recentAchievement}</p>
          </CardContent>
        </Card>
      </div>

      {/* Personal goals and progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Goal */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-black">Today's Goal</span>
            </div>
            <p className="text-sm text-blue-700">{userData.todaysGoal}</p>
          </CardContent>
        </Card>

        {/* Progress to Milestone */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-black">Next Milestone</span>
              </div>
              <span className="text-xs text-purple-600 font-medium">{userData.progressToMilestone}%</span>
            </div>
            <p className="text-sm text-purple-700 mb-2">{userData.nextMilestone}</p>
            <div className="w-full bg-purple-100 rounded-full h-1.5">
              <div 
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${userData.progressToMilestone}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Member Info */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-black">BVX Member</span>
            </div>
            <p className="text-sm text-green-700">Since {userData.memberSince}</p>
            <p className="text-xs text-green-600 mt-1">{userData.businessName}</p>
          </CardContent>
        </Card>
      </div>

      {/* Profile completion prompt (only show if not 100%) */}
      {userData.profileCompleteness < 100 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-medium text-black">Complete Your Profile</h4>
                  <p className="text-sm text-muted-foreground">
                    {userData.profileCompleteness}% complete - Add more details to unlock personalized insights
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-yellow-700">
                  {100 - userData.profileCompleteness}% to go
                </div>
                <div className="w-20 bg-yellow-100 rounded-full h-2 mt-1">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${userData.profileCompleteness}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}