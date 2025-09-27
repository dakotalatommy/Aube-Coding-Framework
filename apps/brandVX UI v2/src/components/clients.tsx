import { useState } from 'react'
import { 
  Users, 
  Upload, 
  Download, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Star,
  Clock,
  Target,
  UserCheck,
  Heart,
  Sparkles,
  Award,
  TrendingUp,
  RefreshCw,
  Settings,
  FileText,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { Progress } from './ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

export function Clients() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSegment, setSelectedSegment] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [lastSyncTime, setLastSyncTime] = useState('2 hours ago')
  const [connectedPlatform, setConnectedPlatform] = useState('square') // 'square' or 'acuity'

  // Client segments using beauty industry language
  const clientSegments = [
    { 
      id: 'leads', 
      name: 'Leads (Not Booked Yet)', 
      count: 16, 
      icon: Target, 
      color: 'bg-primary',
      description: 'New inquiries and consultations'
    },
    { 
      id: 'new-clients', 
      name: 'New Clients', 
      count: 24, 
      icon: Star, 
      color: 'bg-primary',
      description: 'First-time guests (last 30 days)'
    },
    { 
      id: 'returning-clients', 
      name: 'Returning Clients', 
      count: 34, 
      icon: Calendar, 
      color: 'bg-accent',
      description: 'Regular clients ready to rebook'
    },
    { 
      id: 'vip-clients', 
      name: 'VIP Clients', 
      count: 42, 
      icon: UserCheck, 
      color: 'bg-primary',
      description: 'Your most loyal clients'
    },
    { 
      id: 'inactive-clients', 
      name: 'Inactive Clients', 
      count: 18, 
      icon: Heart, 
      color: 'bg-secondary',
      description: 'Haven\'t visited in 30+ days'
    }
  ]

  // Smart lists - prebuilt shortcuts
  const smartLists = [
    { 
      id: 'no-shows', 
      name: 'No-Shows', 
      count: 8, 
      icon: AlertCircle, 
      description: 'Missed appointments this week'
    },
    { 
      id: 'rebook-checkout', 
      name: 'Rebooked at Checkout', 
      count: 23, 
      icon: CheckCircle, 
      description: 'Already scheduled next visit'
    },
    { 
      id: 'birthday-month', 
      name: 'Birthday Month', 
      count: 12, 
      icon: Sparkles, 
      description: 'Celebrating this month'
    },
    { 
      id: 'referral-sources', 
      name: 'Referral Sources', 
      count: 31, 
      icon: Users, 
      description: 'Clients who refer others'
    }
  ]

  const allSegments = [
    { 
      id: 'all', 
      name: 'All Clients', 
      count: 247, 
      icon: Users, 
      color: 'bg-gray-500',
      description: 'Your complete client database'
    },
    ...clientSegments
  ]

  // Sample client data with priority levels and service tags
  const sampleClients = [
    {
      id: 1,
      name: 'Emma Thompson',
      email: 'emma.thompson@email.com',
      phone: '(555) 123-4567',
      lastVisit: '2024-09-20',
      nextDue: '2024-10-04',
      totalSpent: 1250,
      visits: 8,
      preferredService: 'Hair Color',
      serviceTypes: ['hair'],
      segment: 'vip-clients',
      status: 'VIP',
      priority: 'High',
      notes: 'Prefers Saturday appointments',
      lifetime_value: 'High',
      referrals: 3
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '(555) 234-5678',
      lastVisit: '2024-09-22',
      nextDue: '2024-10-06',
      totalSpent: 425,
      visits: 3,
      preferredService: 'Lash Extensions',
      serviceTypes: ['lash'],
      segment: 'new-clients',
      status: 'Active',
      priority: 'Medium',
      notes: 'Sensitive to adhesive',
      lifetime_value: 'Medium',
      referrals: 1
    },
    {
      id: 3,
      name: 'Michael Chen',
      email: 'mchen@email.com',
      phone: '(555) 345-6789',
      lastVisit: '2024-08-15',
      nextDue: '2024-09-15',
      totalSpent: 890,
      visits: 12,
      preferredService: 'Haircut',
      serviceTypes: ['hair'],
      segment: 'inactive-clients',
      status: 'Inactive',
      priority: 'High',
      notes: 'Usually comes every 3 weeks',
      lifetime_value: 'High',
      referrals: 2
    },
    {
      id: 4,
      name: 'Lisa Rodriguez',
      email: 'lisa.r@email.com',
      phone: '(555) 456-7890',
      lastVisit: null,
      nextDue: null,
      totalSpent: 0,
      visits: 0,
      preferredService: 'Facial',
      serviceTypes: ['facial'],
      segment: 'leads',
      status: 'Lead',
      priority: 'High',
      notes: 'Interested in anti-aging treatments',
      lifetime_value: 'Potential',
      referrals: 0
    },
    {
      id: 5,
      name: 'David Park',
      email: 'dpark@email.com',
      phone: '(555) 567-8901',
      lastVisit: '2024-09-21',
      nextDue: '2024-10-05',
      totalSpent: 180,
      visits: 2,
      preferredService: 'Manicure',
      serviceTypes: ['nails'],
      segment: 'returning-clients',
      status: 'Active',
      priority: 'Medium',
      notes: 'Always on time',
      lifetime_value: 'Medium',
      referrals: 0
    },
    {
      id: 6,
      name: 'Jessica Kim',
      email: 'jkim@email.com',
      phone: '(555) 678-9012',
      lastVisit: '2024-09-23',
      nextDue: null,
      totalSpent: 89,
      visits: 1,
      preferredService: 'Facial + Retail',
      serviceTypes: ['facial', 'retail'],
      segment: 'recent-clients',
      status: 'Active',
      priority: 'Medium',
      notes: 'First visit went great',
      lifetime_value: 'Medium',
      referrals: 0
    },
    {
      id: 7,
      name: 'Ashley Brown',
      email: 'ashley.b@email.com',
      phone: '(555) 789-0123',
      lastVisit: '2024-09-18',
      nextDue: null,
      totalSpent: 75,
      visits: 1,
      preferredService: 'Brow Shaping',
      serviceTypes: ['brow'],
      segment: 'no-shows',
      status: 'No-Show',
      priority: 'Low',
      notes: 'Missed appointment yesterday',
      lifetime_value: 'Medium',
      referrals: 0
    }
  ]

  const getClientsForSegment = (segmentId: string) => {
    let filteredClients = []
    
    if (segmentId === 'all') {
      filteredClients = sampleClients
    } else if (['no-shows', 'rebook-checkout', 'birthday-month', 'referral-sources'].includes(segmentId)) {
      // Handle smart lists - for demo purposes, filter by specific criteria
      switch (segmentId) {
        case 'no-shows':
          filteredClients = sampleClients.filter(client => client.status === 'No-Show')
          break
        case 'rebook-checkout':
          filteredClients = sampleClients.filter(client => client.nextDue !== null)
          break
        case 'birthday-month':
          filteredClients = sampleClients.slice(0, 3) // Sample birthday clients
          break
        case 'referral-sources':
          filteredClients = sampleClients.filter(client => client.referrals > 0)
          break
        default:
          filteredClients = []
      }
    } else {
      filteredClients = sampleClients.filter(client => client.segment === segmentId)
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredClients = filteredClients.filter(client => 
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.phone.includes(query) ||
        client.preferredService.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    const sortedClients = [...filteredClients].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'priority':
          const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 }
          comparison = priorityOrder[b.priority] - priorityOrder[a.priority]
          break
        case 'last-visit':
          if (!a.lastVisit && !b.lastVisit) comparison = 0
          else if (!a.lastVisit) comparison = 1
          else if (!b.lastVisit) comparison = -1
          else comparison = new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
          break
        case 'total-spent':
          comparison = b.totalSpent - a.totalSpent
          break
        case 'visits':
          comparison = b.visits - a.visits
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        default:
          comparison = 0
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sortedClients
  }

  const getCurrentSegment = () => {
    // Check both main segments and smart lists
    const mainSegment = allSegments.find(s => s.id === selectedSegment)
    if (mainSegment) return mainSegment
    
    const smartListSegment = smartLists.find(s => s.id === selectedSegment)
    if (smartListSegment) return { ...smartListSegment, color: 'bg-gray-500' }
    
    return allSegments[0]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700 border-green-200'
      case 'VIP': return 'bg-primary/10 text-primary border-primary/20'
      case 'Inactive': return 'bg-red-100 text-red-700 border-red-200'
      case 'Lead': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'No-Show': return 'bg-orange-100 text-orange-700 border-orange-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getLifetimeValueColor = (value: string) => {
    switch (value) {
      case 'High': return 'bg-primary/10 text-primary border-primary/20'
      case 'Medium': return 'bg-accent/10 text-accent border-accent/20'
      case 'Potential': return 'bg-secondary/20 text-secondary-foreground border-secondary/30'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'Low': return 'bg-green-100 text-green-700 border-green-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with default direction
      setSortBy(column)
      setSortDirection(column === 'priority' || column === 'total-spent' || column === 'visits' ? 'desc' : 'asc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-primary" /> : 
      <ChevronDown className="h-4 w-4 text-primary" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Client Management
          </h1>
          <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Manage your complete client database with smart segmentation
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Last synced {lastSyncTime}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileText className="h-4 w-4 mr-2" />
                CSV File
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Square Integration
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Acuity Integration
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Integration Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">
                  {connectedPlatform === 'square' ? 'Square POS' : 'Acuity Scheduling'} Connected
                </p>
                <p className="text-sm text-muted-foreground">
                  Auto-syncing every 30 minutes • Last sync: {lastSyncTime}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <TrendingUp className="h-3 w-3 mr-1" />
                Live
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setLastSyncTime('Just now')}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Segments */}
      <div className="space-y-6">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="last-visit">Last Visit</SelectItem>
                <SelectItem value="total-spent">Total Spent</SelectItem>
                <SelectItem value="visits">Visit Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Client Segments */}
        <div>
          <h3 className="font-medium mb-4">Client Groups</h3>
          <Select value={selectedSegment} onValueChange={setSelectedSegment}>
            <SelectTrigger className="w-64">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {(() => {
                    if (selectedSegment === 'all') {
                      return (
                        <>
                          <Users className="h-4 w-4" />
                          <span>All Clients</span>
                          <Badge variant="secondary" className="ml-auto">247</Badge>
                        </>
                      )
                    }
                    const segment = clientSegments.find(s => s.id === selectedSegment)
                    if (segment) {
                      const IconComponent = segment.icon
                      return (
                        <>
                          <IconComponent className="h-4 w-4" />
                          <span>{segment.name}</span>
                          <Badge variant="secondary" className="ml-auto">{segment.count}</Badge>
                        </>
                      )
                    }
                    return <span>Select a group...</span>
                  })()}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2 w-full">
                  <Users className="h-4 w-4" />
                  <span>All Clients</span>
                  <Badge variant="secondary" className="ml-auto">247</Badge>
                </div>
              </SelectItem>
              {clientSegments.map((segment) => {
                const IconComponent = segment.icon
                return (
                  <SelectItem key={segment.id} value={segment.id}>
                    <div className="flex items-center gap-2 w-full">
                      <IconComponent className="h-4 w-4" />
                      <span>{segment.name}</span>
                      <Badge variant="secondary" className="ml-auto">{segment.count}</Badge>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Smart Lists */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-medium">Smart Lists</h3>
            <Badge variant="outline" className="text-xs">
              Quick shortcuts
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {smartLists.map((list) => {
              const IconComponent = list.icon
              return (
                <Card 
                  key={list.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedSegment === list.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedSegment(list.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{list.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{list.description}</p>
                    <p className="font-bold text-primary">{list.count}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>



        {/* Current Selection Info */}
        {selectedSegment !== 'all' && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-md ${getCurrentSegment().color} text-white`}>
                  {(() => {
                    const IconComponent = getCurrentSegment().icon
                    return <IconComponent className="h-4 w-4" />
                  })()}
                </div>
                <div>
                  <h3 className="font-medium">{getCurrentSegment().name}</h3>
                  <p className="text-sm text-muted-foreground">{getCurrentSegment().description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-2xl text-primary">{getCurrentSegment().count}</p>
                <p className="text-sm text-muted-foreground">clients</p>
              </div>
            </div>
          </div>
        )}

        {/* Client Table */}
        <Card>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Client</span>
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('visits')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Service History</span>
                      {getSortIcon('visits')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Priority</span>
                      {getSortIcon('priority')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('total-spent')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Value</span>
                      {getSortIcon('total-spent')}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getClientsForSegment(selectedSegment).map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                          <AvatarFallback>
                            {client.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.preferredService}</p>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>{client.email}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{client.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">{client.visits}</span> visits
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${client.totalSpent} total
                        </p>
                        {client.lastVisit && (
                          <p className="text-xs text-muted-foreground">
                            Last: {new Date(client.lastVisit).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getStatusColor(client.status)}>
                        {client.status}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getPriorityColor(client.priority)}>
                        {client.priority}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={getLifetimeValueColor(client.lifetime_value)}>
                          {client.lifetime_value}
                        </Badge>
                        {client.referrals > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {client.referrals} referrals
                          </p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Client
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Calendar className="h-4 w-4 mr-2" />
                            Book Appointment
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}