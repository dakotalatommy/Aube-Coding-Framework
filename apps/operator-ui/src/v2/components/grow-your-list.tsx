import LockedFeaturesOverlay from './locked-features-overlay'

export function GrowYourList() {
  return (
    <LockedFeaturesOverlay
      title="Fill Your Chair"
      description="Launch AI-built landing pages, capture leads, and plug them into automated nurture flows."
      benefits={[
        'Pre-built landing pages optimized for beauty bookings',
        'AI-crafted follow-up campaigns that convert browsers into VIP clients',
        'Campaign analytics that show revenue per channel and creative',
      ]}
      onUpgrade={() =>
        window.dispatchEvent(new CustomEvent('bvx:ui:navigate', { detail: '/settings?tab=plan' }))
      }
    />
  )
}

export default GrowYourList
