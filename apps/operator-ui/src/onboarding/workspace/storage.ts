const LOCAL_KEYS = {
  quickstartVision: 'bvx_done_vision',
  quickstartContacts: 'bvx_done_contacts',
  quickstartPlan: 'bvx_done_plan',
  quickstartCompleted: 'bvx_quickstart_completed',
  welcomeSeen: 'bvx_welcome_seen',
  guideDone: 'bvx_guide_done',
  billingDismissed: 'bvx_billing_dismissed',
  onboardingDone: 'bvx_onboarding_done',
  bookingNudge: 'bvx_booking_nudge',
  tenant: 'bvx_tenant',
  trialStartedAt: 'bvx_trial_started_at',
};

const SESSION_KEYS = {
  introSession: 'bvx_intro_session',
};

export type StorageResetOptions = {
  resetServerFlags?: () => Promise<void>;
  keepTenant?: boolean;
};

const safeStorage = {
  getLocal(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setLocal(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  },
  removeLocal(key: string) {
    try { localStorage.removeItem(key); } catch {}
  },
  getSession(key: string) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  setSession(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {}
  },
  removeSession(key: string) {
    try { sessionStorage.removeItem(key); } catch {}
  },
};

export const workspaceStorage = {
  keys: { ...LOCAL_KEYS, ...SESSION_KEYS },
  getGuideDone() {
    return safeStorage.getLocal(LOCAL_KEYS.guideDone) === '1';
  },
  setGuideDone(done: boolean) {
    safeStorage.setLocal(LOCAL_KEYS.guideDone, done ? '1' : null);
  },
  markWelcomeSeen() {
    safeStorage.setLocal(LOCAL_KEYS.welcomeSeen, '1');
    safeStorage.setSession(SESSION_KEYS.introSession, '1');
  },
  hasSeenWelcome() {
    const ever = safeStorage.getLocal(LOCAL_KEYS.welcomeSeen) === '1';
    const session = safeStorage.getSession(SESSION_KEYS.introSession) === '1';
    return ever || session;
  },
  clearWelcome() {
    safeStorage.removeLocal(LOCAL_KEYS.welcomeSeen);
    safeStorage.removeSession(SESSION_KEYS.introSession);
  },
  clearQuickstart() {
    safeStorage.removeLocal(LOCAL_KEYS.quickstartVision);
    safeStorage.removeLocal(LOCAL_KEYS.quickstartContacts);
    safeStorage.removeLocal(LOCAL_KEYS.quickstartPlan);
    safeStorage.removeLocal(LOCAL_KEYS.quickstartCompleted);
  },
  clearBillingDismissed() {
    safeStorage.removeLocal(LOCAL_KEYS.billingDismissed);
  },
  setBillingDismissed() {
    safeStorage.setLocal(LOCAL_KEYS.billingDismissed, '1');
  },
  isBillingDismissed() {
    return safeStorage.getLocal(LOCAL_KEYS.billingDismissed) === '1';
  },
  clearBookingNudge() {
    safeStorage.removeLocal(LOCAL_KEYS.bookingNudge);
  },
  async forceReset(options: StorageResetOptions = {}) {
    const tenant = options.keepTenant ? safeStorage.getLocal(LOCAL_KEYS.tenant) : null;
    this.clearQuickstart();
    this.clearWelcome();
    this.clearBillingDismissed();
    safeStorage.removeLocal(LOCAL_KEYS.onboardingDone);
    safeStorage.removeLocal(LOCAL_KEYS.trialStartedAt);
    safeStorage.removeLocal(LOCAL_KEYS.guideDone);
    safeStorage.removeLocal(LOCAL_KEYS.bookingNudge);
    safeStorage.removeSession(SESSION_KEYS.introSession);
    if (options.keepTenant && tenant) {
      safeStorage.setLocal(LOCAL_KEYS.tenant, tenant);
    }
    if (options.resetServerFlags) {
      try {
        await options.resetServerFlags();
      } catch (err) {
        console.error('workspaceStorage.forceReset server reset failed', err);
      }
    }
  },
};

export type WorkspaceStorage = typeof workspaceStorage;
