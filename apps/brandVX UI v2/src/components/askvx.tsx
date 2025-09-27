import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Calendar, 
  Users, 
  Package, 
  MessageCircle,
  BarChart3,
  Target,
  Lightbulb,
  ArrowRight,
  Copy,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'

interface Message {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: Date
  suggestions?: string[]
}

const quickStartPrompts = [
  {
    icon: Calendar,
    title: "Schedule Management",
    prompt: "How do I manage my appointment schedule and set up automated reminders?"
  },
  {
    icon: Users,
    title: "Client Management", 
    prompt: "What are the best ways to track client information and service history?"
  },
  {
    icon: Package,
    title: "Inventory Tracking",
    prompt: "How can I track my product inventory and set up reorder alerts?"
  },
  {
    icon: MessageCircle,
    title: "Client Communication",
    prompt: "What are effective strategies for follow-up messages and upselling products?"
  },
  {
    icon: BarChart3,
    title: "Business Analytics",
    prompt: "How do I track my business performance and understand key metrics?"
  },
  {
    icon: Target,
    title: "Marketing Strategies",
    prompt: "What marketing automation features help grow my beauty business?"
  }
]

const sampleResponses: { [key: string]: string } = {
  "schedule": "To manage your appointment schedule effectively:\n\n📅 **Agenda Tab**: Use the beautiful planner interface to view and manage your daily appointments\n\n⏰ **Automated Reminders**: Set up SMS and email reminders 24 hours before appointments to reduce no-shows\n\n🔄 **Recurring Appointments**: Schedule regular clients with recurring booking options\n\n📱 **Mobile Sync**: Integrate with your phone calendar for seamless scheduling\n\n💡 **Pro Tip**: Use the agenda to limit yourself to 3 key tasks per day for better focus and productivity!",
  
  "clients": "Here's how to maximize your client management:\n\n👥 **Client Profiles**: Store detailed information including service history, preferences, and notes\n\n📊 **Purchase History**: Track all services and products each client has purchased\n\n🎯 **Segmentation**: Organize clients by service type, frequency, or value for targeted marketing\n\n📈 **Analytics**: Monitor client retention rates and lifetime value\n\n💌 **Automated Follow-ups**: Set up personalized messages based on last service date\n\n✨ **VIP Treatment**: Identify your top clients and create special offers just for them!",
  
  "inventory": "Optimize your product inventory with these features:\n\n📦 **Real-time Tracking**: Monitor stock levels across all your beauty products\n\n🚨 **Low Stock Alerts**: Get notified when products need reordering\n\n💰 **Profit Analysis**: Track cost vs. retail prices to maximize margins\n\n📈 **Sales Performance**: See which products are top performers\n\n🔗 **Integration Options**: Connect with Shopify, Square POS, or Acuity Scheduling\n\n🎯 **Smart Upselling**: Get AI-powered recommendations for which products to promote to specific clients",
  
  "communication": "Enhance client communication and boost sales:\n\n💬 **Automated Messages**: Set up follow-up sequences after appointments\n\n🛍️ **Product Recommendations**: Send personalized product suggestions based on services\n\n🎉 **Special Offers**: Create targeted promotions for different client segments\n\n📱 **Multi-channel**: Use both SMS and email for better reach\n\n⭐ **Review Requests**: Automatically ask satisfied clients for reviews\n\n💡 **Template Library**: Use pre-written messages that convert into sales",
  
  "analytics": "Track your business performance with key metrics:\n\n💸 **Monthly Revenue**: Monitor your income trends and growth\n\n👥 **Active Clients**: Track how many clients you're serving regularly\n\n🔄 **Client Retention**: Measure how well you're keeping clients coming back\n\n📊 **ROI Tracking**: See return on investment from your marketing efforts\n\n🎯 **Goal Setting**: Set monthly targets and track progress\n\n📈 **Growth Insights**: Identify your most profitable services and time periods",
  
  "marketing": "Leverage marketing automation to grow your business:\n\n🚀 **BrandVZN**: Use AI-powered beauty consultations to attract new clients\n\n📧 **Email Campaigns**: Set up automated sequences for different client journeys\n\n🎁 **Referral Programs**: Encourage existing clients to bring friends\n\n📱 **Social Media**: Schedule posts and track engagement\n\n🎯 **Targeted Offers**: Create personalized promotions based on client behavior\n\n💫 **Loyalty Programs**: Reward repeat clients with exclusive perks"
}

