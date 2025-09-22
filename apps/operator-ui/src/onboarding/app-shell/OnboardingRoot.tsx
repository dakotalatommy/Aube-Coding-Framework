import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../../components/ui/Button'
import CenteredCard from '../../components/ui/CenteredCard'
import { useToast } from '../../components/ui/Toast'
import { saveStep, loadLocalSnapshot } from '../../sdk/onboardingClient'
import { startOAuth } from '../../sdk/connectionsClient'
import { track } from '../../lib/analytics'

import SceneWelcomeTour from '../scenes/SceneWelcomeTour'
import SceneVoice from '../scenes/SceneVoice'
import SceneBusinessBasics from '../scenes/SceneBusinessBasics'
import SceneOpsMetrics from '../scenes/SceneOpsMetrics'
import SceneConnections from '../scenes/SceneConnections'
import SceneSocialEmail from '../scenes/SceneSocialEmail'
import SceneGoals from '../scenes/SceneGoals'
import SceneStyles from '../scenes/SceneStyles'
import SceneReview from '../scenes/SceneReview'

type StepId = 'welcome'|'voice'|'basics'|'ops'|'connections'|'social'|'goals'|'styles'|'review'

export type OBState = {
  step: StepId
  data: Record<string, any>
}

// Limit onboarding to 5 steps; remove Instagram/social handoff and anything beyond
const order: StepId[] = ['welcome','voice','basics','ops','connections']

