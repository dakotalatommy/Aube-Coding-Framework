import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Separator } from './ui/separator'
import bvxLogo from '../assets/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'
import { supabase } from '../../lib/supabase'

export function SignUp() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}
    if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required'
    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address'
    }
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required'
    if (!formData.password) {
      nextErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Minimum 8 characters'
    }
    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    setErrorMessage('')
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
          },
        },
      })
      if (error) throw error
      try { localStorage.setItem('bvx_offer_pending', '1') } catch {}
      setAwaitingConfirm(true)
    } catch (err: any) {
      setErrorMessage(String(err?.message || err || 'Unable to create account'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      })
      if (error) throw error
      if (data?.url) window.location.assign(data.url)
    } catch (err: any) {
      setErrorMessage(String(err?.message || err || 'Unable to start Google sign-up'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <img src={bvxLogo} alt="BVX Logo" className="h-16 w-auto mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Join BVX
            </h1>
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Start transforming your beauty business today
            </p>
          </motion.div>

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
                {!awaitingConfirm ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-black font-medium">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => handleInputChange('fullName', e.target.value)}
                          placeholder="Sarah Johnson"
                          className={`pl-10 border-primary/20 focus:border-primary ${errors.fullName ? 'border-destructive' : ''}`}
                          required
                        />
                      </div>
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-black font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="sarah@elegantbeauty.com"
                          className={`pl-10 border-primary/20 focus:border-primary ${errors.email ? 'border-destructive' : ''}`}
                          required
                        />
                      </div>
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-black font-medium">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="(555) 123-4567"
                          className={`pl-10 border-primary/20 focus:border-primary ${errors.phone ? 'border-destructive' : ''}`}
                          required
                        />
                      </div>
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-black font-medium">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          placeholder="Create a password"
                          className={`pl-10 pr-10 border-primary/20 focus:border-primary ${errors.password ? 'border-destructive' : ''}`}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(prev => !prev)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-black font-medium">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          placeholder="Confirm password"
                          className={`pl-10 border-primary/20 focus:border-primary ${errors.confirmPassword ? 'border-destructive' : ''}`}
                          required
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                    </div>

                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                      {isLoading ? 'Creating account…' : (
                        <div className="flex items-center justify-center space-x-2">
                          <span>Create account</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </Button>
                    {errorMessage && (
                      <p className="text-sm text-red-600 text-center" role="alert">{errorMessage}</p>
                    )}

                    <Separator />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 md:h-14"
                      onClick={handleGoogleSignUp}
                      disabled={isLoading}
                    >
                      Continue with Google
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="p-4 rounded-lg bg-secondary/20 border border-secondary/40 text-sm text-muted-foreground">
                      We sent a confirmation link to <strong>{formData.email}</strong>. After you confirm, we’ll open onboarding automatically.
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button type="button" variant="outline" onClick={() => window.open('https://mail.google.com', '_blank')}>
                        Open Gmail
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isLoading}
                        onClick={async () => {
                          setIsLoading(true)
                          try {
                            const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`
                            await supabase.auth.resend({ type: 'signup', email: formData.email, options: { emailRedirectTo: redirectTo } })
                            setErrorMessage('Verification email resent!')
                          } catch (err: any) {
                            setErrorMessage(String(err?.message || err || 'Unable to resend verification email'))
                          } finally {
                            setIsLoading(false)
                          }
                        }}
                      >
                        Resend verification email
                      </Button>
                    </div>
                    {errorMessage && (
                      <p className="text-sm text-muted-foreground" role="status">{errorMessage}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            className="text-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Button type="button" variant="ghost" onClick={() => (window.location.href = '/login')}>
              <div className="flex items-center justify-center gap-2 text-primary font-medium">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </div>
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full"
            animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-48 h-48 bg-white/10 rounded-full"
            animate={{ scale: [1, 1.2, 1], rotate: [360, 180, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="flex items-center space-x-3 mb-6">
              <Sparkles className="h-8 w-8" />
              <h2 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
                Build a smarter beauty business
              </h2>
            </div>
            <div className="space-y-6 max-w-md">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Automate your follow-ups</h3>
                    <p className="text-white/80 text-sm">Personalized messaging sequences ready out of the box.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Delight your clients</h3>
                    <p className="text-white/80 text-sm">AI-powered consultations, reminders, and tailored experiences.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Grow with confidence</h3>
                    <p className="text-white/80 text-sm">Real-time KPIs that highlight wins and opportunities.</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm">Beauty pros trust BVX</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">15h</div>
                    <div className="text-xs text-white/80">Saved monthly</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">+32%</div>
                    <div className="text-xs text-white/80">Revenue lift</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-tl-full"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  )
}
