import { useState, useEffect } from 'react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { ImageWithFallback } from './figma/ImageWithFallback'
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
  Mail
} from 'lucide-react'

interface FormData {
  name: string
  email: string
  phone: string
  service: string
}

export function BeautyLandingPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    service: ''
  })
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60) // 24 hours in seconds
  const [isSubmitted, setIsSubmitted] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission here
    console.log('Form submitted:', formData)
    setIsSubmitted(true)
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({ name: '', email: '', phone: '', service: '' })
    }, 3000)
  }

  const isFormValid = formData.name && formData.email && formData.service

  const testimonials = [
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
  ]

  const trustPoints = [
    {
      icon: Shield,
      title: "Licensed & Certified",
      description: "Fully licensed professional with advanced certifications"
    },
    {
      icon: Award,
      title: "Premium Products",
      description: "Only the highest quality, salon-grade products used"
    },
    {
      icon: Clock,
      title: "Easy Online Booking",
      description: "Book your appointment 24/7 with instant confirmation"
    },
    {
      icon: MapPin,
      title: "Convenient Location",
      description: "Easy parking and accessible location in the heart of the city"
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 to-accent/5 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-2">
                  <Sparkles className="h-4 w-4 mr-2" />
                  New Client Special
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold text-black leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Wake Up With Perfect{' '}
                  <span className="text-primary">Lashes</span>
                  <br />
                  No Mascara Needed
                </h1>
                <p className="text-lg text-muted-foreground max-w-md" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Transform your daily routine with professional lash extensions that give you effortless beauty, every single day.
                </p>
              </div>

              {/* Lead Form */}
              <Card className="p-6 shadow-lg border-primary/10">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter your name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="service">Service Interest *</Label>
                      <Select value={formData.service} onValueChange={(value) => handleInputChange('service', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lash-extensions">Lash Extensions</SelectItem>
                          <SelectItem value="lash-lift">Lash Lift & Tint</SelectItem>
                          <SelectItem value="microblading">Microblading</SelectItem>
                          <SelectItem value="hydrafacial">HydraFacial</SelectItem>
                          <SelectItem value="facials">Custom Facials</SelectItem>
                          <SelectItem value="consultation">Free Consultation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-white hover:bg-primary/90 py-6 text-lg font-semibold"
                    disabled={!isFormValid || isSubmitted}
                  >
                    {isSubmitted ? (
                      <>
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Thank You! We'll Contact You Soon
                      </>
                    ) : (
                      <>
                        Reserve My Spot
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </div>

            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1737063935340-f9af0940c4c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWF1dHklMjBzYWxvbiUyMGxhc2glMjBleHRlbnNpb25zJTIwYmVmb3JlJTIwYWZ0ZXJ8ZW58MXx8fHwxNzU4ODQ3ODg2fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Beautiful lash extensions transformation"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center space-x-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    ))}
                  </div>
                  <span className="text-sm font-medium">500+ Happy Clients</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Section - Before & After */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>
            See The Amazing <span className="text-primary">Transformation</span>
          </h2>
          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-100 to-gray-200">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1758188753373-5b01a0fc6d9d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWF1dHklMjBzYWxvbiUyMGx1eHVyeSUyMG1vZGVybiUyMGludGVyaW9yfGVufDF8fHx8MTc1ODg0Nzg5M3ww&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Stunning before and after transformation results"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="mt-6 text-muted-foreground max-w-2xl mx-auto">
            Watch real clients transform their look and confidence with our professional beauty services. Results speak louder than words.
          </p>
        </div>
      </section>

      {/* Offer / Incentive Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-primary/20">
            <div className="flex items-center justify-center mb-6">
              <Gift className="h-8 w-8 text-primary mr-3" />
              <Badge className="bg-primary text-white px-4 py-2 text-lg">
                Limited Time Offer
              </Badge>
            </div>
            
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              $50 OFF Your First Appointment
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Plus receive a complimentary lash serum ($35 value) to maintain your beautiful results
            </p>
            
            <div className="flex items-center justify-center space-x-2 mb-6">
              <Timer className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Offer expires in:</span>
              <div className="bg-black text-white px-4 py-2 rounded-lg font-mono text-xl">
                {formatTime(timeLeft)}
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>Only 3 spots left this week</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>Book within 24 hours</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials / Social Proof */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              What Our Clients Are Saying
            </h2>
            <p className="text-muted-foreground">
              Join hundreds of satisfied clients who've transformed their beauty routine
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="flex items-center space-x-4 mb-4">
                    <ImageWithFallback
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="font-semibold">{testimonial.name}</h4>
                      <p className="text-sm text-primary">{testimonial.service}</p>
                    </div>
                  </div>
                  
                  <div className="flex mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground italic">
                    "{testimonial.text}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Why Choose Us
            </h2>
            <p className="text-muted-foreground">
              Your safety, comfort, and satisfaction are our top priorities
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustPoints.map((point, index) => {
              const Icon = point.icon
              return (
                <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="p-0">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{point.title}</h3>
                    <p className="text-sm text-muted-foreground">{point.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* About the Artist */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
                Meet Your Beauty Expert
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Hi, I'm Sarah! With over 8 years of experience in the beauty industry, I've helped hundreds of clients 
                  achieve their dream look and boost their confidence.
                </p>
                <p>
                  I specialize in natural-looking lash extensions, precision microblading, and advanced skincare treatments. 
                  My passion is helping you wake up feeling beautiful and confident every single day.
                </p>
                <p>
                  I'm certified in the latest techniques and only use premium, cruelty-free products to ensure 
                  the best results for your skin and lashes.
                </p>
              </div>
              
              <div className="flex items-center space-x-4 mt-6">
                <Badge className="bg-accent/10 text-accent border-accent/20">
                  8+ Years Experience
                </Badge>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  500+ Happy Clients
                </Badge>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-xl">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1758613653786-a954a5e11281?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBiZWF1dHklMjBhcnRpc3QlMjB3b21hbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc1ODg0Nzg5MHww&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Sarah - Professional Beauty Artist"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary to-accent text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            Ready to Look and Feel Your Best?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Don't wait another day to start your beauty transformation
          </p>
          
          {/* Closing Form */}
          <Card className="p-8 bg-white/95 backdrop-blur text-black max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="bg-white"
                />
                <Input
                  type="email"
                  placeholder="Your Email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="bg-white"
                />
              </div>
              
              <Select value={formData.service} onValueChange={(value) => handleInputChange('service', value)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Choose your service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lash-extensions">Lash Extensions</SelectItem>
                  <SelectItem value="lash-lift">Lash Lift & Tint</SelectItem>
                  <SelectItem value="microblading">Microblading</SelectItem>
                  <SelectItem value="hydrafacial">HydraFacial</SelectItem>
                  <SelectItem value="facials">Custom Facials</SelectItem>
                  <SelectItem value="consultation">Free Consultation</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                type="submit" 
                size="lg"
                className="w-full bg-primary text-white hover:bg-primary/90 py-6 text-lg font-semibold"
                disabled={!isFormValid || isSubmitted}
              >
                {isSubmitted ? (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Thank You! We'll Contact You Soon
                  </>
                ) : (
                  <>
                    <Heart className="h-5 w-5 mr-2" />
                    Book My Appointment
                  </>
                )}
              </Button>
            </form>
            
            <div className="flex items-center justify-center space-x-6 mt-6 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Phone className="h-4 w-4" />
                <span>(555) 123-LASH</span>
              </div>
              <div className="flex items-center space-x-1">
                <Mail className="h-4 w-4" />
                <span>hello@beautystudio.com</span>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}

export default BeautyLandingPage