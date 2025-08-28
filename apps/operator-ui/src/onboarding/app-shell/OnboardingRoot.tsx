import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { saveStep } from '../../sdk/onboardingClient'
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

const order: StepId[] = ['welcome','voice','basics','ops','connections','social','goals','styles','review']

export default function OnboardingRoot(){
  const navigate = useNavigate()
  const loc = useLocation()
  const [state, setState] = useState<OBState>({ step: 'welcome', data: {} })
  const { showToast } = useToast()

  useEffect(()=>{
    try{
      const sp = new URLSearchParams(loc.search)
      const connected = sp.get('connected')
      if (connected) {
        const provider = connected as string
        // Handle booking vs. social providers separately
        if (provider === 'instagram') {
          const payload = { social: { oauth: { instagram: { provider, linked: true } } } }
          void saveStep('social', payload)
          setState(s => ({ ...s, step: 'social', data: { ...s.data, ...payload } }))
          // Stay on Social step so user can run analyze/generate
          try { showToast({ title: 'Connected', description: 'Instagram linked. Ready to generate your plan.' }) } catch {}
          try { track('oauth_linked', { provider }) } catch {}
        } else {
          const payload = { connections: { bookingProvider: provider, oauth: { provider, linked: true } } }
          void saveStep('connections', payload)
          setState(s => ({ ...s, step: 'connections', data: { ...s.data, ...payload } }))
          try { track('oauth_linked', { provider }) } catch {}
          setTimeout(()=>{ void next(payload) }, 0)
        }
      }
    } catch {}
  }, [loc.search])

  const idx = useMemo(()=> order.indexOf(state.step), [state.step])

  const next = async (payload?: Record<string, any>) => {
    const merged = { ...state.data, ...(payload||{}) }
    try { await saveStep(state.step, payload||{}) } catch {}
    const nextStep = order[Math.min(idx+1, order.length-1)]
    setState({ step: nextStep, data: merged })
    if (nextStep === 'review') {
      try { localStorage.setItem('bvx_onboarding_last', JSON.stringify(merged)) } catch {}
    }
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
    navigate('/workspace?pane=dashboard')
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
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-white via-white/80 to-white">
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold tracking-tight text-slate-900 text-xl" style={{ fontFamily: 'Space Grotesk, Inter, system-ui' }}>Onboarding — 5 quick steps</h1>
            <p className="text-slate-600 text-sm">Beauty pros • Gentle setup • Your voice • Your clients</p>
            <p className="text-slate-600/90 text-[12px] mt-1">You can finish anytime in Settings / Connections.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button aria-label="Skip onboarding for now" variant="ghost" size="sm" onClick={()=> navigate('/workspace?pane=dashboard&tour=1')} className="rounded-full focus-visible:ring-2 focus-visible:ring-pink-300">Skip for now</Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <div className="flex items-center gap-2" aria-label="Progress">
          {order.map((s,i)=> (
            <div key={s} aria-label={s} aria-current={i===idx ? 'step' : undefined} className={`h-2 rounded-full transition-all ${i===idx? 'bg-pink-500 w-8':'bg-slate-200 w-3'}`} />
          ))}
          <div className="ml-auto text-xs text-slate-500">Step {idx+1}/{order.length}</div>
        </div>
        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div key={state.step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {Scene}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}


