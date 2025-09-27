import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { 
  Play, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Sparkles,
  Users,
  Target,
  BarChart3,
  MessageCircle,
  Star,
  ChevronRight,
  BookOpen,
  Award,
  Zap,
  PlayCircle,
  X,
  Volume2,
  Maximize,
  Settings
} from 'lucide-react'

const LESSON_CATEGORIES = [
  {
    id: 'marketing',
    title: 'Marketing Mastery',
    icon: Target,
    color: 'bg-primary/10 text-primary',
    description: 'Learn proven marketing strategies to attract and retain clients'
  },
  {
    id: 'sales',
    title: 'Sales Excellence',
    icon: TrendingUp,
    color: 'bg-accent/10 text-accent',
    description: 'Master the art of selling and increase your revenue'
  },
  {
    id: 'operations',
    title: 'Business Operations',
    icon: BarChart3,
    color: 'bg-secondary/20 text-primary',
    description: 'Streamline your operations for maximum efficiency'
  },
  {
    id: 'growth',
    title: 'Scale & Growth',
    icon: Zap,
    color: 'bg-green-100 text-green-700',
    description: 'Strategies to scale your beauty business to new heights'
  }
]

const VIDEO_LESSONS = [
  {
    id: 1,
    title: 'Instagram Marketing for Beauty Professionals',
    category: 'marketing',
    duration: '24 min',
    releaseDate: new Date('2024-01-08'),
    isNew: true,
    isFeatured: true,
    description: 'Learn how to create engaging content that converts followers into clients',
    lessons: 6,
    views: 1247,
    rating: 4.9
  },
  {
    id: 2,
    title: 'Pricing Your Services for Maximum Profit',
    category: 'sales',
    duration: '18 min',
    releaseDate: new Date('2024-01-01'),
    isNew: false,
    isFeatured: true,
    description: 'Master the psychology of pricing and increase your service rates confidently',
    lessons: 4,
    views: 892,
    rating: 4.8
  },
  {
    id: 3,
    title: 'Client Retention Strategies That Work',
    category: 'marketing',
    duration: '31 min',
    releaseDate: new Date('2023-12-25'),
    isNew: false,
    isFeatured: false,
    description: 'Build lasting relationships that keep clients coming back',
    lessons: 7,
    views: 2156,
    rating: 4.9
  },
  {
    id: 4,
    title: 'Streamlining Your Appointment System',
    category: 'operations',
    duration: '15 min',
    releaseDate: new Date('2023-12-18'),
    isNew: false,
    isFeatured: false,
    description: 'Optimize your booking process to save time and reduce no-shows',
    lessons: 3,
    views: 734,
    rating: 4.7
  },
  {
    id: 5,
    title: 'Building a Referral Program That Scales',
    category: 'growth',
    duration: '22 min',
    releaseDate: new Date('2023-12-11'),
    isNew: false,
    isFeatured: false,
    description: 'Create a system that turns your clients into your best marketers',
    lessons: 5,
    views: 1089,
    rating: 4.8
  },
  {
    id: 6,
    title: 'Email Marketing for Beauty Businesses',
    category: 'marketing',
    duration: '28 min',
    releaseDate: new Date('2023-12-04'),
    isNew: false,
    isFeatured: false,
    description: 'Build and nurture your email list to drive consistent bookings',
    lessons: 6,
    views: 1456,
    rating: 4.9
  }
]

const UPCOMING_LESSON = {
  title: 'Social Media Content Calendar Mastery',
  category: 'marketing',
  releaseDate: new Date('2024-01-15'),
  description: 'Plan and schedule 30 days of engaging beauty content in just 2 hours',
  estimatedDuration: '26 min'
}

