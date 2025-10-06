// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { 
  Users, 
  Heart,
  Star,
  Gift,
  MessageCircle,
  TrendingUp,
  Clock,
  Play,
  Pause,
  Settings,
  Eye,
  Calendar,
  CheckCircle,
  ArrowRight,
  Sparkles,
  UserPlus,
  BarChart3,
  X,
  Timer,
  Mail,
  Target
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'

// Simplified workflow templates with detailed follow-up logic and sample messages
const workflowTemplates = [
  {
    id: 1,
    name: "Welcome New Clients",
    description: "Send a warm welcome message and aftercare tips to new clients",
    icon: UserPlus,
    color: "bg-primary/5 border-primary/20",
    iconColor: "text-primary",
    active: true,
    clients: 23,
    status: "3 messages sent today",
    followUpDetails: {
      trigger: "New appointment completed",
      timeline: [
        { 
          time: "2 hours after appointment", 
          action: "Welcome message with aftercare tips", 
          frequency: "Once",
          message: "Hi [Name]! 💕 Welcome to our beauty family! Thank you for choosing us for your [Service] today. Here are some aftercare tips to help you maintain your gorgeous new look:\n\n✨ Avoid touching the area for 24 hours\n✨ Use the gentle cleanser we discussed\n✨ Apply the recommended moisturizer twice daily\n\nIf you have any questions, don't hesitate to reach out. We can't wait to see you again! 💖\n\nXOXO,\n[Your Business Name]"
        },
        { 
          time: "24 hours later", 
          action: "Check-in: 'How are you feeling?'", 
          frequency: "Once",
          message: "Hey [Name]! 🌟 Just checking in - how are you feeling after your [Service] yesterday? We hope you're absolutely loving your new look!\n\nEverything healing well? Any questions about your aftercare routine?\n\nWe'd love to hear how you're doing! Feel free to send us a selfie if you're loving the results 📸✨\n\nTalk soon!\n[Your Name]"
        },
        { 
          time: "3 days later", 
          action: "Satisfaction survey", 
          frequency: "Once",
          message: "Hi [Name]! 💖 We hope you're still glowing from your recent [Service]! We'd love to hear about your experience with us.\n\nCould you take 2 minutes to share your thoughts? Your feedback helps us keep providing amazing service to beautiful clients like you!\n\n⭐ Rate Your Experience: [Survey Link]\n\nAs a thank you, here's a special 10% discount for your next appointment: THANKYOU10\n\nWith love,\n[Your Business Name] ✨"
        },
        { 
          time: "1 week later", 
          action: "Follow-up appointment reminder", 
          frequency: "Once",
          message: "Hello gorgeous! 🌸 It's been a week since your [Service] and we hope you're still feeling fabulous!\n\nTo keep you looking your absolute best, we recommend booking your next appointment in [Timeframe]. \n\n📅 Ready to book? Reply to this message or call us at [Phone]\n💕 Mention this text for 15% off your next service!\n\nWe miss you already!\n[Your Business Name]"
        }
      ],
      totalTouchpoints: 4,
      duration: "1 week"
    }
  },
  {
    id: 2,
    name: "Check-in After Service",
    description: "Follow up 24 hours after appointments to ensure satisfaction",
    icon: Heart,
    color: "bg-accent/5 border-accent/20",
    iconColor: "text-accent",
    active: true,
    clients: 45,
    status: "2 check-ins pending",
    followUpDetails: {
      trigger: "Any appointment completed",
      timeline: [
        { 
          time: "24 hours after appointment", 
          action: "Care check-in message", 
          frequency: "Every appointment",
          message: "Hi [Name]! 💕 How are you feeling 24 hours after your [Service]? We hope you're absolutely loving the results!\n\n🌟 Any questions about your aftercare routine?\n🌟 Everything feeling comfortable?\n🌟 Need any product recommendations?\n\nWe're here if you need anything at all. Can't wait to hear how amazing you're feeling!\n\nLove,\n[Your Name] ✨"
        },
        { 
          time: "48 hours later", 
          action: "Photo request for before/after", 
          frequency: "If positive response",
          message: "Hey beautiful! 📸 We're so thrilled you're loving your [Service]! \n\nWould you mind sharing a quick photo? We love celebrating our gorgeous clients and showcasing our work (with your permission, of course!).\n\n✨ Send us your selfie and we might feature you on our page!\n✨ Plus, photo submissions get 20% off their next service!\n\nNo pressure at all - we just love seeing happy, confident clients! 💖\n\n[Your Business Name]"
        },
        { 
          time: "1 week later", 
          action: "Maintenance tips", 
          frequency: "Once per client per month",
          message: "Hello lovely! 🌸 Your [Service] should be settling in beautifully by now!\n\nHere are some pro tips to keep you looking flawless:\n\n💡 [Specific maintenance tip 1]\n💡 [Specific maintenance tip 2]\n💡 [Specific maintenance tip 3]\n\nRemember: great results come from great aftercare! You're doing amazing 💖\n\nNeed any products to help maintain your look? We've got you covered!\n\n[Your Business Name]"
        }
      ],
      totalTouchpoints: 3,
      duration: "1 week"
    }
  },
  {
    id: 3,
    name: "Birthday Surprises",
    description: "Send special birthday offers to celebrate your clients",
    icon: Gift,
    color: "bg-secondary/20 border-secondary/40",
    iconColor: "text-primary",
    active: true,
    clients: 156,
    status: "Next: Emma's birthday in 3 days",
    followUpDetails: {
      trigger: "Client birthday approaching",
      timeline: [
        { 
          time: "1 week before birthday", 
          action: "Birthday week announcement", 
          frequency: "Annual",
          message: "🎉 IT'S ALMOST YOUR BIRTHDAY WEEK, [Name]! 🎉\n\nWe can't contain our excitement! Your special day is coming up on [Date] and we want to make sure you feel absolutely GORGEOUS! 💖\n\n🎁 Something special is coming your way...\n🎁 Stay tuned for your birthday surprise!\n🎁 Get ready to be pampered like the queen you are!\n\nBirthday glam session, anyone? 👑✨\n\nWith love,\n[Your Business Name]"
        },
        { 
          time: "3 days before birthday", 
          action: "Special offer reminder", 
          frequency: "Annual",
          message: "🎂 3 MORE DAYS until your birthday, gorgeous! 🎂\n\nYour special surprise is here! 🎁\n\n✨ 30% OFF any service during your birthday week!\n✨ FREE add-on service worth $50+\n✨ Complimentary birthday photoshoot\n✨ Special birthday gift to take home!\n\nUse code: BIRTHDAY30\nValid: [Date Range]\n\n📞 Call now to book your birthday glam: [Phone]\n\nLet's make your birthday week UNFORGETTABLE! 💕\n\n[Your Business Name]"
        },
        { 
          time: "On birthday", 
          action: "Birthday wishes + discount code", 
          frequency: "Annual",
          message: "🎉🎂 HAPPY BIRTHDAY [Name]! 🎂🎉\n\nToday is YOUR day to shine even brighter than usual! ✨\n\nWe hope your day is filled with love, laughter, and all the beautiful moments you deserve! You bring so much joy to our salon family! 💖\n\n🎁 Don't forget - your special birthday offer is still waiting:\n• 30% OFF any service (Code: BIRTHDAY30)\n• Valid through [End Date]\n\nTreat yourself to something fabulous - you deserve it! 👑\n\nHappy Birthday beautiful! 🌟\n\nAll our love,\n[Your Business Name] Team"
        },
        { 
          time: "3 days after birthday", 
          action: "Last chance reminder", 
          frequency: "Annual",
          message: "Hey birthday girl! 🎈 Hope you had the most AMAZING birthday!\n\nJust a gentle reminder that your special birthday treat expires soon! 😱\n\n⏰ Last chance to use your 30% OFF birthday discount!\n⏰ Expires: [Date] (that's tomorrow!)\n⏰ Code: BIRTHDAY30\n\nDon't let this gorgeous opportunity slip away! You deserve to treat yourself after such a special celebration! 💕\n\n📞 Quick booking: [Phone]\n💻 Online: [Website]\n\nWe'd love to help you extend those birthday vibes! ✨\n\n[Your Business Name]"
        }
      ],
      totalTouchpoints: 4,
      duration: "2 weeks"
    }
  },
  {
    id: 4,
    name: "Book Next Appointment",
    description: "Service-specific reminders based on maintenance cycles",
    icon: Calendar,
    color: "bg-primary/5 border-primary/20",
    iconColor: "text-primary",
    active: false,
    clients: 67,
    status: "Ready to activate",
    followUpDetails: {
      trigger: "Service-specific maintenance timing",
      timeline: [
        { 
          time: "Service-dependent timing", 
          action: "Optimal booking reminder", 
          frequency: "Per service cycle",
          message: "**HAIR COLOR CLIENTS** (5 weeks after service):\nHi [Name]! ✨ Your gorgeous color will need a refresh soon! It's been about 5 weeks since your last appointment - perfect timing to book ahead and keep that beautiful color looking fresh! Reply YES for our next available slot.\n\n**LASH EXTENSION CLIENTS** (10 days after service):\nHey beautiful [Name]! 👁️✨ Your lash fill is coming up soon! It's been about 10 days since your last appointment - perfect timing to book ahead and keep those lashes looking flawless! Reply YES to secure your spot.\n\n**FACIAL CLIENTS** (3.5 weeks after service):\nHi [Name]! 🌟 It's been about 3.5 weeks since your last facial - perfect timing to book your next glow session ahead of time! Your skin will be ready for another dose of pampering soon. Reply YES to book!\n\n**BARBER CLIENTS** (2 weeks after service):\nWhat's up [Name]! ✂️ Your next trim is coming up soon! It's been about 2 weeks since your last cut - perfect timing to book ahead and stay looking sharp! Reply YES and I'll get you scheduled.\n\n**NAIL CLIENTS** (10 days after service):\nHi [Name]! 💅✨ Your nails will need some love soon! It's been about 10 days since your last service - perfect timing to book your maintenance appointment before any chips or growth show. Reply YES to book this week."
        },
        { 
          time: "3-5 days later", 
          action: "Incentive offer", 
          frequency: "If no response",
          message: "Hey gorgeous [Name]! 🌸 Don't let your beautiful results fade!\n\nSince it's the perfect time for your maintenance appointment, we wanted to make it extra special:\n\n✨ 15% OFF your next service\n✨ FREE add-on worth $25+\n✨ Priority booking for your favorite time slots\n\nUse code: MAINTAIN15\nValid for the next 7 days!\n\n📞 Quick booking: [Phone]\n💻 Online: [Website]\n\n**Service-Specific Benefits:**\n• Hair Color: Keep your color vibrant and rich\n• Lashes: Maintain that full, dramatic look\n• Facials: Continue your skin's transformation\n• Barber: Stay sharp and professional\n• Nails: Keep that flawless manicure\n\nLet's keep you looking amazing! 💖\n\n[Your Business Name]"
        },
        { 
          time: "4 days later", 
          action: "Final maintenance reminder", 
          frequency: "Final opportunity",
          message: "Hi [Name] 💕 Just a gentle final reminder!\n\nYour maintenance window is closing soon, and we'd hate for you to:\n\n⚠️ Hair Color: Experience fading or root growth\n⚠️ Lashes: Lose that full, beautiful look\n⚠️ Facial: Miss your skin's optimal treatment cycle\n⚠️ Barber: Let that sharp style grow out\n⚠️ Nails: Deal with chips or overgrowth\n\nYour 15% OFF offer (Code: MAINTAIN15) expires tomorrow!\n\n🎯 We have same-day appointments available\n🎯 Your favorite technician has openings\n🎯 Perfect timing to stay looking flawless\n\nNo pressure at all - we just want you to keep feeling confident and beautiful! 🌟\n\nWith love,\n[Your Business Name] Team ✨"
        }
      ],
      totalTouchpoints: 3,
      duration: "1-2 weeks (varies by service)"
    }
  },
  {
    id: 5,
    name: "Ask for Reviews",
    description: "Request reviews from happy clients to grow your reputation",
    icon: Star,
    color: "bg-accent/5 border-accent/20",
    iconColor: "text-accent",
    active: true,
    clients: 38,
    status: "5 reviews received this week",
    followUpDetails: {
      trigger: "Positive satisfaction response",
      timeline: [
        { 
          time: "3 days after positive feedback", 
          action: "Review request with direct links", 
          frequency: "Once per client per year",
          message: "Hi [Name]! 💖 We're SO happy you loved your recent [Service]!\n\nYour kind words mean the world to us! Would you mind sharing your experience online? It would help other beautiful people discover our salon! ✨\n\n⭐ Quick 2-minute review:\n📱 Google: [Google Link]\n📱 Facebook: [Facebook Link]\n📱 Yelp: [Yelp Link]\n\nAs a thank you for your time:\n🎁 10% OFF your next appointment!\n\nNo pressure at all - we just appreciate you! 💕\n\n[Your Business Name]"
        },
        { 
          time: "1 week later", 
          action: "Gentle review reminder", 
          frequency: "If no review given",
          message: "Hey beautiful! 🌟 Just a gentle reminder about that review - no pressure at all!\n\nIf you have a spare minute and loved your [Service], we'd be so grateful for a quick review! Your words help other amazing people find us! 💕\n\n⭐ Quick links:\n• Google: [Link]\n• Facebook: [Link]\n\nAnd don't forget - you still have that 10% OFF waiting for your next visit! 🎁\n\nThank you for being such an amazing client!\n\n[Your Business Name] ✨"
        },
        { 
          time: "2 weeks later", 
          action: "Referral program invitation", 
          frequency: "For clients who left reviews",
          message: "Thank you SO much for your amazing review, [Name]! 🌟 You're absolutely wonderful!\n\nSince you love sharing the love, we thought you'd be perfect for our VIP Referral Program! 💎\n\n✨ How it works:\n• Refer a friend → You BOTH get 20% OFF\n• No limit on referrals!\n• Plus earn points for future rewards\n\nYour unique referral code: [CODE]\nJust share with friends or send them this link: [Referral Link]\n\nYou're already amazing - now let's make your friends feel amazing too! 💕\n\n[Your Business Name]"
        }
      ],
      totalTouchpoints: 3,
      duration: "3 weeks"
    }
  },
  {
    id: 6,
    name: "Product Recommendations",
    description: "Share personalized product suggestions to boost retail sales",
    icon: Sparkles,
    color: "bg-secondary/20 border-secondary/40",
    iconColor: "text-primary",
    active: false,
    clients: 29,
    status: "Ready to activate",
    followUpDetails: {
      trigger: "Service-specific recommendations",
      timeline: [
        { 
          time: "1 week after appointment", 
          action: "Personalized product suggestions", 
          frequency: "After qualifying services",
          message: "Hi [Name]! 💕 Hope you're still glowing from your [Service]!\n\nBased on your service and skin/hair goals, I've curated some perfect products just for YOU:\n\n✨ [Product 1] - Perfect for [specific benefit]\n✨ [Product 2] - Will help maintain your [result]\n✨ [Product 3] - Great for your [specific concern]\n\nThese aren't just recommendations - they're specifically chosen for YOUR unique needs! 🌟\n\n💡 Want to chat about which would work best? Reply and let's discuss!\n\nXOXO,\n[Your Name]"
        },
        { 
          time: "3 days later", 
          action: "How-to tips for recommended products", 
          frequency: "Once",
          message: "Hey gorgeous! 🌸 Ready to get the most out of those product recommendations?\n\nHere are my pro tips for AMAZING results:\n\n📋 [Product 1] Usage:\n• When: [Timing]\n• How: [Application method]\n• Pro tip: [Special technique]\n\n📋 [Product 2] Usage:\n• When: [Timing]\n• How: [Application method]\n• Pro tip: [Special technique]\n\nRemember: consistency is key for beautiful results! You've got this! 💪✨\n\n[Your Business Name]"
        },
        { 
          time: "1 week later", 
          action: "Limited-time product discount", 
          frequency: "Monthly",
          message: "Last chance, [Name]! 🛍️ Your personalized products are calling!\n\nSpecial CLIENT-ONLY offer ending soon:\n\n🎉 25% OFF all your recommended products\n🎉 FREE shipping on orders over $50\n🎉 Bonus sample of our newest arrival\n\nUse code: VIP25\nExpires: [Date] (3 days!)\n\n💫 These products were chosen specifically for YOU - don't let them slip away!\n\n🛒 Shop now: [Link]\n📞 Call to order: [Phone]\n\nTreat yourself - you deserve it! 💖\n\n[Your Business Name]"
        }
      ],
      totalTouchpoints: 3,
      duration: "2 weeks"
    }
  },
  {
    id: 7,
    name: "Loyalty / VIP Rewards",
    description: "Reward loyal clients with special perks and recognition",
    icon: Star,
    active: false,
    clients: 42,
    status: "Ready to activate",
    followUpDetails: {
      trigger: "High-value clients (5+ appointments or $500+ spent)",
      timeline: [
        { 
          time: "After qualifying for VIP status", 
          action: "VIP welcome and benefits notification", 
          frequency: "Once when qualifying",
          message: "🌟 CONGRATULATIONS [Name]! You're now a VIP client! 👑\\n\\nThanks for being such a loyal client! Your continued trust in us means everything. As our VIP, you now enjoy exclusive benefits:\\n\\n✨ 15% OFF all services\\n✨ Priority booking for your favorite times\\n✨ Complimentary add-ons (worth $25+)\\n✨ Birthday month special surprises\\n✨ First access to new services & products\\n\\nYour next visit earns you a complimentary [perk/reward]! Plus, every 3rd visit gets you a special treat! 🎁\\n\\nThank you for choosing us - you're absolutely amazing! 💖\\n\\n[Your Business Name] VIP Team"
        },
        { 
          time: "Before each appointment", 
          action: "VIP treatment reminder", 
          frequency: "Every appointment",
          message: "Hey gorgeous VIP [Name]! 👑 Your appointment is coming up [Date/Time]!\\n\\nAs our valued VIP client, here's what's waiting for you:\\n\\n💎 Your 15% VIP discount is automatically applied\\n💎 Complimentary [specific add-on] included\\n💎 Reserved VIP parking spot #1\\n💎 Priority service with your favorite team member\\n\\nThis visit counts toward your loyalty rewards - you're [X] visits away from your next special surprise! 🎁\\n\\nWe can't wait to pamper you! See you soon! ✨\\n\\n[Your Business Name]"
        },
        { 
          time: "After milestone visits (every 5th)", 
          action: "Special milestone celebration", 
          frequency: "Every 5 appointments",
          message: "🎉 MILESTONE CELEBRATION, [Name]! 🎉\\n\\nThis was your [X]th visit with us as a VIP client! You're absolutely incredible and we're so grateful for your loyalty! 💕\\n\\n🏆 Your milestone reward: [Special reward/service]\\n🏆 PLUS: Extra surprise treat is on us!\\n🏆 Next milestone at [X+5] visits = [Next reward]\\n\\nYou're not just a client - you're family! Thank you for trusting us with your beauty journey. Here's to many more gorgeous moments together! ✨\\n\\nWith endless gratitude,\\n[Your Business Name] Team 👑"
        }
      ],
      totalTouchpoints: "Ongoing",
      duration: "Lifetime VIP status"
    }
  },
  {
    id: 8,
    name: "Seasonal / Holiday Campaigns",
    description: "Drive bookings during peak seasons with timely promotions",
    icon: Gift,
    active: true,
    clients: 89,
    status: "Valentine's campaign running",
    followUpDetails: {
      trigger: "Seasonal periods (Valentine's, Summer, Holidays)",
      timeline: [
        { 
          time: "6 weeks before peak season", 
          action: "Early bird seasonal announcement", 
          frequency: "3-4 times per year",
          message: "🌸 EARLY BIRD ALERT: [Season] glow-up season is coming! ✨\\n\\nHey beautiful [Name]! The most gorgeous time of year is almost here and we want to make sure you're absolutely RADIANT! 💫\\n\\n🎯 What's coming:\\n• [Season]-perfect treatments & services\\n• Limited seasonal packages\\n• Exclusive early bird pricing\\n• Prime appointment slots\\n\\n⏰ Early Bird Special (next 2 weeks only):\\n🌟 20% OFF all [seasonal services]\\n🌟 FREE seasonal add-on (worth $40)\\n🌟 Priority booking before general release\\n\\nDon't wait - spots fill up FAST during [season]! Reply YES to secure your glow-up! ✨\\n\\n[Your Business Name]"
        },
        { 
          time: "4 weeks before peak season", 
          action: "Urgency-driven booking push", 
          frequency: "Seasonal peaks",
          message: "⚡ LAST CHANCE: [Season] glow-up spots filling FAST! ⚡\\n\\nHi gorgeous [Name]! Holiday glow-up season is here ✨ Book your spot before they're gone!\\n\\n🚨 ONLY 2 WEEKS LEFT of early pricing:\\n• [Service 1]: [X] spots remaining\\n• [Service 2]: [X] spots remaining\\n• [Popular Package]: 75% BOOKED\\n\\n💥 What you're missing if you wait:\\n❌ Prime weekend slots (almost gone!)\\n❌ 20% early bird discount\\n❌ Your favorite technician's availability\\n❌ The perfect timing for [holiday/event]\\n\\n📱 Quick booking: [Link] or reply NOW\\n⏰ Early bird pricing expires [Date]\\n\\nDon't let someone else take your glow-up slot! 🌟\\n\\n[Your Business Name]"
        },
        { 
          time: "1 week before season ends", 
          action: "Last chance seasonal offer", 
          frequency: "End of each season",
          message: "⏰ FINAL WEEK: [Season] specials ending soon! ⏰\\n\\n[Name], our amazing [season] offers are almost over! Don't miss your chance to end this season looking absolutely stunning! 💖\\n\\n🎭 FINAL OPPORTUNITY:\\n• Last week for seasonal packages\\n• Final chance for [X]% OFF\\n• Only [X] appointment slots left\\n• Next availability: [Much later date]\\n\\n✨ Book this week and get:\\n🎁 Extra surprise add-on\\n🎁 Locked-in pricing for next season\\n🎁 VIP list for future early access\\n\\nThis is it - [season] magic ends [Date]! Secure your spot before we're fully booked! 🌟\\n\\n[Your Business Name]"
        }
      ],
      totalTouchpoints: 3,
      duration: "Seasonal cycles (3-4 per year)"
    }
  }
]

