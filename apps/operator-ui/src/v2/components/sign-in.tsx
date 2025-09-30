import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Separator } from './ui/separator'
import bvxLogo from '../assets/539f8d3190f79d835fe0af50f92a753850eb6ff7.png'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export function SignIn() {
  const nav = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      try {
        const ret = localStorage.getItem('bvx_auth_return')
        if (ret) {
          localStorage.removeItem('bvx_auth_return')
          window.location.assign(ret)
          return
        }
      } catch {}
      nav('/workspace')
    } catch (err: any) {
      setErrorMessage(String(err?.message || err || 'Unable to sign in'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMessage('Enter your email above to receive a reset link.')
      return
    }
    setIsLoading(true)
    setErrorMessage('')
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/workspace?pane=dashboard`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
      setErrorMessage('Password reset email sent. Check your inbox!')
    } catch (err: any) {
      setErrorMessage(String(err?.message || err || 'Unable to send reset email'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/workspace?pane=dashboard`
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          flowType: 'pkce',
        },
      })
      if (error) throw error
      if (data?.url) {
        window.location.assign(data.url)
        return
      }
      setIsLoading(false)
    } catch (err: any) {
      setErrorMessage(String(err?.message || err || 'Unable to start Google sign-in'))
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
            <img src={bvxLogo} alt="BVX Logo" className="h-20 w-auto mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Welcome to BVX
            </h1>
            <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Your AI-powered beauty business platform
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
                  Sign In
                </CardTitle>
                <CardDescription className="text-center">
                  Access your beauty business dashboard
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-black font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="sarah@elegantbeauty.com"
                        className="pl-10 border-primary/20 focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-black font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 border-primary/20 focus:border-primary"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className="text-sm text-primary hover:text-primary/80 font-medium"
                      onClick={handleForgotPassword}
                      disabled={isLoading}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Signing in…</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>Sign in</span>
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
                    onClick={handleGoogle}
                    disabled={isLoading}
                  >
                    Continue with Google
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            className="text-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <button
                onClick={() => nav('/signup')}
                className="text-primary hover:text-primary/80 font-medium"
              >
                Sign up
              </button>
            </p>
            <p className="text-xs text-muted-foreground mt-2">© 2025 BVX Beauty. All rights reserved.</p>
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
                Transform Your Beauty Business
              </h2>
            </div>

            <div className="space-y-6 max-w-md">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">AI-Powered Consultations</h3>
                    <p className="text-white/80 text-sm">Generate stunning before/after visualizations with BrandVZN.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Client Management</h3>
                    <p className="text-white/80 text-sm">Organize appointments, track progress, and boost retention.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Business Analytics</h3>
                    <p className="text-white/80 text-sm">Real-time insights to grow your beauty business.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm">Join 1,000+ Beauty Professionals</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">+45%</div>
                    <div className="text-xs text-white/80">Revenue Growth</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">90%</div>
                    <div className="text-xs text-white/80">Client Retention</div>
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