function GrowWithVX() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<typeof VIDEO_LESSONS[0] | null>(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const filteredLessons = VIDEO_LESSONS.filter(lesson => {
    const matchesCategory = selectedCategory === 'all' || lesson.category === selectedCategory
    const matchesSearch = lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const featuredLessons = VIDEO_LESSONS.filter(lesson => lesson.isFeatured)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getNextMonday = () => {
    const today = new Date()
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + (8 - today.getDay()) % 7 || 7)
    return nextMonday
  }

  const handleWatchNow = (lesson: typeof VIDEO_LESSONS[0]) => {
    setSelectedVideo(lesson)
    setIsVideoModalOpen(true)
  }

  const handleCloseVideo = () => {
    setIsVideoModalOpen(false)
    setSelectedVideo(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black flex items-center space-x-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          <div className="p-2 bg-primary/10 rounded-full">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <span>Grow with VX</span>
        </h1>
        <p className="text-muted-foreground mt-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Master marketing and sales strategies to scale your beauty business with our weekly video lessons
        </p>
      </div>

      {/* Next Lesson Alert */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-semibold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Next Lesson Drops Monday at 10 AM
                </h3>
                <Badge className="bg-primary text-white">Live</Badge>
              </div>
              <h4 className="font-medium mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                {UPCOMING_LESSON.title}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {UPCOMING_LESSON.description}
              </p>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>~{UPCOMING_LESSON.estimatedDuration}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(getNextMonday())}</span>
                </div>
              </div>
            </div>
            <Button className="bg-primary text-white hover:bg-primary/90">
              Set Reminder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Featured Lessons */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <Star className="h-5 w-5 text-primary" />
          <span>Featured This Week</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {featuredLessons.map((lesson) => (
            <Card key={lesson.id} className="group hover:shadow-md transition-shadow h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-14 bg-black/90 rounded-lg flex items-center justify-center group-hover:bg-primary transition-colors">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                    {lesson.isNew && (
                      <Badge className="absolute -top-2 -right-2 bg-primary text-white text-xs px-2 py-1">
                        New
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {lesson.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {lesson.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{lesson.duration}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <BookOpen className="h-4 w-4" />
                          <span>{lesson.lessons}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-current text-yellow-500" />
                          <span>{lesson.rating}</span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-primary text-white hover:bg-primary/90 ml-4"
                        onClick={() => handleWatchNow(lesson)}
                      >
                        Watch Now
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          Browse by Category
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {LESSON_CATEGORIES.map((category) => {
            const Icon = category.icon
            const categoryLessons = VIDEO_LESSONS.filter(lesson => lesson.category === category.id)
            return (
              <Card key={category.id} className="group hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-6 text-center flex flex-col h-full">
                  <div className={`inline-flex p-3 rounded-full ${category.color} mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {category.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <span>{categoryLessons.length} lessons</span>
                    <ChevronRight className="h-4 w-4 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* All Lessons */}
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          All Lessons
        </h2>
        <div className="space-y-4">
          {filteredLessons.map((lesson) => (
            <Card key={lesson.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start space-x-6">
                  <div className="relative flex-shrink-0">
                    <div className="w-24 h-16 bg-black/90 rounded-lg flex items-center justify-center group-hover:bg-primary transition-colors">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                    {lesson.isNew && (
                      <Badge className="absolute -top-2 -right-2 bg-primary text-white text-xs px-2 py-1">
                        New
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors" style={{ fontFamily: 'Playfair Display, serif' }}>
                          {lesson.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {lesson.description}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap gap-2">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{lesson.duration}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(lesson.releaseDate)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{lesson.views.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 fill-current text-yellow-500" />
                            <span>{lesson.rating}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 self-start">
                        <Button 
                          className="bg-primary text-white hover:bg-primary/90"
                          onClick={() => handleWatchNow(lesson)}
                        >
                          Watch Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex p-3 bg-primary/10 rounded-full mb-3">
                <PlayCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                {VIDEO_LESSONS.length}+
              </div>
              <p className="text-sm text-muted-foreground">Video Lessons</p>
            </div>
            <div className="text-center">
              <div className="inline-flex p-3 bg-accent/10 rounded-full mb-3">
                <Award className="h-6 w-6 text-accent" />
              </div>
              <div className="text-2xl font-bold text-accent" style={{ fontFamily: 'Playfair Display, serif' }}>
                4.8
              </div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
            </div>
            <div className="text-center">
              <div className="inline-flex p-3 bg-green-100 rounded-full mb-3">
                <TrendingUp className="h-6 w-6 text-green-700" />
              </div>
              <div className="text-2xl font-bold text-green-700" style={{ fontFamily: 'Playfair Display, serif' }}>
                New
              </div>
              <p className="text-sm text-muted-foreground">Every Monday</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Modal */}
      <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
        <DialogContent className="max-w-4xl h-[600px] p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>
              {selectedVideo?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selectedVideo?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 px-6 pb-6">
            <div className="w-full h-[400px] bg-black rounded-lg relative overflow-hidden">
              {/* Video Player Placeholder */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                <div className="text-center text-white">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Video Coming Soon
                  </h3>
                  <p className="text-gray-300 text-sm mb-4">
                    This lesson will be available on {selectedVideo && formatDate(selectedVideo.releaseDate)}
                  </p>
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{selectedVideo?.duration}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{selectedVideo?.lessons} lessons</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-white hover:bg-white/20"
                      disabled
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center space-x-2">
                      <Volume2 className="h-4 w-4 text-white" />
                      <div className="w-20 h-1 bg-white/20 rounded-full">
                        <div className="w-3/4 h-full bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-white hover:bg-white/20"
                      disabled
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-white hover:bg-white/20"
                      disabled
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Video Metadata */}
            <div className="mt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Released {selectedVideo && formatDate(selectedVideo.releaseDate)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{selectedVideo?.views.toLocaleString()} views</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-current text-yellow-500" />
                      <span>{selectedVideo?.rating} rating</span>
                    </div>
                  </div>
                </div>
                <Badge className="ml-4" variant={selectedVideo?.isNew ? "default" : "secondary"}>
                  {selectedVideo?.isNew ? "New" : "Available"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GrowWithVX