export function AskVX() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your VX Assistant, here to help you master your beauty business platform and grow your success. I can help you with scheduling, client management, inventory tracking, marketing strategies, and much more!\n\nHow can I assist you today?",
      sender: 'assistant',
      timestamp: new Date(),
      suggestions: [
        "Show me how to use the dashboard",
        "Help with client management", 
        "Explain the inventory features",
        "Marketing tips for my business"
      ]
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]')
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const response = generateResponse(content.toLowerCase())
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'assistant',
        timestamp: new Date(),
        suggestions: generateSuggestions(content.toLowerCase())
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1500)
  }

  const generateResponse = (input: string): string => {
    if (input.includes('schedule') || input.includes('appointment') || input.includes('calendar') || input.includes('agenda')) {
      return sampleResponses.schedule
    }
    if (input.includes('client') || input.includes('customer')) {
      return sampleResponses.clients
    }
    if (input.includes('inventory') || input.includes('product') || input.includes('stock')) {
      return sampleResponses.inventory
    }
    if (input.includes('message') || input.includes('communication') || input.includes('follow up')) {
      return sampleResponses.communication
    }
    if (input.includes('analytic') || input.includes('metric') || input.includes('performance') || input.includes('revenue')) {
      return sampleResponses.analytics
    }
    if (input.includes('marketing') || input.includes('grow') || input.includes('promotion')) {
      return sampleResponses.marketing
    }
    if (input.includes('dashboard') || input.includes('overview')) {
      return "Your dashboard is your command center! Here's what you'll find:\n\n🏠 **Welcome Section**: Personalized greeting with your business name\n\n📊 **Key Metrics**: Monthly revenue, active clients, retention rates, and ROI\n\n🎯 **Quick Actions**: Fast access to common tasks like scheduling and messaging\n\n📅 **Today's Agenda**: Your top 3 priorities for the day\n\n👥 **Client Highlights**: Recent activities and reminders\n\n💰 **Revenue Tracking**: Visual charts showing your business growth\n\n🚀 **Referral Program**: Earn by inviting other beauty professionals!"
    }
    if (input.includes('tier') || input.includes('pricing') || input.includes('subscription')) {
      return "We offer three tiers to match your business needs:\n\n🌟 **Basic - $97/month**:\n• Essential scheduling and client management\n• Basic analytics and messaging\n• Up to 200 clients\n\n💎 **Pro - $147/month**:\n• Everything in Basic plus:\n• Advanced analytics and automation\n• Inventory management\n• Up to 500 clients\n• Priority support\n\n👑 **Premium - $197/month**:\n• Everything in Pro plus:\n• Advanced AI features\n• Custom integrations\n• Unlimited clients\n• White-label options\n• Dedicated account manager\n\nYou can upgrade anytime as your business grows!"
    }

    return "I'd be happy to help you with that! Here are some areas I can assist you with:\n\n🎯 **Platform Features**: Dashboard navigation, settings, and tools\n\n📅 **Scheduling**: Appointment management and automated reminders\n\n👥 **Client Management**: Profiles, history, and communication\n\n📦 **Inventory**: Product tracking and upsell opportunities\n\n📊 **Analytics**: Performance metrics and business insights\n\n🚀 **Marketing**: Automation strategies and growth tips\n\n💰 **Business Growth**: Pricing strategies and retention techniques\n\nFeel free to ask about any specific feature or business challenge you're facing!"
  }

  const generateSuggestions = (input: string): string[] => {
    const suggestions = [
      "How do I set up automated reminders?",
      "What's the best way to upsell products?",
      "Show me the inventory management features",
      "Help me understand my analytics",
      "How can I improve client retention?",
      "What marketing tools are available?"
    ]
    return suggestions.slice(0, 3)
  }

  const handleQuickPrompt = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(inputValue)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black flex items-center space-x-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          <div className="p-2 bg-primary/10 rounded-full">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <span>AskVX Assistant</span>
        </h1>
        <p className="text-muted-foreground mt-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Your intelligent business companion for mastering the VX platform and growing your beauty business
        </p>
      </div>

      {/* Quick Start Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Lightbulb className="h-5 w-5 text-primary" />
            <span>Quick Start</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {quickStartPrompts.map((item, index) => {
              const IconComponent = item.icon
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start text-left h-auto p-3 hover:bg-primary/5 hover:border-primary/30"
                  onClick={() => handleQuickPrompt(item.prompt)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-primary/10 rounded">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{item.title}</div>
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <div>
        <Card className="h-[700px] flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>VX Assistant Chat</CardTitle>
                  <p className="text-sm text-muted-foreground">Ask anything about your beauty business platform</p>
                </div>
                <Badge className="ml-auto bg-green-100 text-green-700 border-green-200">
                  Online
                </Badge>
              </div>
            </CardHeader>

            <Separator />

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className="flex items-start space-x-2">
                        {message.sender === 'assistant' && (
                          <div className="p-2 bg-primary/10 rounded-full flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className={`rounded-lg p-4 ${
                          message.sender === 'user' 
                            ? 'bg-primary text-primary-foreground ml-2' 
                            : 'bg-muted'
                        }`}>
                          <div className="whitespace-pre-wrap text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {message.content}
                          </div>
                          <div className="text-xs opacity-70 mt-2">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {message.sender === 'user' && (
                          <div className="p-2 bg-accent/10 rounded-full flex-shrink-0">
                            <User className="h-4 w-4 text-accent" />
                          </div>
                        )}
                      </div>

                      {/* Suggestions */}
                      {message.suggestions && message.sender === 'assistant' && (
                        <div className="mt-3 ml-12 space-y-2">
                          <p className="text-xs text-muted-foreground">Suggested follow-ups:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.suggestions.map((suggestion, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className="text-xs h-auto py-1 px-2 border-primary/30 text-primary hover:bg-primary hover:text-white"
                                onClick={() => handleSuggestionClick(suggestion)}
                              >
                                {suggestion}
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-2">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </ScrollArea>
            </div>

            <Separator />

            {/* Input */}
            <div className="p-4 flex-shrink-0">
              <div className="flex space-x-2">
                <Input
                  placeholder="Ask me anything about your beauty business platform..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                />
                <Button 
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim() || isTyping}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Press Enter to send • This assistant provides guidance for using the VX platform
              </p>
            </div>
          </Card>
      </div>
    </div>
  )
}