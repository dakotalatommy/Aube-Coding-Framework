import { useState } from 'react'
import { motion } from 'motion/react'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import bvxLogo from 'figma:asset/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'

interface SignUpProps {
  onSignUp: (userData: any) => void
  onBackToSignIn: () => void
}

export function SignUp({ onSignUp, onBackToSignIn }: SignUpProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsLoading(false)
    onSignUp(formData)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Logo */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <img
              src={bvxLogo}
              alt="BVX Logo"
              className="h-16 w-auto mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Join BVX
            </h1>
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Start transforming your beauty business today
            </p>
          </motion.div>

          {/* Sign Up Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="border-primary/20 shadow-lg">
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-2xl text-center text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Create Account
                </CardTitle>
                <CardDescription className="text-center">
                  Fill in your details to get started
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-black font-medium">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Sarah Johnson"
                        value={formData.fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        className={`pl-10 border-primary/20 focus:border-primary ${errors.fullName ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-black font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="sarah@elegantbeauty.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={`pl-10 border-primary/20 focus:border-primary ${errors.email ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-black font-medium">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={`pl-10 border-primary/20 focus:border-primary ${errors.phone ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone}</p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-black font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className={`pl-10 pr-10 border-primary/20 focus:border-primary ${errors.password ? 'border-destructive' : ''}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-black font-medium">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={`pl-10 border-primary/20 focus:border-primary ${errors.confirmPassword ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="flex items-start space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="terms"
                      className="rounded border-primary/20 text-primary focus:ring-primary mt-1"
                      required
                    />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                      I agree to the{' '}
                      <button type="button" className="text-primary hover:text-primary/80 font-medium">
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button type="button" className="text-primary hover:text-primary/80 font-medium">
                        Privacy Policy
                      </button>
                    </Label>
                  </div>

                  {/* Create Account Button */}
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-6"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Create Account</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </Button>
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
              Already have an account?{' '}
              <button 
                onClick={onBackToSignIn}
                className="text-primary hover:text-primary/80 font-medium"
              >
                Sign in
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Right Side - Welcome Content */}
      <motion.div
        className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-48 h-48 bg-white/10 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [360, 180, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="flex items-center space-x-3 mb-6">
              <Sparkles className="h-8 w-8" />
              <h2 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
                Welcome to the Future
              </h2>
            </div>
            
            <div className="space-y-6 max-w-md">
              <p className="text-white/90 text-lg leading-relaxed">
                Join thousands of beauty professionals who've transformed their businesses with BVX's AI-powered platform.
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Quick Setup</h3>
                    <p className="text-white/80 text-sm">
                      Get started in minutes with our guided onboarding
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Personalized Experience</h3>
                    <p className="text-white/80 text-sm">
                      Tailored to your specific beauty profession and goals
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Immediate Impact</h3>
                    <p className="text-white/80 text-sm">
                      Start seeing results from day one
                    </p>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Ready to get started?</h4>
                <p className="text-white/80 text-sm">
                  Complete your registration and we'll guide you through setting up your personalized BVX dashboard.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}