// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { toast } from 'sonner'
import {
  Star,
  Clock,
  MapPin,
  Shield,
  Award,
  Heart,
  Sparkles,
  Users,
  CheckCircle,
  Gift,
  Timer,
  ArrowRight,
  Phone,
  Mail,
  Monitor,
  Smartphone,
  Eye,
  Copy,
  ExternalLink,
  Edit3,
  Save,
  Link2,
  Settings,
  Palette
} from 'lucide-react'

interface FormData {
  name: string
  email: string
  phone: string
  service: string
}

interface LandingPageConfig {
  hero: {
    headline: string
    subheadline: string
    description: string
    buttonText: string
  }
  offer: {
    title: string
    description: string
    discount: string
    urgency: string
  }
  testimonials: Array<{
    name: string
    service: string
    rating: number
    text: string
    image: string
  }>
  trustPoints: Array<{
    title: string
    description: string
  }>
  about: {
    name: string
    description: string
    experience: string
    clients: string
  }
  businessInfo: {
    name: string
    phone: string
    email: string
    address: string
  }
  colors: {
    primary: string
    accent: string
    background: string
  }
}

const defaultConfig: LandingPageConfig = {
  hero: {
    headline: "Wake Up With Perfect Lashes — No Mascara Needed",
    subheadline: "Transform your daily routine with professional lash extensions",
    description: "Professional lash extensions that give you effortless beauty, every single day.",
    buttonText: "Reserve My Spot"
  },
  offer: {
    title: "$50 OFF Your First Appointment",
    description: "Plus receive a complimentary lash serum ($35 value) to maintain your beautiful results",
    discount: "50",
    urgency: "Only 3 spots left this week"
  },
  testimonials: [
    {
      name: "Jessica Martinez",
      service: "Lash Extensions",
      rating: 5,
      text: "I wake up every morning feeling gorgeous! The lashes look so natural and last for weeks. Best investment I've ever made!",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face"
    },
    {
      name: "Sarah Chen",
      service: "Microblading",
      rating: 5,
      text: "My eyebrows are perfect every single day. I save so much time in my morning routine and feel confident all day long!",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b5e5?w=100&h=100&fit=crop&crop=face"
    },
    {
      name: "Amanda Rodriguez",
      service: "HydraFacial",
      rating: 5,
      text: "My skin has never looked better! The results were immediate and everyone keeps asking what I'm doing differently.",
      image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face"
    }
  ],
  trustPoints: [
    {
      title: "Licensed & Certified",
      description: "Fully licensed professional with advanced certifications"
    },
    {
      title: "Premium Products",
      description: "Only the highest quality, salon-grade products used"
    },
    {
      title: "Easy Online Booking",
      description: "Book your appointment 24/7 with instant confirmation"
    },
    {
      title: "Convenient Location",
      description: "Easy parking and accessible location in the heart of the city"
    }
  ],
  about: {
    name: "Sarah",
    description: "With over 8 years of experience in the beauty industry, I've helped hundreds of clients achieve their dream look and boost their confidence. I specialize in natural-looking lash extensions, precision microblading, and advanced skincare treatments.",
    experience: "8+ Years Experience",
    clients: "500+ Happy Clients"
  },
  businessInfo: {
    name: "Elegant Beauty Studio",
    phone: "(555) 123-LASH",
    email: "hello@beautystudio.com",
    address: "123 Beauty Lane, City, State 12345"
  },
  colors: {
    primary: "#E03C91",
    accent: "#2F5D9F",
    background: "#F3F3F3"
  }
}

interface EditableLandingPageProps {
  onBack: () => void
  onSave: (config: LandingPageConfig, url: string) => void
  isEditing: boolean
  savedConfig?: LandingPageConfig
}

