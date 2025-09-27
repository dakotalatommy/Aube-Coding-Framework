import { useState } from 'react'
import { 
  MessageSquare, 
  Users, 
  Clock, 
  Send, 
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Star,
  Calendar,
  UserCheck,
  Heart,
  Sparkles,
  Target,
  Bot,
  Schedule,
  HelpCircle,
  Smartphone,
  TrendingUp,
  Lightbulb,
  Zap,
  Award,
  Copy,
  CheckCheck,
  Loader2,
  Settings,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Search,
  MoreVertical,
  Reply,
  Archive,
  Trash2,
  Pin,
  ChevronLeft,
  Circle,
  Phone,
  Video,
  Info
} from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Alert, AlertDescription } from './ui/alert'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { ScrollArea } from './ui/scroll-area'
import { sendMessagesToSegment, isTwilioConfigured } from './twilio-service'
import { toast } from 'sonner@2.0.3'

interface MessageTemplate {
  id: string
  title: string
  category: string
  preview: string
  content: string
  recommended: boolean
  successRate?: string
  bestTime?: string
  serviceType?: string
}

interface ConversationMessage {
  id: string
  content: string
  timestamp: Date
  isFromClient: boolean
  status?: 'sent' | 'delivered' | 'read'
}

interface Conversation {
  id: string
  clientName: string
  clientPhone: string
  clientInitials: string
  clientAvatar?: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  isPinned: boolean
  messages: ConversationMessage[]
  clientInfo: {
    email?: string
    lastService?: string
    totalVisits?: number
    totalSpent?: number
    tags?: string[]
  }
}