// Recent activity simplified
const recentActivity = [
  {
    id: 1,
    client: "Emma Rodriguez",
    action: "Received welcome message",
    time: "2 hours ago",
    type: "welcome"
  },
  {
    id: 2,
    client: "Sophia Chen",
    action: "Responded to check-in",
    time: "4 hours ago",
    type: "checkin"
  },
  {
    id: 3,
    client: "Maya Patel",
    action: "Used birthday discount",
    time: "1 day ago",
    type: "birthday"
  },
  {
    id: 4,
    client: "Isabella Martinez",
    action: "Left 5-star review",
    time: "2 days ago",
    type: "review"
  }
]

export function FollowUps() {
  const [activeWorkflows, setActiveWorkflows] = useState(
    workflowTemplates.reduce((acc, workflow) => {
      acc[workflow.id] = workflow.active
      return acc
    }, {} as Record<number, boolean>)
  )
  const [selectedWorkflow, setSelectedWorkflow] = useState<typeof workflowTemplates[0] | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({})
  const [realStats, setRealStats] = useState({
    activeWorkflows: 0,
    totalClients: 0,
    monthlyRevenueCents: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)

  const formatCurrency = (cents: number) => {
    if (!cents) return '$0'
    const dollars = cents / 100
    if (dollars >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}K`
    }
    return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const loadFollowUpStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      // Fetch total clients
      const clientsResp = await api.get('/contacts/list?limit=1', { timeoutMs: 8000 })
      const totalClients = Number(clientsResp?.total ?? 0)
      
      // Fetch revenue from metrics endpoint
      const metricsResp = await api.get('/metrics', { timeoutMs: 8000 })
      const revenueCents = Number(metricsResp?.revenue_uplift ?? 0)
      
      // Active workflows - default to 0 for now (workflows not fully built)
      const activeWorkflows = 0
      
      setRealStats({
        activeWorkflows,
        totalClients,
        monthlyRevenueCents: revenueCents
      })
    } catch (err) {
      console.error('Failed to load follow-up stats', err)
      // Keep zeros on error
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFollowUpStats()
  }, [loadFollowUpStats])

  const toggleWorkflow = (workflowId: number) => {
    setActiveWorkflows(prev => ({
      ...prev,
      [workflowId]: !prev[workflowId]
    }))
  }

  const toggleStep = (stepIndex: number) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }))
  }

  const activeCount = Object.values(activeWorkflows).filter(Boolean).length
  const totalClients = workflowTemplates.reduce((sum, w) => sum + (activeWorkflows[w.id] ? w.clients : 0), 0)

  return (
    <div className="space-y-8">
      {/* Simple Header */}
      <div>
        <h2 className="text-3xl text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          Follow Ups
        </h2>
        <p className="text-lg text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Stay connected with your clients automatically
        </p>
      </div>

      {/* Simple Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {statsLoading ? '—' : realStats.activeWorkflows}
                </p>
                <p className="text-sm text-muted-foreground">Active Workflows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-accent/10 rounded-full">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {statsLoading ? '—' : realStats.totalClients.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Clients Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-secondary/30 rounded-full">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {statsLoading ? '—' : formatCurrency(realStats.monthlyRevenueCents)}
                </p>
                <p className="text-sm text-muted-foreground">Revenue This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="workflows" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/10">
          <TabsTrigger value="workflows" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            My Workflows
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Recent Activity
          </TabsTrigger>
        </TabsList>

        {/* Simplified Workflows */}
        <TabsContent value="workflows" className="space-y-4">
          <div className="space-y-4">
            {workflowTemplates.map((workflow) => {
              const IconComponent = workflow.icon
              const isActive = activeWorkflows[workflow.id]
              
              return (
                <Card key={workflow.id} className={`transition-all hover:shadow-sm ${isActive ? 'bg-primary/5 border-primary/20' : 'bg-accent/5 border-accent/20'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      {/* Left Side - Icon and Info */}
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white rounded-full shadow-sm">
                          <IconComponent className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-accent'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-lg font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                              {workflow.name}
                            </h3>
                            {isActive && (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {workflow.description}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>{workflow.clients} clients</span>
                            <span>•</span>
                            <span>{workflow.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Controls */}
                      <div className="flex items-center space-x-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-sm"
                          onClick={() => setSelectedWorkflow(workflow)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">
                            {isActive ? 'On' : 'Off'}
                          </span>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleWorkflow(workflow.id)}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Simple Call to Action */}
          <Card className="border-dashed border-2 border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Settings className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Need Something Custom?
                  </h3>
                  <p className="text-muted-foreground mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Contact our team to create custom workflows for your specific needs
                  </p>
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                    Get Help Setting Up
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Details Dialog */}
        <Dialog open={!!selectedWorkflow} onOpenChange={() => setSelectedWorkflow(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                {selectedWorkflow && (
                  <>
                    <div className={`p-3 rounded-full ${selectedWorkflow.color}`}>
                      <selectedWorkflow.icon className={`h-6 w-6 ${selectedWorkflow.iconColor}`} />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: 'Playfair Display, serif' }}>
                        {selectedWorkflow.name}
                      </h3>
                    </div>
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedWorkflow?.description || "View workflow details and configuration"}
              </DialogDescription>
            </DialogHeader>
            
            {selectedWorkflow && (
              <div className="space-y-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="text-2xl font-bold text-primary">
                      {selectedWorkflow.followUpDetails.totalTouchpoints}
                    </div>
                    <div className="text-sm text-muted-foreground">Messages</div>
                  </div>
                  <div className="text-center p-4 bg-accent/5 rounded-lg border border-accent/20">
                    <div className="text-2xl font-bold text-accent">
                      {selectedWorkflow.followUpDetails.duration}
                    </div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/20 rounded-lg border border-secondary/40">
                    <div className="text-2xl font-bold text-black">
                      {selectedWorkflow.clients}
                    </div>
                    <div className="text-sm text-muted-foreground">Clients</div>
                  </div>
                </div>

                {/* Trigger Information */}
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-black">Workflow Trigger</span>
                  </div>
                  <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {selectedWorkflow.followUpDetails.trigger}
                  </p>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="font-semibold text-black mb-4 flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>Follow-up Timeline</span>
                    <span className="text-sm text-muted-foreground font-normal">(Click steps to see exact messages)</span>
                  </h4>
                  <div className="space-y-4">
                    {selectedWorkflow.followUpDetails.timeline.map((step, index) => (
                      <div key={index} className="border rounded-lg bg-card overflow-hidden">
                        <div 
                          className="flex items-start space-x-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => toggleStep(index)}
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Timer className="h-4 w-4 text-accent" />
                              <span className="font-medium text-black">{step.time}</span>
                              <Badge className="bg-secondary/20 text-black border-secondary/40 text-xs">
                                {step.frequency}
                              </Badge>
                            </div>
                            <div className="flex items-start space-x-2">
                              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                {step.action}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <Eye className={`h-4 w-4 transition-transform ${expandedSteps[index] ? 'rotate-180' : ''} text-primary`} />
                          </div>
                        </div>
                        
                        {/* Expandable Message Content */}
                        {expandedSteps[index] && (
                          <div className="border-t bg-muted/10 p-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <MessageCircle className="h-4 w-4 text-accent" />
                              <span className="font-medium text-black">Exact Message:</span>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-primary/20">
                              <p className="text-sm text-black whitespace-pre-line" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                {step.message}
                              </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                              <span>Message will be automatically personalized with client details</span>
                              <Badge variant="outline" className="text-xs">
                                Proven Template
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <Button variant="outline" onClick={() => setSelectedWorkflow(null)}>
                    Close
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline" className="border-accent text-accent hover:bg-accent hover:text-white">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90">
                      <Play className="h-4 w-4 mr-2" />
                      {activeWorkflows[selectedWorkflow.id] ? 'View Analytics' : 'Activate Workflow'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Simplified Activity */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>What's Happening</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {activity.type === 'welcome' && <UserPlus className="h-4 w-4 text-primary" />}
                        {activity.type === 'checkin' && <Heart className="h-4 w-4 text-accent" />}
                        {activity.type === 'birthday' && <Gift className="h-4 w-4 text-primary" />}
                        {activity.type === 'review' && <Star className="h-4 w-4 text-accent" />}
                      </div>
                      <div>
                        <p className="font-medium text-black">{activity.client}</p>
                        <p className="text-sm text-muted-foreground">{activity.action}</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
              
              {/* Empty State Helper */}
              <div className="text-center py-8 border-t mt-6">
                <p className="text-muted-foreground mb-4">
                  Activity will appear here as your workflows run
                </p>
                <Button variant="outline" size="sm">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Full Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}