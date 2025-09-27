import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { 
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Search,
  MessageSquare,
  Mail,
  Star,
  ShoppingCart,
  BarChart3,
  Target,
  Zap,
  Filter,
  Link,
  Settings,
  ExternalLink,
  CheckCircle,
  Clock
} from 'lucide-react'

// Mock inventory data
const inventoryData = {
  overview: {
    totalProducts: 127,
    lowStockAlerts: 8,
    topSellerRevenue: 3240,
    totalRevenue: 12847
  },
  products: [
    {
      id: 1,
      name: "Hydrating Facial Serum",
      category: "Skincare",
      brand: "LuxeGlow",
      currentStock: 4,
      reorderLevel: 10,
      costPrice: 18.50,
      retailPrice: 45.00,
      unitsSold: 23,
      revenue: 1035,
      profitMargin: 58.9,
      trend: "up",
      trendPercent: 15.2,
      lastOrdered: "2024-01-15",
      popularity: "high",
      upsellPotential: "high"
    },
    {
      id: 2,
      name: "Keratin Hair Treatment",
      category: "Hair Care",
      brand: "SalonPro",
      currentStock: 12,
      reorderLevel: 8,
      costPrice: 32.00,
      retailPrice: 89.00,
      unitsSold: 18,
      revenue: 1602,
      profitMargin: 64.0,
      trend: "up",
      trendPercent: 8.7,
      lastOrdered: "2024-01-20",
      popularity: "high",
      upsellPotential: "medium"
    },
    {
      id: 3,
      name: "Luxury Lash Growth Serum",
      category: "Lash Care",
      brand: "LashLux",
      currentStock: 2,
      reorderLevel: 6,
      costPrice: 25.00,
      retailPrice: 75.00,
      unitsSold: 31,
      revenue: 2325,
      profitMargin: 66.7,
      trend: "up",
      trendPercent: 22.1,
      lastOrdered: "2024-01-10",
      popularity: "high",
      upsellPotential: "high"
    },
    {
      id: 4,
      name: "Cuticle Oil Blend",
      category: "Nail Care",
      brand: "NailEssentials",
      currentStock: 15,
      reorderLevel: 12,
      costPrice: 8.00,
      retailPrice: 22.00,
      unitsSold: 12,
      revenue: 264,
      profitMargin: 63.6,
      trend: "down",
      trendPercent: -5.3,
      lastOrdered: "2024-01-25",
      popularity: "medium",
      upsellPotential: "low"
    },
    {
      id: 5,
      name: "Volumizing Hair Mousse",
      category: "Hair Care",
      brand: "StyleMax",
      currentStock: 7,
      reorderLevel: 10,
      costPrice: 12.50,
      retailPrice: 35.00,
      unitsSold: 19,
      revenue: 665,
      profitMargin: 64.3,
      trend: "up",
      trendPercent: 11.4,
      lastOrdered: "2024-01-18",
      popularity: "medium",
      upsellPotential: "medium"
    },
    {
      id: 6,
      name: "Anti-Aging Night Cream",
      category: "Skincare",
      brand: "AgeDefense",
      currentStock: 3,
      reorderLevel: 8,
      costPrice: 28.00,
      retailPrice: 68.00,
      unitsSold: 14,
      revenue: 952,
      profitMargin: 58.8,
      trend: "up",
      trendPercent: 9.2,
      lastOrdered: "2024-01-12",
      popularity: "medium",
      upsellPotential: "high"
    }
  ],
  categories: ["All", "Skincare", "Hair Care", "Lash Care", "Nail Care", "Tools & Accessories"],
  upsellRecommendations: [
    {
      id: 1,
      product: "Luxury Lash Growth Serum",
      reason: "High demand, excellent margins",
      targetClients: "Recent lash extension clients",
      suggestedMessage: "Keep your lashes looking fabulous between appointments! Our Luxury Lash Growth Serum helps maintain length and strength. 20% off this week only! 💫",
      potentialRevenue: 450,
      conversionRate: "12%"
    },
    {
      id: 2,
      product: "Hydrating Facial Serum",
      reason: "Perfect aftercare for facial clients",
      targetClients: "Recent facial service clients",
      suggestedMessage: "Extend your facial glow at home! This hydrating serum is perfect for maintaining your radiant results. Special client price: $38 (reg. $45) ✨",
      potentialRevenue: 380,
      conversionRate: "18%"
    },
    {
      id: 3,
      product: "Keratin Hair Treatment",
      reason: "High-value upsell for color clients",
      targetClients: "Hair color and styling clients",
      suggestedMessage: "Protect your gorgeous new color! Our at-home keratin treatment keeps your hair smooth and vibrant for weeks. Available for $75 (salon exclusive) 💇‍♀️",
      potentialRevenue: 675,
      conversionRate: "15%"
    }
  ]
}

