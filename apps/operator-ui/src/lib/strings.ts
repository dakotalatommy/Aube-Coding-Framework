export const UI_STRINGS = {
  businessNumber: {
    sectionTitle: 'Business number',
    header: 'Dedicated business number',
    prompt: 'Would you like a dedicated business number for text messaging?',
    blurb: 'Keeps your personal number private. Clients can text and reply like normal.',
    actions: {
      enableNow: 'Yes, set me up',
      notNow: 'Not now',
      removeNumber: 'Remove business number',
      changeNumber: 'Change number',
      verify: 'Verify'
    },
    fields: {
      areaCode: 'Preferred area code',
      forwardingNumber: 'Forward calls to',
      verificationCode: 'Verification code',
      callerId: 'Caller ID name'
    },
    placeholders: {
      areaCode: 'e.g., 615',
      forwardingNumber: '(123) 456-7890',
      verificationCode: 'Enter 6-digit code',
      callerId: 'Your business name'
    },
    tooltips: {
      areaCode: 'We’ll try to match availability in your area.',
      forwardingNumber: 'Where calls to your business number should ring.',
      callerId: 'Shown to recipients where supported.'
    },
    banners: {
      provisioned: 'Your business number is ready.',
      pendingProvision: 'Provisioning your number. This can take up to a minute.',
      removed: 'Business number removed.'
    },
    toasts: {
      provisionSuccess: 'Business number set up.',
      verificationSent: 'Verification code sent.',
      verificationSuccess: 'Number verified.',
      updated: 'Business number settings saved.',
      removed: 'Business number removed.'
    },
    errors: {
      unavailable: 'No numbers available for that area code. Try another.',
      invalidForward: 'Please enter a valid forwarding number.',
      verificationFailed: 'That code didn’t match. Try again.',
      generic: 'Something went wrong. Please try again.'
    },
    notes: {
      manageAnytime: 'You can change this anytime in Settings.',
      smsRates: 'Standard messaging rates may apply.'
    }
  },

  quietHours: {
    sectionTitle: 'Quiet hours',
    description: 'Pause messages during your off hours.',
    helper: 'We’ll queue messages during quiet hours and send when they end.',
    fields: {
      start: 'Start',
      end: 'End',
      timezone: 'Time zone',
      days: 'Days'
    },
    toggles: {
      enabled: 'Enable quiet hours',
      applySms: 'Apply to SMS',
      applyEmail: 'Apply to email'
    },
    presets: {
      weekdayEvenings: 'Weekday evenings',
      weekends: 'Weekends',
      custom: 'Custom'
    },
    placeholders: {
      timezone: 'Auto-detected'
    },
    toasts: {
      saved: 'Quiet hours saved.',
      disabled: 'Quiet hours disabled.'
    },
    errors: {
      endBeforeStart: 'End time must be after start time.',
      missingRange: 'Please choose a start and end time.',
      generic: 'Couldn’t save quiet hours. Please try again.'
    }
  },

  ctas: {
    primary: {
      startFreeWeek: 'Start your free week — no pressure',
      continue: 'Continue',
      getStarted: 'Get started — we’ll guide you',
      saveChanges: 'Save — quick and easy',
      send: 'Send',
      connectSquare: 'Connect Square (booking)',
      importContactsSquare: 'Import contacts from Square',
      connectGoogleCalendar: 'Connect Google Calendar (one‑way sync for now)',
      connectHubSpot: 'Connect HubSpot (CRM)',
      connectAcuity: 'Connect Acuity (booking)'
    },
    secondary: {
      preview: 'Preview',
      syncHubSpot: 'Sync from HubSpot',
      reanalyze: 'Re‑analyze',
      refresh: 'Refresh',
      save: 'Save',
      copy: 'Copy to clipboard',
      copyRecipients: 'Copy recipients',
      copyMessage: 'Copy message',
      saveToApprovals: 'Save to To‑Do (review later)',
      markAsSent: 'Mark as sent',
      draftForMe: 'Draft for me',
      simulateSms: 'Simulate SMS (respects STOP/HELP)',
      simulateEmail: 'Simulate Email',
      openCalendar: 'Open Calendar view',
      openInventory: 'Open Inventory view',
      openInbox: 'Open Inbox view',
      connectGoogle: 'Connect Google',
      connectShopify: 'Connect Shopify',
      connectInstagram: 'Connect Instagram',
      openSquareBooking: 'Open Square booking',
      noLinkSet: 'No link set',
      importSampleAppointments: 'Import sample appointments',
      sendTestSms: 'Send test SMS',
      sendTestEmail: 'Send test email',
      provisionNumber: 'Provision number',
      openTwilioConsole: 'Open Twilio Console',
      twilioSmsGuide: 'Twilio SMS Guide',
      enableSms: 'Enable SMS',
      importFromBooking: 'Import from booking',
      syncFromHubSpot: 'Sync from CRM (HubSpot)',
      howToImport: 'How to import',
      createAccount: 'Create account',
      addPayment: 'Add payment',
      syncNowGoogle: 'Sync now (Google)',
      syncNowApple: 'Sync now (Apple)',
      mergeBookings: 'Merge bookings',
      deduplicate: 'Deduplicate',
      stop: 'STOP',
      erase: 'Erase'
    },
    dashboard: {
      importContacts: 'Import Contacts',
      startCadence: 'Start Cadence',
      simulateMessage: 'Simulate Message',
      connectTools: 'Connect Tools',
      shareResults: 'Share results',
      billing: 'Billing'
    },
    tertiary: {
      learnMore: 'Learn more',
      shareDemo: 'Share demo',
      guideMe: 'Guide me',
      useInMessages: 'Use this text in Messages',
      connectSmsTwilio: 'Connect SMS (Twilio)'
    },
    demoOnly: {
      signUp: 'Sign up',
      shareLandingCopied: 'Demo link copied.'
    },
    liveOnly: {
      signOut: 'Sign out'
    },
    toasts: {
      saved: 'Saved.',
      copied: 'Copied.',
      actionQueued: 'Queued. This may take a moment.'
    },
    errors: {
      corsBlocked: 'Blocked by browser. Please try again or check settings.',
      authRequired: 'Please sign in to continue.',
      generic: 'Something went wrong. Please try again.'
    }
  },

  emptyStates: {
    businessNumber: {
      title: 'Add a dedicated business number',
      body: 'Text with clients from a number that represents your brand.',
      action: 'Set up business number'
    },
    quietHours: {
      title: 'Set quiet hours',
      body: 'Pause messages during your off hours. We’ll resume automatically.',
      action: 'Create schedule'
    },
    messages: {
      title: 'No messages yet',
      body: 'Try Simulate SMS to generate a sample that respects STOP/HELP and consent.',
      action: 'Simulate SMS'
    },
    calendar: {
      title: 'No events yet',
      body: 'Connect Google/Apple and Booking to see your unified calendar.'
    }
  },

  a11y: {
    toggles: {
      businessNumber: 'Toggle dedicated business number',
      quietHours: 'Toggle quiet hours'
    },
    buttons: {
      saveChanges: 'Save changes',
      cancel: 'Cancel',
      verify: 'Verify business number',
      refresh: 'Refresh list',
      simulateSms: 'Simulate SMS',
      simulateEmail: 'Simulate Email',
      guideDashboard: 'Open dashboard guide',
      guideContacts: 'Open contacts guide',
      guideMessages: 'Open messages guide',
      guideCalendar: 'Open calendar guide',
      saveQuietHours: 'Save quiet hours',
      sendMessage: 'Send message'
    }
  }
} as const;

export type UIStrings = typeof UI_STRINGS;