export function EditableLandingPage({ onBack, onSave, isEditing, savedConfig }: EditableLandingPageProps) {
  const [config, setConfig] = useState<LandingPageConfig>(savedConfig || defaultConfig)
  const [activeTab, setActiveTab] = useState("hero")
  const [previewMode, setPreviewMode] = useState("mobile")
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    service: ''
  })
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60) // 24 hours in seconds

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("New lead captured! 🎉")
    setFormData({ name: '', email: '', phone: '', service: '' })
  }

  const updateConfig = (section: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof LandingPageConfig],
        [field]: value
      }
    }))
  }

  const updateTestimonial = (index: number, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      testimonials: prev.testimonials.map((testimonial, i) =>
        i === index ? { ...testimonial, [field]: value } : testimonial
      )
    }))
  }

  const updateTrustPoint = (index: number, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      trustPoints: prev.trustPoints.map((point, i) =>
        i === index ? { ...point, [field]: value } : point
      )
    }))
  }

  const generateUrl = () => {
    const businessSlug = config.businessInfo.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    return `https://lp.bvx.app/${businessSlug}`
  }

  const handleSave = () => {
    const url = generateUrl()
    onSave(config, url)
    toast.success("Landing page saved successfully! 🎉")
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Link copied to clipboard!")
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const isFormValid = formData.name && formData.email && formData.service

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              ← Back to Options
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Landing Page Builder
            </h1>
          </div>
          <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Create a high-converting landing page for your advertising campaigns
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isEditing && (
            <Button
              variant="outline"
              onClick={() => copyToClipboard(generateUrl())}
              className="flex items-center space-x-2"
            >
              <Link2 className="h-4 w-4" />
              <span>Copy Link</span>
            </Button>
          )}
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white" size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Save Changes' : 'Save Landing Page'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
                Content Editor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-4 border-b pb-2">
                {[
                  { id: "hero", label: "Hero" },
                  { id: "offer", label: "Offer" },
                  { id: "testimonials", label: "Reviews" },
                  { id: "trust", label: "Trust" },
                  { id: "about", label: "About" },
                  { id: "business", label: "Business" },
                  { id: "design", label: "Design" }
                ].map((tab) => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={activeTab === tab.id ? "default" : "ghost"}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              {/* Hero Tab */}
              {activeTab === "hero" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Main Headline</label>
                    <Input
                      value={config.hero.headline}
                      onChange={(e) => updateConfig('hero', 'headline', e.target.value)}
                      placeholder="Compelling headline..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Subheadline</label>
                    <Input
                      value={config.hero.subheadline}
                      onChange={(e) => updateConfig('hero', 'subheadline', e.target.value)}
                      placeholder="Supporting message..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      value={config.hero.description}
                      onChange={(e) => updateConfig('hero', 'description', e.target.value)}
                      placeholder="Detailed description..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Button Text</label>
                    <Input
                      value={config.hero.buttonText}
                      onChange={(e) => updateConfig('hero', 'buttonText', e.target.value)}
                      placeholder="Call to action..."
                    />
                  </div>
                </div>
              )}

              {/* Offer Tab */}
              {activeTab === "offer" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Offer Title</label>
                    <Input
                      value={config.offer.title}
                      onChange={(e) => updateConfig('offer', 'title', e.target.value)}
                      placeholder="Special offer title..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Offer Description</label>
                    <Textarea
                      value={config.offer.description}
                      onChange={(e) => updateConfig('offer', 'description', e.target.value)}
                      placeholder="Describe your offer..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Discount Amount ($)</label>
                    <Input
                      value={config.offer.discount}
                      onChange={(e) => updateConfig('offer', 'discount', e.target.value)}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Urgency Message</label>
                    <Input
                      value={config.offer.urgency}
                      onChange={(e) => updateConfig('offer', 'urgency', e.target.value)}
                      placeholder="Limited time / spots available..."
                    />
                  </div>
                </div>
              )}

              {/* Testimonials Tab */}
              {activeTab === "testimonials" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Customer Testimonials</h4>
                    <span className="text-sm text-muted-foreground">
                      {config.testimonials.length}/3 reviews
                    </span>
                  </div>
                  {config.testimonials.map((testimonial, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium mb-1 block">Customer Name</label>
                          <Input
                            value={testimonial.name}
                            onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                            placeholder="Customer name"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Service</label>
                          <Input
                            value={testimonial.service}
                            onChange={(e) => updateTestimonial(index, 'service', e.target.value)}
                            placeholder="Service received"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Review Text</label>
                        <Textarea
                          value={testimonial.text}
                          onChange={(e) => updateTestimonial(index, 'text', e.target.value)}
                          placeholder="Customer review..."
                          rows={3}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Trust Tab */}
              {activeTab === "trust" && (
                <div className="space-y-4">
                  <h4 className="font-medium mb-4">Trust Building Points</h4>
                  {config.trustPoints.map((point, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Title</label>
                        <Input
                          value={point.title}
                          onChange={(e) => updateTrustPoint(index, 'title', e.target.value)}
                          placeholder="Trust point title"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Description</label>
                        <Textarea
                          value={point.description}
                          onChange={(e) => updateTrustPoint(index, 'description', e.target.value)}
                          placeholder="Description..."
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* About Tab */}
              {activeTab === "about" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Your Name</label>
                    <Input
                      value={config.about.name}
                      onChange={(e) => updateConfig('about', 'name', e.target.value)}
                      placeholder="Your professional name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">About You</label>
                    <Textarea
                      value={config.about.description}
                      onChange={(e) => updateConfig('about', 'description', e.target.value)}
                      placeholder="Tell clients about your experience and expertise..."
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Experience Badge</label>
                      <Input
                        value={config.about.experience}
                        onChange={(e) => updateConfig('about', 'experience', e.target.value)}
                        placeholder="8+ Years Experience"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Clients Badge</label>
                      <Input
                        value={config.about.clients}
                        onChange={(e) => updateConfig('about', 'clients', e.target.value)}
                        placeholder="500+ Happy Clients"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Business Tab */}
              {activeTab === "business" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Name</label>
                    <Input
                      value={config.businessInfo.name}
                      onChange={(e) => updateConfig('businessInfo', 'name', e.target.value)}
                      placeholder="Your business name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <Input
                      value={config.businessInfo.phone}
                      onChange={(e) => updateConfig('businessInfo', 'phone', e.target.value)}
                      placeholder="Business phone number"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input
                      value={config.businessInfo.email}
                      onChange={(e) => updateConfig('businessInfo', 'email', e.target.value)}
                      placeholder="Contact email"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Address</label>
                    <Input
                      value={config.businessInfo.address}
                      onChange={(e) => updateConfig('businessInfo', 'address', e.target.value)}
                      placeholder="Business address"
                    />
                  </div>
                </div>
              )}

              {/* Design Tab */}
              {activeTab === "design" && (
                <div className="space-y-4">
                  <h4 className="font-medium mb-4">Color Scheme</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Primary Color</label>
                      <div className="flex space-x-2">
                        <input
                          type="color"
                          value={config.colors.primary}
                          onChange={(e) => updateConfig('colors', 'primary', e.target.value)}
                          className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={config.colors.primary}
                          onChange={(e) => updateConfig('colors', 'primary', e.target.value)}
                          placeholder="#E03C91"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Accent Color</label>
                      <div className="flex space-x-2">
                        <input
                          type="color"
                          value={config.colors.accent}
                          onChange={(e) => updateConfig('colors', 'accent', e.target.value)}
                          className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={config.colors.accent}
                          onChange={(e) => updateConfig('colors', 'accent', e.target.value)}
                          placeholder="#2F5D9F"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
                <div className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <span>Live Preview</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className={`border rounded-lg overflow-hidden bg-white ${
                  previewMode === "mobile" ? "max-w-sm mx-auto" : "w-full"
                }`}
                style={{ height: "600px", overflowY: "auto" }}
              >
                {/* Preview Content */}
                <div className="min-h-full" style={{ backgroundColor: config.colors.background }}>
                  {/* Hero Section Preview */}
                  <div 
                    className="p-6 text-center text-white"
                    style={{ background: `linear-gradient(135deg, ${config.colors.primary}, ${config.colors.accent})` }}
                  >
                    <Badge className="mb-4" style={{ backgroundColor: `${config.colors.primary}20`, color: config.colors.primary }}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Special Offer
                    </Badge>
                    <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {config.hero.headline}
                    </h1>
                    <p className="text-sm opacity-90 mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {config.hero.subheadline}
                    </p>
                    <p className="text-xs opacity-80 mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {config.hero.description}
                    </p>
                    
                    {/* Mini Form */}
                    <div className="bg-white/95 backdrop-blur p-4 rounded-lg text-black">
                      <form onSubmit={handleFormSubmit} className="space-y-3">
                        <Input
                          placeholder="Your Name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="text-sm h-8"
                        />
                        <Input
                          type="email"
                          placeholder="Your Email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="text-sm h-8"
                        />
                        <Select value={formData.service} onValueChange={(value) => handleInputChange('service', value)}>
                          <SelectTrigger className="text-sm h-8">
                            <SelectValue placeholder="Choose service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lash-extensions">Lash Extensions</SelectItem>
                            <SelectItem value="microblading">Microblading</SelectItem>
                            <SelectItem value="facials">Facials</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          type="submit" 
                          className="w-full text-sm h-8"
                          style={{ backgroundColor: config.colors.primary }}
                          disabled={!isFormValid}
                        >
                          {config.hero.buttonText}
                        </Button>
                      </form>
                    </div>
                  </div>

                  {/* Offer Section Preview */}
                  <div className="p-6 text-center" style={{ backgroundColor: `${config.colors.primary}10` }}>
                    <div className="bg-white rounded-lg p-4 shadow-lg" style={{ borderColor: `${config.colors.primary}20` }}>
                      <Gift className="h-6 w-6 mx-auto mb-2" style={{ color: config.colors.primary }} />
                      <h3 className="font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                        {config.offer.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {config.offer.description}
                      </p>
                      <div className="flex items-center justify-center space-x-2 text-xs">
                        <Timer className="h-3 w-3" style={{ color: config.colors.primary }} />
                        <span>Offer expires in: {formatTime(timeLeft)}</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: config.colors.accent }}>
                        {config.offer.urgency}
                      </p>
                    </div>
                  </div>

                  {/* Testimonials Preview */}
                  <div className="p-6">
                    <h3 className="text-center font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                      What Clients Say
                    </h3>
                    <div className="space-y-3">
                      {config.testimonials.slice(0, 2).map((testimonial, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-gray-300"></div>
                            <div>
                              <p className="text-xs font-medium">{testimonial.name}</p>
                              <div className="flex">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                  <Star key={i} className="h-2 w-2 fill-yellow-500 text-yellow-500" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            "{testimonial.text.slice(0, 80)}..."
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trust Points Preview */}
                  <div className="p-6 bg-gray-50">
                    <h3 className="text-center font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Why Choose Us
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {config.trustPoints.map((point, index) => {
                        const icons = [Shield, Award, Clock, MapPin]
                        const Icon = icons[index] || Shield
                        return (
                          <div key={index} className="text-center">
                            <div className="inline-flex p-2 bg-white rounded-full mb-2">
                              <Icon className="h-3 w-3" style={{ color: config.colors.primary }} />
                            </div>
                            <p className="text-xs font-medium">{point.title}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* About Preview */}
                  <div className="p-6">
                    <h3 className="text-center font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Meet {config.about.name}
                    </h3>
                    <div className="bg-gray-200 aspect-square w-20 h-20 rounded-full mx-auto mb-3"></div>
                    <p className="text-xs text-muted-foreground text-center mb-3">
                      {config.about.description.slice(0, 100)}...
                    </p>
                    <div className="flex justify-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {config.about.experience}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {config.about.clients}
                      </Badge>
                    </div>
                  </div>

                  {/* Final CTA Preview */}
                  <div 
                    className="p-6 text-center text-white"
                    style={{ background: `linear-gradient(135deg, ${config.colors.primary}, ${config.colors.accent})` }}
                  >
                    <h3 className="font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Ready to Get Started?
                    </h3>
                    <Button 
                      className="w-full text-sm"
                      style={{ backgroundColor: 'white', color: config.colors.primary }}
                    >
                      <Heart className="h-3 w-3 mr-1" />
                      {config.hero.buttonText}
                    </Button>
                    <div className="flex justify-center items-center space-x-4 mt-3 text-xs opacity-90">
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3" />
                        <span>{config.businessInfo.phone}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Mail className="h-3 w-3" />
                        <span>{config.businessInfo.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* URL Preview */}
          {isEditing && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Your Landing Page URL:</span>
                </div>
                <div className="flex items-center space-x-2 mt-2 p-3 bg-gray-50 rounded-lg">
                  <code className="text-sm flex-1 text-primary">{generateUrl()}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(generateUrl())}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditableLandingPage