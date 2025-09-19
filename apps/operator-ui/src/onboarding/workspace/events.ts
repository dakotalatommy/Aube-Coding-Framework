export type OnboardingPhase = 'idle'|'welcome'|'tour'|'billing'|'dashboard'|'quickstart'|'complete'|'error';

export type OnboardingEvent =
  | { type: 'phase'; phase: OnboardingPhase }
  | { type: 'log'; message: string; data?: any }
  | { type: 'error'; error: Error }
  | { type: 'reset' };

type Listener = (event: OnboardingEvent) => void;

export function createOnboardingEventBus() {
  const listeners = new Set<Listener>();
  return {
    emit(event: OnboardingEvent) {
      listeners.forEach(listener => {
        try { listener(event); } catch (err) { console.error('onboarding event listener error', err); }
      });
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type OnboardingEventBus = ReturnType<typeof createOnboardingEventBus>;