// Integration platforms data
const integrationPlatforms = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sync your online store inventory automatically',
    icon: ShoppingCart,
    color: 'bg-green-500',
    connected: false,
    features: ['Real-time inventory sync', 'Product catalog import', 'Sales data integration']
  },
  {
    id: 'square',
    name: 'Square POS',
    description: 'Connect your point-of-sale system for seamless tracking',
    icon: BarChart3,
    color: 'bg-blue-500',
    connected: false,
    features: ['POS inventory sync', 'Transaction data', 'Customer purchase history']
  },
  {
    id: 'acuity',
    name: 'Acuity Scheduling',
    description: 'Link appointments with product recommendations',
    icon: Clock,
    color: 'bg-purple-500',
    connected: false,
    features: ['Service-based product sync', 'Client booking data', 'Automated upsell triggers']
  }
]

export function Inventory() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("revenue")
  const [integrations, setIntegrations] = useState(integrationPlatforms)

  // Filter and sort products
  const filteredProducts = inventoryData.products
    .filter(product => {
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.brand.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.revenue - a.revenue
        case 'stock':
          return a.currentStock - b.currentStock
        case 'popularity':
          return b.unitsSold - a.unitsSold
        case 'margin':
          return b.profitMargin - a.profitMargin
        default:
          return 0
      }
    })

  const lowStockProducts = inventoryData.products.filter(p => p.currentStock <= p.reorderLevel)
  const topPerformers = inventoryData.products
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)

  const getStockStatus = (current: number, reorder: number) => {
    if (current === 0) return { status: 'out-of-stock', color: 'bg-destructive', text: 'Out of Stock' }
    if (current <= reorder) return { status: 'low-stock', color: 'bg-orange-500', text: 'Low Stock' }
    if (current <= reorder * 2) return { status: 'medium-stock', color: 'bg-yellow-500', text: 'Medium Stock' }
    return { status: 'in-stock', color: 'bg-green-500', text: 'In Stock' }
  }

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />
  }

  const handleIntegrationConnect = (platformId: string) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === platformId 
          ? { ...integration, connected: true }
          : integration
      )
    )
  }

  const handleReorder = (productId: number) => {
    // Handle reorder logic
    console.log('Reordering product:', productId)
  }

  const handleSendSMS = (productName: string) => {
    // Handle SMS sending
    console.log('Sending SMS for:', productName)
  }

  const handleSendEmail = (productName: string) => {
    // Handle email sending
    console.log('Sending email for:', productName)
  }

  const handleQuickCampaign = (campaignType: string) => {
    // Handle quick campaign setup
    console.log('Setting up campaign:', campaignType)
  }

  const handleManageIntegrations = () => {
    // Handle integration management
    console.log('Managing integrations')
  }

  const connectedIntegrations = integrations.filter(i => i.connected)
  const hasAnyIntegrations = connectedIntegrations.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
          Inventory Management
        </h1>
        <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Track product performance and discover upselling opportunities
        </p>
      </div>

      {/* Integration Banner - Show when no integrations connected */}
      {!hasAnyIntegrations && (
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-accent/10 rounded-full">
                <Link className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Connect Your Systems for Automatic Inventory Sync
                </h3>
                <p className="text-muted-foreground mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Link your existing POS, e-commerce, or booking platforms to automatically sync inventory data and unlock powerful insights.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {integrations.map((platform) => {
                    const IconComponent = platform.icon
                    return (
                      <Card key={platform.id} className="border border-gray-200 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`p-2 ${platform.color} rounded-lg`}>
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                                {platform.name}
                              </h4>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {platform.description}
                          </p>
                          <ul className="text-xs text-muted-foreground mb-4 space-y-1">
                            {platform.features.map((feature, index) => (
                              <li key={index} className="flex items-center space-x-1">
                                <div className="w-1 h-1 bg-primary rounded-full"></div>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                          <Button 
                            size="sm" 
                            className="w-full bg-primary text-white hover:bg-primary/90"
                            onClick={() => handleIntegrationConnect(platform.id)}
                            type="button"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Integrations Status */}
      {hasAnyIntegrations && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Connected Integrations
                  </h4>
                  <p className="text-sm text-green-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {connectedIntegrations.map(i => i.name).join(', ')} • Syncing automatically
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-green-300 text-green-700 hover:bg-green-100"
                onClick={handleManageIntegrations}
                type="button"
              >
                <Settings className="h-4 w-4 mr-1" />
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">{inventoryData.overview.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">{inventoryData.overview.lowStockAlerts}</p>
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">${inventoryData.overview.topSellerRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Top Seller Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-accent/10 rounded-full">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">${inventoryData.overview.totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/10">
          <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            All Products
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Stock Alerts
          </TabsTrigger>
          <TabsTrigger value="upsell" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Upsell Opportunities
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventoryData.categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Sort by Revenue</SelectItem>
                <SelectItem value="stock">Sort by Stock Level</SelectItem>
                <SelectItem value="popularity">Sort by Units Sold</SelectItem>
                <SelectItem value="margin">Sort by Profit Margin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead>Units Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Upsell Potential</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product.currentStock, product.reorderLevel)
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                              {product.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {product.brand} • {product.category}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${stockStatus.color}`}></div>
                            <span className="text-sm">{product.currentStock} units</span>
                          </div>
                        </TableCell>
                        <TableCell>{product.unitsSold}</TableCell>
                        <TableCell>${product.revenue.toLocaleString()}</TableCell>
                        <TableCell>{product.profitMargin.toFixed(1)}%</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {getTrendIcon(product.trend)}
                            <span className={`text-sm ${product.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                              {product.trendPercent > 0 ? '+' : ''}{product.trendPercent}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={product.upsellPotential === 'high' ? 'default' : 
                                   product.upsellPotential === 'medium' ? 'secondary' : 'outline'}
                            className={product.upsellPotential === 'high' ? 'bg-primary text-white' : ''}
                          >
                            {product.upsellPotential}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-orange-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Low Stock Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium" style={{ fontFamily: 'Montserrat, sans-serif' }}>{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.currentStock} units remaining</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-primary border-primary hover:bg-primary hover:text-white"
                      onClick={() => handleReorder(product.id)}
                      type="button"
                    >
                      Reorder
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-green-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Star className="h-5 w-5" />
                  <span>Top Performers</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topPerformers.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium" style={{ fontFamily: 'Montserrat, sans-serif' }}>{product.name}</p>
                        <p className="text-sm text-muted-foreground">${product.revenue.toLocaleString()} revenue</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      {product.unitsSold} sold
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Upsell Opportunities Tab */}
        <TabsContent value="upsell" className="space-y-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Smart Upselling Recommendations
            </h3>
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              AI-powered suggestions to boost your retail sales through targeted messaging
            </p>
          </div>

          <div className="space-y-4">
            {inventoryData.upsellRecommendations.map((rec) => (
              <Card key={rec.id} className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                          {rec.product}
                        </h4>
                        <p className="text-sm text-muted-foreground">{rec.reason}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">${rec.potentialRevenue}</p>
                      <p className="text-sm text-muted-foreground">potential revenue</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-black mb-2">Target Audience:</p>
                    <Badge variant="outline" className="border-accent text-accent">
                      {rec.targetClients}
                    </Badge>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-black mb-2">Suggested Message:</p>
                    <div className="p-3 bg-secondary/20 rounded-lg border border-secondary/30">
                      <p className="text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        "{rec.suggestedMessage}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Expected conversion: </span>
                        <span className="font-medium text-green-600">{rec.conversionRate}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-accent text-accent hover:bg-accent hover:text-white"
                        onClick={() => handleSendSMS(rec.product)}
                        type="button"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Send SMS
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-primary text-white hover:bg-primary/90"
                        onClick={() => handleSendEmail(rec.product)}
                        type="button"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Send Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Action Card */}
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-accent/10 rounded-full">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Quick Campaign Setup
                  </h4>
                  <p className="text-sm text-muted-foreground">Launch targeted product campaigns in minutes</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => handleQuickCampaign('aftercare')}
                  type="button"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Aftercare Products
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => handleQuickCampaign('premium')}
                  type="button"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Premium Upgrades
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => handleQuickCampaign('seasonal')}
                  type="button"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Seasonal Collections
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  )
}