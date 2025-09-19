import { workspaceStorage } from './storage';
import type { WorkspaceStorage } from './storage';
import { createOnboardingEventBus } from './events';
import type { OnboardingEventBus, OnboardingPhase } from './events';

export type OnboardingState = {
  phase: OnboardingPhase;
  forced: boolean;
  running: boolean;
  error?: Error;
};

export interface OnboardingEffects {
  showWelcome: (ctx: { forced: boolean }) => Promise<void>;
  runTour: (ctx: { forced: boolean }) => Promise<void>;
  ensureBilling: (ctx: { forced: boolean }) => Promise<void>;
  runDashboardGuide: (ctx: { forced: boolean }) => Promise<void>;
  runQuickstart: (ctx: { forced: boolean }) => Promise<void>;
  complete: (ctx: { forced: boolean }) => Promise<void>;
  handleError?: (ctx: { forced: boolean; error: Error }) => Promise<void> | void;
}

export interface WorkspaceOnboardingController {
  start(options?: { force?: boolean }): Promise<void>;
  reset(options?: { serverReset?: () => Promise<void> }): Promise<void>;
  getState(): OnboardingState;
  subscribe(listener: (state: OnboardingState) => void): () => void;
  bus: OnboardingEventBus;
}

interface ControllerConfig {
  storage?: WorkspaceStorage;
  effects: OnboardingEffects;
  logger?: (message: string, data?: any) => void;
}

export function createWorkspaceOnboardingController(config: ControllerConfig): WorkspaceOnboardingController {
  const storage = config.storage ?? workspaceStorage;
  const bus = createOnboardingEventBus();
  let state: OnboardingState = { phase: 'idle', forced: false, running: false };
  const listeners = new Set<(state: OnboardingState) => void>();
  let currentSequence: Promise<void> | null = null;

  const emitState = (next: Partial<OnboardingState>) => {
    state = { ...state, ...next };
    listeners.forEach(listener => {
      try { listener(state); } catch (err) { console.error('workspace onboarding listener error', err); }
    });
    bus.emit({ type: 'phase', phase: state.phase });
  };

  const log = (message: string, data?: any) => {
    config.logger?.(message, data);
    bus.emit({ type: 'log', message, data });
  };

  const runSequence = async (forced: boolean) => {
    emitState({ running: true, forced });
    try {
      emitState({ phase: 'welcome' });
      await config.effects.showWelcome({ forced });

      emitState({ phase: 'tour' });
      await config.effects.runTour({ forced });

      emitState({ phase: 'billing' });
      await config.effects.ensureBilling({ forced });

      emitState({ phase: 'dashboard' });
      await config.effects.runDashboardGuide({ forced });

      emitState({ phase: 'quickstart' });
      await config.effects.runQuickstart({ forced });

      emitState({ phase: 'complete' });
      await config.effects.complete({ forced });
      emitState({ running: false });
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      log('onboarding:error', { error: errorObj.message });
      emitState({ phase: 'error', running: false, error: errorObj });
      config.effects.handleError?.({ forced, error: errorObj });
      bus.emit({ type: 'error', error: errorObj });
      throw errorObj;
    }
  };

  const controller: WorkspaceOnboardingController = {
    async start(options) {
      const forced = !!options?.force;
      if (currentSequence) return currentSequence;
      log('onboarding:start', { forced });
      currentSequence = runSequence(forced).finally(() => { currentSequence = null; });
      await currentSequence;
    },
    async reset(options) {
      log('onboarding:reset');
      await storage.forceReset({
        keepTenant: true,
        resetServerFlags: options?.serverReset,
      });
      emitState({ phase: 'idle', forced: false, running: false, error: undefined });
      bus.emit({ type: 'reset' });
    },
    getState() {
      return { ...state };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    bus,
  };

  return controller;
}
