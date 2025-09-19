import { useEffect, useMemo, useRef } from 'react';
import { createWorkspaceOnboardingController } from '../onboarding/workspace/orchestrator';
import type { OnboardingEffects, WorkspaceOnboardingController } from '../onboarding/workspace/orchestrator';
import type { WorkspaceStorage } from '../onboarding/workspace/storage';

interface UseWorkspaceOnboardingControllerOptions {
  storage?: WorkspaceStorage;
  logger?: (message: string, data?: any) => void;
  exposeDebugHelpers?: boolean;
}

export function useWorkspaceOnboardingController(
  effects: OnboardingEffects,
  options: UseWorkspaceOnboardingControllerOptions = {}
): WorkspaceOnboardingController {
  const effectsRef = useRef(effects);
  useEffect(() => { effectsRef.current = effects; }, [effects]);

  const controller = useMemo(() => {
    const proxyEffects: OnboardingEffects = {
      showWelcome: (ctx) => effectsRef.current.showWelcome(ctx),
      runTour: (ctx) => effectsRef.current.runTour(ctx),
      ensureBilling: (ctx) => effectsRef.current.ensureBilling(ctx),
      runDashboardGuide: (ctx) => effectsRef.current.runDashboardGuide(ctx),
      runQuickstart: (ctx) => effectsRef.current.runQuickstart(ctx),
      complete: (ctx) => effectsRef.current.complete(ctx),
      handleError: effectsRef.current.handleError
        ? (ctx) => effectsRef.current.handleError?.(ctx)
        : undefined,
    };
    return createWorkspaceOnboardingController({
      storage: options.storage,
      logger: options.logger,
      effects: proxyEffects,
    });
  }, [options.storage, options.logger]);

  useEffect(() => {
    if (!options.exposeDebugHelpers) return;
    const helpers = {
      controller,
      state: () => controller.getState(),
      start: (force = false) => controller.start({ force }),
      reset: controller.reset,
      bus: controller.bus,
    };
    (window as any).__onboarding = helpers;
    return () => {
      if ((window as any).__onboarding?.controller === controller) {
        delete (window as any).__onboarding;
      }
    };
  }, [controller, options.exposeDebugHelpers]);

  return controller;
}