export function Messages() {
  // Send Messages state
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedSegment, setSelectedSegment] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [messageText, setMessageText] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('sms')
  const [quietHours, setQuietHours] = useState(true)
  const [sendType, setSendType] = useState('draft')
  const [scheduleDate, setScheduleDate] = useState('')
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<any>(null)
  const [showResults, setShowResults] = useState(false)
  
  // Inbox state
  const [activeTab, setActiveTab] = useState('send')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [inboxSearchQuery, setInboxSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  
  const twilioConfigured = isTwilioConfigured()

  // Mock conversation data
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'conv-1',
      clientName: 'Emma Thompson',
      clientPhone: '+1 (555) 123-4567',
      clientInitials: 'ET',
      lastMessage: 'Thank you so much! I love how my hair turned out 💕',
      lastMessageTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      unreadCount: 0,
      isPinned: true,
      clientInfo: {
        email: 'emma.thompson@email.com',
        lastService: 'Balayage & Cut',
        totalVisits: 8,
        totalSpent: 1240,
        tags: ['VIP', 'Loyal Client']
      },
      messages: [
        {
          id: 'msg-1',
          content: 'Hi Emma! We hope you\'re loving your balayage! ✨ If you had a great experience, would you mind leaving us a quick Google review? It means the world to us!',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          isFromClient: false,
          status: 'read'
        },
        {
          id: 'msg-2',
          content: 'Of course! You did such an amazing job, I was just telling my friends about it!',
          timestamp: new Date(Date.now() - 90 * 60 * 1000),
          isFromClient: true
        },
        {
          id: 'msg-3',
          content: 'Thank you so much! I love how my hair turned out 💕',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          isFromClient: true
        }
      ]
    },
    {
      id: 'conv-2',
      clientName: 'Sarah Johnson',
      clientPhone: '+1 (555) 987-6543',
      clientInitials: 'SJ',
      lastMessage: 'Could I reschedule my appointment for next week?',
      lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      unreadCount: 2,
      isPinned: false,
      clientInfo: {
        email: 'sarah.j@email.com',
        lastService: 'Facial Treatment',
        totalVisits: 3,
        totalSpent: 340,
        tags: ['New Client']
      },
      messages: [
        {
          id: 'msg-4',
          content: 'Hi Sarah, we missed you at your appointment today! Life happens - would you like to reschedule? We have openings this week. 💖',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
          isFromClient: false,
          status: 'read'
        },
        {
          id: 'msg-5',
          content: 'I\'m so sorry! Something came up with work.',
          timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
          isFromClient: true
        },
        {
          id: 'msg-6',
          content: 'Could I reschedule my appointment for next week?',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          isFromClient: true
        }
      ]
    },
    {
      id: 'conv-3',
      clientName: 'Maria Rodriguez',
      clientPhone: '+1 (555) 456-7890',
      clientInitials: 'MR',
      lastMessage: 'YES! I\'d love to book something special for my anniversary 🥰',
      lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      unreadCount: 1,
      isPinned: false,
      clientInfo: {
        email: 'maria.rodriguez@email.com',
        lastService: 'Manicure & Pedicure',
        totalVisits: 12,
        totalSpent: 890,
        tags: ['VIP', 'Anniversary']
      },
      messages: [
        {
          id: 'msg-7',
          content: 'Hi Maria! 🏆 It\'s been an amazing year having you as part of our family! As a thank you for your incredible loyalty, enjoy our BIGGEST promotion ever - 40% off any service this month. You deserve the royal treatment! Reply YES to book your celebration appointment! ✨',
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
          isFromClient: false,
          status: 'read'
        },
        {
          id: 'msg-8',
          content: 'YES! I\'d love to book something special for my anniversary 🥰',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          isFromClient: true
        }
      ]
    },
    {
      id: 'conv-4',
      clientName: 'Jessica Chen',
      clientPhone: '+1 (555) 234-5678',
      clientInitials: 'JC',
      lastMessage: 'Perfect! See you Thursday at 2pm',
      lastMessageTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      unreadCount: 0,
      isPinned: false,
      clientInfo: {
        email: 'jessica.chen@email.com',
        lastService: 'Hair Color & Style',
        totalVisits: 6,
        totalSpent: 720,
        tags: ['Regular Client']
      },
      messages: [
        {
          id: 'msg-9',
          content: 'Hi Jessica! Ready to book your touch-up appointment? We have openings this week! ✨ Click here to book or reply with your preferred day/time.',
          timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          isFromClient: false,
          status: 'read'
        },
        {
          id: 'msg-10',
          content: 'Yes! How about Thursday afternoon?',
          timestamp: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000),
          isFromClient: true
        },
        {
          id: 'msg-11',
          content: 'Perfect! See you Thursday at 2pm',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          isFromClient: true
        }
      ]
    }
  ])

  // Client segments for smart targeting
  const clientSegments = [
    { 
      id: 'fresh-leads', 
      name: 'Fresh Leads', 
      description: 'New inquiries from website/booking',
      count: 16, 
      icon: Target,
      color: 'bg-primary',
      priority: 'high',
      tip: 'Strike while the iron is hot! New leads should be contacted within 5 minutes for best results.',
      successRate: '78%'
    },
    { 
      id: 'post-service', 
      name: '24h Post-Service', 
      description: 'Check-in & review requests',
      count: 11, 
      icon: Clock,
      color: 'bg-accent',
      priority: 'high',
      tip: 'Perfect timing for reviews! Clients are happiest 24 hours after their service.',
      successRate: '85%'
    },
    { 
      id: 'new-clients', 
      name: 'New Clients', 
      description: 'First-time guests (last 30 days)',
      count: 24, 
      icon: Star,
      color: 'bg-primary',
      priority: 'medium',
      tip: 'Build loyalty early! Welcome messages increase return visits by 40%.',
      successRate: '62%'
    },
    { 
      id: 'no-show', 
      name: 'No-Show Recovery', 
      description: 'Missed appointments to reschedule',
      count: 8, 
      icon: Calendar,
      color: 'bg-accent',
      priority: 'medium',
      tip: 'Be understanding and helpful. 60% of no-shows will reschedule with the right message.',
      successRate: '45%'
    },
    { 
      id: 'win-back', 
      name: 'Win-Back Campaign', 
      description: 'Inactive clients (45+ days)',
      count: 18, 
      icon: Heart,
      color: 'bg-secondary',
      priority: 'medium',
      tip: 'A special offer works wonders! Win-back campaigns can recover 25% of lost clients.',
      successRate: '35%'
    },
    { 
      id: 'rebooking-reminders', 
      name: 'Rebooking Reminders', 
      description: 'Clients due for their next appointment',
      count: 34, 
      icon: Calendar,
      color: 'bg-accent',
      priority: 'medium',
      tip: 'Perfect timing drives rebookings! Reach out when they need you most for 70% higher booking rates.',
      successRate: '68%'
    },
    { 
      id: 'salon-anniversary', 
      name: 'Salon Anniversary', 
      description: 'Loyal clients celebrating 12+ months',
      count: 29, 
      icon: Award,
      color: 'bg-primary',
      priority: 'low',
      tip: 'These are your most valuable clients! Show appreciation with your biggest promotions to strengthen loyalty.',
      successRate: '92%'
    },
    { 
      id: 'loyal-clients', 
      name: 'VIP Members', 
      description: 'Top loyalty tier clients',
      count: 42, 
      icon: UserCheck,
      color: 'bg-primary',
      priority: 'low',
      tip: 'Keep your best clients feeling special with exclusive offers and early access.',
      successRate: '90%'
    },
    { 
      id: 'birthday', 
      name: 'Birthday Club', 
      description: 'Celebrating this month',
      count: 12, 
      icon: Sparkles,
      color: 'bg-accent',
      priority: 'low',
      tip: 'Birthday messages have the highest open rates! Make them feel special on their day.',
      successRate: '95%'
    }
  ]

  // Message templates organized by category with AI suggestions
  const getTemplatesByAudience = (audienceId: string): MessageTemplate[] => {
    const templates: Record<string, MessageTemplate[]> = {
      'fresh-leads': [
        {
          id: 'fresh-lead-welcome',
          title: 'New Lead Welcome',
          category: 'AI Recommended',
          preview: 'Thank you for your interest in {businessName}...',
          content: 'Hi {firstName}! Thank you for your interest in {businessName}! 🌟 We\'re excited to help you look and feel amazing. Would you like to schedule a consultation? Reply YES and we\'ll send you our booking link!',
          recommended: true,
          successRate: '78%',
          bestTime: 'Within 5 minutes'
        },
        {
          id: 'lead-booking-reminder',
          title: 'Booking Reminder',
          category: 'Follow-up',
          preview: 'Ready to book your {service} appointment...',
          content: 'Hi {firstName}! Ready to book your {service} appointment? We have openings this week! ✨ Click here to book: {bookingLink} or reply with your preferred day/time.',
          recommended: false
        }
      ],
      'post-service': [
        {
          id: '24h-review-request',
          title: 'Google Review Request',
          category: 'AI Recommended',
          preview: 'Love your new look? Share your experience...',
          content: 'Hi {firstName}! We hope you\'re loving your {service}! ✨ If you had a great experience, would you mind leaving us a quick Google review? It means the world to us: {reviewLink} Reply YES if you need any help!',
          recommended: true,
          successRate: '85%',
          bestTime: '24 hours after service'
        },
        {
          id: '24h-thanks',
          title: 'Thank You & Care Instructions',
          category: 'Follow-up',
          preview: 'Hi {firstName}! Thank you for visiting us today...',
          content: 'Hi {firstName}! Thank you for visiting us today at {businessName}. Here are your aftercare instructions: {careInstructions}. If you have any questions, just reply to this message! Reply HELP for more support. 💕',
          recommended: false
        }
      ],
      'new-clients': [
        {
          id: 'first-time-welcome',
          title: 'First-Time Guest Welcome',
          category: 'AI Recommended',
          preview: 'Welcome to the {businessName} family...',
          content: 'Welcome to the {businessName} family, {firstName}! 🌟 We\'re so excited to have you. Here\'s 20% off your next service within 30 days. Use code: WELCOME20. Reply YES to book your next appointment!',
          recommended: true
        }
      ],
      'no-show': [
        {
          id: 'no-show-reschedule',
          title: 'Reschedule Request',
          category: 'AI Recommended',
          preview: 'We missed you today! Let\'s reschedule...',
          content: 'Hi {firstName}, we missed you at your appointment today! Life happens - would you like to reschedule? We have openings this week. Reply YES and we\'ll find a time that works! 💖',
          recommended: true
        }
      ],
      'win-back': [
        {
          id: 'win-back-45d',
          title: 'Win-Back Special Offer',
          category: 'AI Recommended',
          preview: 'We miss you! Special offer inside...',
          content: 'Hi {firstName}, we miss you! ✨ It\'s been a while since your last visit. Come back and enjoy 25% off any service this month. Book online or reply to schedule!',
          recommended: true
        }
      ],
      'rebooking-reminders': [
        {
          id: 'general-maintenance',
          title: 'Service Maintenance Reminder',
          category: 'AI Recommended',
          preview: 'Time for your next appointment...',
          content: 'Hi {firstName}! ✨ Hope you\'re still loving your last {service}! It\'s almost time to book your next appointment to keep looking amazing. We have openings this week - reply YES to schedule!',
          recommended: true,
          successRate: '68%',
          serviceType: 'general'
        }
      ],
      'loyal-clients': [
        {
          id: 'vip-exclusive',
          title: 'VIP Exclusive Offer',
          category: 'AI Recommended',
          preview: 'Exclusive VIP offer just for you...',
          content: 'Hi {firstName}! As one of our valued VIP members, you get first access to our new {service}. Book this week and get 15% off plus priority scheduling! Reply YES to claim your VIP spot! 💎',
          recommended: true
        }
      ],
      'salon-anniversary': [
        {
          id: 'anniversary-appreciation',
          title: 'Anniversary Appreciation',
          category: 'AI Recommended',
          preview: 'One year of beauty together! Your loyalty means everything...',
          content: 'Hi {firstName}! 🏆 It\'s been an amazing year having you as part of our {businessName} family! As a thank you for your incredible loyalty, enjoy our BIGGEST promotion ever - 40% off any service this month. You deserve the royal treatment! Reply YES to book your celebration appointment! ✨',
          recommended: true,
          successRate: '92%',
          bestTime: 'Anniversary month'
        }
      ],
      'birthday': [
        {
          id: 'birthday-offer',
          title: 'Birthday Special',
          category: 'AI Recommended',
          preview: 'Happy Birthday! Your gift awaits...',
          content: 'Happy Birthday {firstName}! 🎂✨ Your special day deserves something special. Enjoy a complimentary upgrade on any service this month. Book your birthday glow-up today! Reply YES to schedule your birthday celebration!',
          recommended: true
        }
      ]
    }
    
    return templates[audienceId] || []
  }

  const getSelectedSegment = () => {
    return clientSegments.find(s => s.id === selectedSegment)
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const templates = getTemplatesByAudience(selectedSegment)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setMessageText(template.content)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    // Use modern clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedStates(prev => ({ ...prev, [id]: true }))
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [id]: false }))
        }, 2000)
        toast.success('Message copied to clipboard')
      }).catch(err => {
        console.error('Failed to copy text: ', err)
        toast.error('Failed to copy message')
      })
    } else {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopiedStates(prev => ({ ...prev, [id]: true }))
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [id]: false }))
        }, 2000)
        toast.success('Message copied to clipboard')
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr)
        toast.error('Failed to copy message')
      }
    }
  }

  const handleSendMessages = async () => {
    if (!messageText.trim()) {
      toast.error('Please enter a message to send')
      return
    }

    if (!twilioConfigured) {
      toast.error('Please configure Twilio in Settings first')
      return
    }

    setIsSending(true)
    setSendResults(null)

    try {
      const results = await sendMessagesToSegment(selectedSegment, messageText, 'Your Beauty Studio')
      setSendResults(results)
      setShowResults(true)
      
      if (results.totalSent > 0) {
        toast.success(`Successfully sent ${results.totalSent} messages!`, {
          description: results.totalFailed > 0 ? `${results.totalFailed} messages failed to send` : 'All messages delivered'
        })
      } else {
        toast.error('No messages were sent', {
          description: 'Please check your Twilio configuration and try again'
        })
      }
    } catch (error) {
      console.error('Error sending messages:', error)
      toast.error('Failed to send messages', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleStartOver = () => {
    setCurrentStep(1)
    setSelectedSegment('')
    setSelectedTemplate('')
    setMessageText('')
    setSendResults(null)
    setShowResults(false)
    setSendType('draft')
  }

  // Inbox handlers
  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId)
    // Mark messages as read
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, unreadCount: 0 }
        : conv
    ))
  }

  const handleBackToInbox = () => {
    setSelectedConversation(null)
    setReplyText('')
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return

    setIsReplying(true)
    
    try {
      // Find the conversation
      const conversation = conversations.find(c => c.id === selectedConversation)
      if (!conversation) return

      // In a real app, this would send via Twilio
      if (twilioConfigured) {
        // Simulate sending via Twilio
        await new Promise(resolve => setTimeout(resolve, 1000))
        toast.success('Reply sent successfully!')
      } else {
        toast.success('Reply saved (Configure Twilio to send automatically)')
      }

      // Add the new message to the conversation
      const newMessage: ConversationMessage = {
        id: `msg-${Date.now()}`,
        content: replyText,
        timestamp: new Date(),
        isFromClient: false,
        status: twilioConfigured ? 'sent' : undefined
      }

      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessage: replyText,
              lastMessageTime: new Date()
            }
          : conv
      ))

      setReplyText('')
    } catch (error) {
      toast.error('Failed to send reply')
    } finally {
      setIsReplying(false)
    }
  }

  const toggleConversationPin = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, isPinned: !conv.isPinned }
        : conv
    ))
  }

  const getFilteredConversations = () => {
    let filtered = conversations

    if (inboxSearchQuery) {
      filtered = filtered.filter(conv => 
        conv.clientName.toLowerCase().includes(inboxSearchQuery.toLowerCase()) ||
        conv.lastMessage.toLowerCase().includes(inboxSearchQuery.toLowerCase()) ||
        conv.clientPhone.includes(inboxSearchQuery)
      )
    }

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
    })
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString()
  }

  const getTotalUnreadCount = () => {
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0)
  }

  const steps = [
    { number: 1, title: 'Choose Audience', description: 'Select your target clients' },
    { number: 2, title: 'Pick Template', description: 'Choose or customize message' },
    { number: 3, title: 'Review & Send', description: 'Finalize and schedule' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          Messages
        </h1>
        <p className="text-muted-foreground mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Send targeted messages and manage client conversations
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="send" className="flex items-center space-x-2">
            <Send className="h-4 w-4" />
            <span>Send Messages</span>
          </TabsTrigger>
          <TabsTrigger value="inbox" className="flex items-center space-x-2">
            <Inbox className="h-4 w-4" />
            <span>Inbox</span>
            {getTotalUnreadCount() > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                {getTotalUnreadCount()}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-6 space-y-6">
          {/* Quick Start Options */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-primary/5 border-primary/20 hover:bg-primary/10"
              onClick={() => {
                setSelectedSegment('fresh-leads')
                setCurrentStep(2)
              }}
            >
              <Zap className="h-4 w-4 mr-2" />
              Quick: Welcome New Leads
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-accent/5 border-accent/20 hover:bg-accent/10"
              onClick={() => {
                setSelectedSegment('post-service')
                setCurrentStep(2)
              }}
            >
              <Star className="h-4 w-4 mr-2" />
              Quick: Request Reviews
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-secondary/20 border-secondary/30 hover:bg-secondary/30"
              onClick={() => {
                setSelectedSegment('win-back')
                setCurrentStep(2)
              }}
            >
              <Heart className="h-4 w-4 mr-2" />
              Quick: Win Back Clients
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-accent/5 border-accent/20 hover:bg-accent/10"
              onClick={() => {
                setSelectedSegment('rebooking-reminders')
                setCurrentStep(2)
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Quick: Rebooking Reminders
            </Button>
          </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    currentStep >= step.number 
                      ? 'bg-primary border-primary text-white' 
                      : 'border-muted-foreground/30 text-muted-foreground'
                  }`}>
                    {currentStep > step.number ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="font-medium">{step.number}</span>
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`font-medium text-sm ${
                      currentStep >= step.number ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 w-16 mx-4 ${
                    currentStep > step.number ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center" style={{ fontFamily: 'Playfair Display, serif' }}>
              Step 1: Choose Your Audience
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Different client groups need different messages. We've organized them by urgency and success rate to help you prioritize.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Who would you like to send a message to? Start with high-priority segments for best results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Select Client Segment</Label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choose your target audience..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">High Priority</p>
                    {clientSegments.filter(s => s.priority === 'high').map((segment) => {
                      const IconComponent = segment.icon
                      return (
                        <SelectItem key={segment.id} value={segment.id} className="py-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-1.5 rounded-md ${segment.color} text-white`}>
                              <IconComponent className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{segment.name}</p>
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                                  {segment.successRate} success
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{segment.description} • {segment.count} clients</p>
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </div>
                  <Separator />
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Regular</p>
                    {clientSegments.filter(s => s.priority === 'medium').map((segment) => {
                      const IconComponent = segment.icon
                      return (
                        <SelectItem key={segment.id} value={segment.id} className="py-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-1.5 rounded-md ${segment.color} text-white`}>
                              <IconComponent className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="font-medium">{segment.name}</p>
                              <p className="text-xs text-muted-foreground">{segment.description} • {segment.count} clients</p>
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </div>
                  <Separator />
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Occasional</p>
                    {clientSegments.filter(s => s.priority === 'low').map((segment) => {
                      const IconComponent = segment.icon
                      return (
                        <SelectItem key={segment.id} value={segment.id} className="py-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-1.5 rounded-md ${segment.color} text-white`}>
                              <IconComponent className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="font-medium">{segment.name}</p>
                              <p className="text-xs text-muted-foreground">{segment.description} • {segment.count} clients</p>
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {selectedSegment && getSelectedSegment() && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-md ${getSelectedSegment()!.color} text-white`}>
                      {(() => {
                        const segment = getSelectedSegment()!
                        const IconComponent = segment.icon
                        return <IconComponent className="h-4 w-4" />
                      })()}
                    </div>
                    <div>
                      <p className="font-medium">{getSelectedSegment()!.name}</p>
                      <p className="text-sm text-muted-foreground">{getSelectedSegment()!.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-primary text-white">
                    {getSelectedSegment()!.count} clients
                  </Badge>
                </div>
                <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-700">{getSelectedSegment()!.tip}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleNext} 
                disabled={!selectedSegment}
                className="bg-primary hover:bg-primary/90"
              >
                Next: Pick Template
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
              Step 2: Choose Your Message Template
            </CardTitle>
            <CardDescription>
              AI-recommended templates for <span className="font-medium text-primary">{getSelectedSegment()?.name}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {getTemplatesByAudience(selectedSegment).map((template) => (
                <div
                  key={template.id}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                    selectedTemplate === template.id 
                      ? 'bg-primary/10 border-primary shadow-sm' 
                      : 'bg-card hover:bg-muted/30 border-border hover:border-primary/30'
                  }`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        {template.recommended && (
                          <div className="flex items-center space-x-1 bg-accent text-white px-2 py-1 rounded-full text-xs font-medium">
                            <Bot className="h-3 w-3" />
                            <span>AI Pick</span>
                          </div>
                        )}
                        <h4 className="font-medium">{template.title}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        {template.successRate && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {template.successRate}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {template.preview}
                    </p>
                    
                    <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border-l-2 border-primary/30 relative group">
                      <div className="pr-10">
                        {template.content}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(template.content, `template-${template.id}`)
                        }}
                      >
                        {copiedStates[`template-${template.id}`] ? (
                          <CheckCheck className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    
                    {template.bestTime && (
                      <div className="flex items-center space-x-1 text-xs text-blue-600">
                        <Clock className="h-3 w-3" />
                        <span>Best sent: {template.bestTime}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={!selectedTemplate}
                className="bg-primary hover:bg-primary/90"
              >
                Next: Review & Send
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
              Step 3: Review & Send
            </CardTitle>
            <CardDescription>
              Review your message and choose how to send it
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Message Summary */}
            <div className="p-4 bg-muted/20 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Message Summary</h4>
                <Badge className="bg-primary text-white">
                  {getSelectedSegment()?.count || 0} recipients
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">To:</span> {getSelectedSegment()?.name || 'Unknown Segment'}</p>
                <p><span className="font-medium">Template:</span> {getTemplatesByAudience(selectedSegment).find(t => t.id === selectedTemplate)?.title || 'Unknown Template'}</p>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">📱 SMS</SelectItem>
                    <SelectItem value="email">📧 Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Send Option</Label>
                <Select value={sendType} onValueChange={setSendType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">💾 Save as Draft</SelectItem>
                    <SelectItem value="now" disabled={!twilioConfigured}>
                      📤 Send Now {!twilioConfigured && '(Configure Twilio first)'}
                    </SelectItem>
                    <SelectItem value="schedule" disabled>⏰ Schedule (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Message Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Edit Your Message</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(messageText, 'main-message')}
                    disabled={!messageText.trim()}
                  >
                    {copiedStates['main-message'] ? (
                      <>
                        <CheckCheck className="h-3 w-3 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-2" />
                        Copy Message
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="min-h-[120px]"
                  placeholder="Your message will appear here..."
                />
                <p className="text-xs text-muted-foreground">
                  Variables like {'{firstName}'}, {'{businessName}'}, {'{service}'} will be personalized for each client
                </p>
              </div>
              
              {/* Mobile Preview */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  <Smartphone className="h-4 w-4 mr-2" />
                  How it looks on their phone
                </Label>
                <div className="bg-gray-900 rounded-2xl p-4 max-w-sm mx-auto lg:mx-0">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-100">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Your Business</p>
                        <p className="text-xs text-gray-500">now</p>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3 text-sm leading-relaxed">
                      {messageText.replace('{firstName}', 'Emma').replace('{businessName}', 'Your Business').replace('{service}', 'facial') || 'Your message will appear here...'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Preview shows how Emma will see your message
                </p>
              </div>
            </div>

            {/* Twilio Configuration Status */}
            {!twilioConfigured && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>Twilio SMS integration not configured. Configure in Settings to send messages directly.</span>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Twilio
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Settings Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="quiet-hours"
                checked={quietHours}
                onCheckedChange={setQuietHours}
              />
              <Label htmlFor="quiet-hours" className="text-sm">
                Respect quiet hours (9:00 PM - 8:00 AM)
              </Label>
            </div>

            {/* Send Results */}
            {showResults && sendResults && (
              <div className="space-y-4">
                <Alert className={sendResults.totalSent > 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {sendResults.totalSent > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {sendResults.totalSent > 0 
                            ? `Successfully sent ${sendResults.totalSent} messages!` 
                            : 'Failed to send messages'}
                        </span>
                        <Button variant="outline" size="sm" onClick={handleStartOver}>
                          Send More Messages
                        </Button>
                      </div>
                      {sendResults.totalFailed > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {sendResults.totalFailed} messages failed to send
                        </p>
                      )}
                      {sendResults.errors.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">View errors</summary>
                          <ul className="mt-2 space-y-1">
                            {sendResults.errors.map((error: string, index: number) => (
                              <li key={index} className="text-red-600">• {error}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Copy Message Notice - only show if not sending via Twilio */}
            {(!twilioConfigured || sendType === 'draft') && !showResults && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 rounded-full p-1">
                    <Copy className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900 mb-1">
                      Copy & Paste Ready!
                    </p>
                    <p className="text-xs text-green-700">
                      Use the "Copy Message" button above to copy your message text. You can then paste it into your preferred messaging platform or save it for later use.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Draft Notice */}
            {sendType === 'draft' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 rounded-full p-1">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Don't worry - we'll save this as a draft first!
                    </p>
                    <p className="text-xs text-blue-700">
                      Your message will be saved safely. Once your messaging is set up, you can send it with one click.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!showResults && (
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handleBack} disabled={isSending}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex space-x-3">
                  <Button variant="outline" disabled={isSending}>
                    Save Draft
                  </Button>
                  <Button 
                    className="bg-primary hover:bg-primary/90" 
                    disabled={sendType === 'draft' || !twilioConfigured || isSending}
                    onClick={handleSendMessages}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send via Twilio to {getSelectedSegment()?.count || 0} Clients
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="inbox" className="mt-6">
          {!selectedConversation ? (
            /* Inbox List View */
            <div className="space-y-4">
              {/* Search and Actions */}
              <div className="flex items-center space-x-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={inboxSearchQuery}
                    onChange={(e) => setInboxSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              </div>

              {/* Conversation List */}
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    {getFilteredConversations().length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg mb-2">No conversations yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          When clients reply to your messages, they'll appear here
                        </p>
                        <Button onClick={() => setActiveTab('send')} className="bg-primary hover:bg-primary/90">
                          Send Your First Message
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {getFilteredConversations().map((conversation) => (
                          <div
                            key={conversation.id}
                            className="flex items-center p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleConversationSelect(conversation.id)}
                          >
                            <div className="relative mr-3">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={conversation.clientAvatar} />
                                <AvatarFallback className="bg-primary text-white">
                                  {conversation.clientInitials}
                                </AvatarFallback>
                              </Avatar>
                              {conversation.unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full flex items-center justify-center">
                                  <span className="text-xs text-white">{conversation.unreadCount}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className={`font-medium truncate ${conversation.unreadCount > 0 ? 'text-black' : 'text-foreground'}`}>
                                    {conversation.clientName}
                                  </h4>
                                  {conversation.isPinned && (
                                    <Pin className="h-3 w-3 text-accent" />
                                  )}
                                  {conversation.clientInfo.tags?.map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(conversation.lastMessageTime)}
                                </span>
                              </div>
                              <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                {conversation.lastMessage}
                              </p>
                              <div className="flex items-center mt-1 space-x-2">
                                <span className="text-xs text-muted-foreground">
                                  {conversation.clientPhone}
                                </span>
                                {conversation.clientInfo.lastService && (
                                  <>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground">
                                      Last: {conversation.clientInfo.lastService}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="ml-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => toggleConversationPin(conversation.id)}>
                                    <Pin className="h-4 w-4 mr-2" />
                                    {conversation.isPinned ? 'Unpin' : 'Pin'} Conversation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Conversation Detail View */
            (() => {
              const conversation = conversations.find(c => c.id === selectedConversation)
              if (!conversation) return null

              return (
                <div className="flex flex-col h-[700px]">
                  {/* Conversation Header */}
                  <Card className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Button variant="ghost" size="sm" onClick={handleBackToInbox}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={conversation.clientAvatar} />
                            <AvatarFallback className="bg-primary text-white">
                              {conversation.clientInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-medium">{conversation.clientName}</h3>
                            <p className="text-sm text-muted-foreground">{conversation.clientPhone}</p>
                          </div>
                          {conversation.clientInfo.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Video className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Client Info */}
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Last Service</p>
                            <p className="font-medium">{conversation.clientInfo.lastService || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Visits</p>
                            <p className="font-medium">{conversation.clientInfo.totalVisits || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Spent</p>
                            <p className="font-medium">${conversation.clientInfo.totalSpent || 0}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Messages */}
                  <Card className="flex-1 flex flex-col">
                    <CardContent className="flex-1 flex flex-col p-0">
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {conversation.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.isFromClient ? 'justify-start' : 'justify-end'}`}
                            >
                              <div className={`max-w-[70%] ${message.isFromClient ? 'order-1' : 'order-2'}`}>
                                <div
                                  className={`rounded-lg p-3 ${
                                    message.isFromClient
                                      ? 'bg-muted text-foreground'
                                      : 'bg-primary text-white'
                                  }`}
                                >
                                  <p className="text-sm">{message.content}</p>
                                </div>
                                <div className={`flex items-center mt-1 text-xs text-muted-foreground ${message.isFromClient ? 'justify-start' : 'justify-end'}`}>
                                  <span>{formatTime(message.timestamp)}</span>
                                  {!message.isFromClient && message.status && (
                                    <>
                                      <span className="mx-1">•</span>
                                      <span className={message.status === 'read' ? 'text-blue-600' : 'text-muted-foreground'}>
                                        {message.status}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {/* Reply Input */}
                      <div className="border-t p-4">
                        <div className="flex items-end space-x-2">
                          <div className="flex-1">
                            <Textarea
                              placeholder="Type your reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="min-h-[40px] max-h-[120px] resize-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  handleSendReply()
                                }
                              }}
                            />
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-muted-foreground">
                                Press Enter to send, Shift+Enter for new line
                              </p>
                              {!twilioConfigured && (
                                <p className="text-xs text-amber-600">
                                  Configure Twilio to send automatically
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || isReplying}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {isReplying ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })()
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}