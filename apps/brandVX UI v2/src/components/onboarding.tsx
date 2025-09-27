import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, ArrowLeft, CheckCircle, Palette, Users, Briefcase } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import bvxLogo from 'figma:asset/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'

interface OnboardingProps {
  userData: any
  onComplete: (onboardingData: any) => void
}

interface OnboardingData {
  jobTitle: string
  businessName: string
  services: string[]
  monthlyClients: string
  primaryColor: string
  secondaryColor: string
  brandStyle: string
  businessGoals: string
  experience: string
}

const JOB_TITLES = [
  'Esthetician',
  'Cosmetologist/Hair Stylist', 
  'Nail Technician',
  'Lash Artist',
  'Massage Therapist',
  'Other'
]

const SERVICES_OPTIONS = [
  'Facials & Skincare',
  'Hair Styling & Color',
  'Nail Services',
  'Lash Extensions',
  'Microblading/PMU',
  'Massage Therapy',
  'Waxing Services',
  'Makeup Application',
  'Body Treatments',
  'Anti-Aging Treatments',
  'Acne Treatments',
  'Chemical Peels',
  'Other'
]

const MONTHLY_CLIENTS = [
  '1-10 clients',
  '11-25 clients',
  '26-50 clients',
  '51-100 clients',
  '100+ clients'
]

const BRAND_STYLES = [
  'Modern & Minimalist',
  'Luxurious & Elegant',
  'Fun & Vibrant',
  'Natural & Organic',
  'Professional & Clean',
  'Trendy & Edgy'
]

export function Onboarding({ userData, onComplete }: OnboardingProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    jobTitle: '',
    businessName: '',
    services: [],
    monthlyClients: '',
    primaryColor: '#E03C91',
    secondaryColor: '#2F5D9F',
    brandStyle: '',
    businessGoals: '',
    experience: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const completeData = {
      ...userData,
      ...onboardingData
    }
    
    setIsLoading(false)
    onComplete(completeData)
  }

  const handleServiceToggle = (service: string) => {
    setOnboardingData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }))
  }

  const isFormValid = () => {
    return (
      onboardingData.jobTitle &&
      onboardingData.businessName &&
      onboardingData.services.length > 0 &&
      onboardingData.monthlyClients &&
      onboardingData.brandStyle
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-4xl"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <img
            src={bvxLogo}
            alt="BVX Logo"
            className="h-16 w-auto mx-auto mb-6"
          />
          <h1 className="text-4xl font-bold text-black mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Let's Personalize Your Experience
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Tell us about your beauty business so we can customize BVX to work perfectly for you
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="border-primary/20 shadow-xl">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-center text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                Business Setup
              </CardTitle>
              <CardDescription className="text-center">
                This will help us create a personalized dashboard for your needs
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Professional Information */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Briefcase className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Professional Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Job Title */}
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="text-black font-medium">
                        What's your profession? *
                      </Label>
                      <Select
                        value={onboardingData.jobTitle}
                        onValueChange={(value) => setOnboardingData(prev => ({ ...prev, jobTitle: value }))}
                      >
                        <SelectTrigger className="border-primary/20 focus:border-primary">
                          <SelectValue placeholder="Select your profession" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_TITLES.map((title) => (
                            <SelectItem key={title} value={title}>{title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Business Name */}
                    <div className="space-y-2">
                      <Label htmlFor="businessName" className="text-black font-medium">
                        Business Name *
                      </Label>
                      <Input
                        id="businessName"
                        type="text"
                        placeholder="Elegant Beauty Studio"
                        value={onboardingData.businessName}
                        onChange={(e) => setOnboardingData(prev => ({ ...prev, businessName: e.target.value }))}
                        className="border-primary/20 focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  {/* Monthly Clients */}
                  <div className="space-y-2">
                    <Label className="text-black font-medium">
                      How many clients do you typically see per month? *
                    </Label>
                    <Select
                      value={onboardingData.monthlyClients}
                      onValueChange={(value) => setOnboardingData(prev => ({ ...prev, monthlyClients: value }))}
                    >
                      <SelectTrigger className="border-primary/20 focus:border-primary">
                        <SelectValue placeholder="Select client range" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHLY_CLIENTS.map((range) => (
                          <SelectItem key={range} value={range}>{range}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Services Offered */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Users className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Services & Expertise
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-black font-medium">
                      What services do you offer? * (Select all that apply)
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {SERVICES_OPTIONS.map((service) => (
                        <motion.div
                          key={service}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <button
                            type="button"
                            onClick={() => handleServiceToggle(service)}
                            className={`w-full p-3 text-left rounded-lg border-2 transition-all duration-200 ${
                              onboardingData.services.includes(service)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{service}</span>
                              {onboardingData.services.includes(service) && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Brand & Style */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Palette className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Brand & Style
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Brand Style */}
                    <div className="space-y-2">
                      <Label className="text-black font-medium">
                        What's your brand style? *
                      </Label>
                      <Select
                        value={onboardingData.brandStyle}
                        onValueChange={(value) => setOnboardingData(prev => ({ ...prev, brandStyle: value }))}
                      >
                        <SelectTrigger className="border-primary/20 focus:border-primary">
                          <SelectValue placeholder="Choose your style" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAND_STYLES.map((style) => (
                            <SelectItem key={style} value={style}>{style}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Primary Color */}
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor" className="text-black font-medium">
                        Primary Brand Color
                      </Label>
                      <div className="flex space-x-3">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={onboardingData.primaryColor}
                          onChange={(e) => setOnboardingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-16 h-10 p-1 border-primary/20"
                        />
                        <Input
                          type="text"
                          value={onboardingData.primaryColor}
                          onChange={(e) => setOnboardingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="flex-1 border-primary/20 focus:border-primary"
                          placeholder="#E03C91"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Goals */}
                <div className="space-y-3">
                  <Label htmlFor="businessGoals" className="text-black font-medium">
                    What are your main business goals with BVX? (Optional)
                  </Label>
                  <Textarea
                    id="businessGoals"
                    placeholder="e.g., Increase client retention, streamline booking process, grow my client base..."
                    value={onboardingData.businessGoals}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, businessGoals: e.target.value }))}
                    className="border-primary/20 focus:border-primary min-h-[100px]"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-6">
                  <Button
                    type="submit"
                    disabled={!isFormValid() || isLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Setting up your dashboard...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Complete Setup</span>
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-sm text-muted-foreground">
            Don't worry, you can always change these settings later in your dashboard
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}