export default function OnboardingRoot(){
  const navigate = useNavigate()
  const loc = useLocation()
  const [state, setState] = useState<OBState>({ step: 'welcome', data: {} })
  const { showToast } = useToast()
  const BOOKING_URL = (import.meta as any).env?.VITE_BOOKING_URL || ''

  useEffect(()=>{
    // Restore prior local snapshot if present
    (async()=>{
      try{
        const snap = await loadLocalSnapshot()
        if (snap && Object.keys(snap).length){
          setState(s=> ({ ...s, data: { ...snap } }))
        }
      }catch{}
    })()
    try{
      const sp = new URLSearchParams(loc.search)
      const connected = sp.get('connected')
      const error = sp.get('error')
      const provider = (sp.get('provider')||connected||'') as string
      if (error && provider) {
        // Stay in onboarding, surface error inline but do not navigate away
        try { track('oauth_error', { provider, error }) } catch {}
        // Surface a toast so user gets immediate feedback
        try { showToast({ title: `${provider} connection failed`, description: String(error) }) } catch {}
        // Keep current step; scene components may also show additional context
      } else if (connected) {
        // Handle booking vs. social providers separately
        if (provider === 'instagram') {
          // Record linkage but do not navigate to a non-existent sixth step
          const payload = { social: { oauth: { instagram: { provider, linked: true } } } }
          void saveStep('social', payload)
          setState(s => ({ ...s, data: { ...s.data, ...payload } }))
          try { showToast({ title: 'Connected', description: 'Instagram linked. You can manage this later in Integrations.' }) } catch {}
          try { track('oauth_linked', { provider }) } catch {}
          // Remain on current step
        } else {
          // Booking providers (square/acuity): mark connected, then bounce to Dashboard
          const payload = { connections: { bookingProvider: provider, oauth: { provider, linked: true } } }
          void saveStep('connections', payload)
          try { track('oauth_linked', { provider }) } catch {}
          try { showToast({ title: 'Connected', description: `${provider} linked. Redirecting to your Dashboard…` }) } catch {}
          // Normalize URL and resume showcase/workflow on Dashboard
          setTimeout(()=>{
            try{
              const u = new URL(window.location.href)
              u.pathname = '/workspace'
              u.searchParams.set('pane','dashboard')
              u.searchParams.delete('provider')
              u.searchParams.delete('connected')
              u.searchParams.delete('error')
              window.history.replaceState({}, '', u.toString())
              try { sessionStorage.setItem('bvx_showcase_resuming','1') } catch {}
              window.dispatchEvent(new CustomEvent('bvx:showcase:resume'))
            }catch{}
            navigate('/workspace?pane=dashboard')
          }, 200)
        }
      }
    } catch {}
  }, [loc.search])

  const idx = useMemo(()=> order.indexOf(state.step), [state.step])

  const next = async (payload?: Record<string, any>) => {
    const merged = { ...state.data, ...(payload||{}) }
    try { await saveStep(state.step, payload||{}) } catch {}
    // If we are on the final (5th) step, finish onboarding instead of advancing
    if (state.step === 'connections') {
      setState({ step: 'connections', data: merged })
      finish()
      return
    }
    const nextStep = order[Math.min(idx+1, order.length-1)]
    setState({ step: nextStep, data: merged })
  }
  const back = () => {
    const prev = order[Math.max(idx-1, 0)]
    setState(s => ({ ...s, step: prev }))
  }
  const save = async (payload?: Record<string, any>) => {
    const merged = { ...state.data, ...(payload||{}) }
    try { await saveStep(state.step, payload||{}) } catch {}
    setState(s => ({ ...s, data: merged }))
  }

  const finish = () => {
    try { localStorage.setItem('bvx_onboarding_done', '1') } catch {}
    try { localStorage.removeItem('bvx_guide_done') } catch {}
    try { sessionStorage.removeItem('bvx_resume') } catch {}
    try { if (BOOKING_URL) localStorage.setItem('bvx_booking_nudge','1') } catch {}
    try { (window as any).posthog?.capture?.('onboarding_complete'); } catch {}
    navigate('/workspace?pane=dashboard&tour=1')
  }

  const sceneProps = { state, next, back, save, startOAuth }

  const Scene = (()=>{
    switch(state.step){
      case 'welcome': return <SceneWelcomeTour {...sceneProps} />
      case 'voice': return <SceneVoice {...sceneProps} />
      case 'basics': return <SceneBusinessBasics {...sceneProps} />
      case 'ops': return <SceneOpsMetrics {...sceneProps} />
      case 'connections': return <SceneConnections {...sceneProps} />
      case 'social': return <SceneSocialEmail {...sceneProps} />
      case 'goals': return <SceneGoals {...sceneProps} />
      case 'styles': return <SceneStyles {...sceneProps} />
      case 'review': return <SceneReview {...sceneProps} onFinish={finish} />
    }
  })()

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden px-4 py-8">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(900px 320px at 10% -10%, rgba(236,72,153,0.08), transparent), radial-gradient(700px 240px at 90% -20%, rgba(99,102,241,0.08), transparent)'
      }} />
      <CenteredCard maxWidthClass="max-w-[720px]" minHeightClass="min-h-[560px]">
        <header className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold tracking-tight text-slate-900 text-xl" style={{ fontFamily: 'Space Grotesk, Inter, system-ui' }}>Onboarding — 5 quick steps</h1>
              <p className="text-slate-600 text-sm">Beauty pros • Gentle setup • Your voice • Your clients</p>
              <p className="text-slate-600/90 text-[12px] mt-1">You can finish anytime in Settings / Connections.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button aria-label="Skip onboarding for now" variant="ghost" size="sm" onClick={()=> navigate('/workspace?pane=dashboard&tour=1')} className="rounded-full focus-visible:ring-2 focus-visible:ring-[var(--ring)]">Skip for now</Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2" aria-label="Progress">
            {/* Lock visible progress to 5 steps that matter now */}
            {Array.from({ length: 5 }).map((_,i)=> (
              <div key={i} aria-label={`step-${i+1}`} aria-current={i===Math.min(idx,4) ? 'step' : undefined} className={`h-2 rounded-full transition-all ${i===Math.min(idx,4)? 'bg-pink-500 w-8':'bg-slate-200 w-3'}`} />
            ))}
            <div className="ml-auto text-xs text-slate-500">Step {Math.min(idx+1,5)}/5</div>
          </div>
        </header>
        <main className="relative z-10 mt-4">
          <AnimatePresence mode="wait">
            <motion.div key={state.step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {Scene}
            </motion.div>
          </AnimatePresence>
        </main>
      </CenteredCard>
    </div>
  )
}
