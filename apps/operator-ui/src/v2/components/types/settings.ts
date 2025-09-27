export interface ProfileSettings {
  firstName: string
  lastName: string
  email: string
  phone?: string
  profileImageUrl?: string | null
}

export interface BusinessSettings {
  businessName: string
  address?: string
  phone?: string
  email?: string
  website?: string
  hours?: string
  description?: string
}

export interface BrandSettings {
  primaryColor?: string
  accentColor?: string
  logoUrl?: string | null
  tagline?: string
  bio?: string
  socialInstagram?: string
  socialFacebook?: string
  socialTiktok?: string
}

export interface NotificationsSettings {
  emailMarketing: boolean
  appointmentReminders: boolean
  clientUpdates: boolean
  systemUpdates: boolean
}

export interface GoalSettings {
  weeklyClients?: number
  monthlyClients?: number
  clientRetentionRate?: number
  newClientsPerMonth?: number
  monthlyRevenue?: number
  yearlyRevenue?: number
  averageServicePrice?: number
  upsellRate?: number
  socialMediaFollowers?: number
  emailListSize?: number
  referralRate?: number
  bookingConversionRate?: number
  hoursWorkedPerWeek?: number
  averageServiceTime?: number
  bookingBuffer?: number
  adminTimePerDay?: number
}

export interface TwilioSettings {
  accountSid?: string
  authToken?: string
  phoneNumber?: string
  subaccountSid?: string
  fromNumber?: string
  provisioned?: boolean
  showAuthToken?: boolean
}

export interface PlanTier {
  name: string
  price: number
  description: string
  features: string[]
  color: string
  badge?: string | null
}

export interface IntegrationStatusItem {
  provider: string
  linked: boolean
  status?: string
  lastSyncTs?: number | null
  expiresAt?: number | null
  connectUrl?: string | null
}

export interface SettingsResponseData {
  profile?: ProfileSettings
  business?: BusinessSettings
  brand_profile?: BrandSettings
  notifications?: NotificationsSettings
  goals?: GoalSettings
  messaging?: {
    twilio_subaccount_sid?: string
    twilio_auth_token?: string
    sms_from_number?: string
    provision_requested_at?: number
  }
  quiet_hours?: {
    start?: string
    end?: string
  }
  tone?: string
  services?: Array<{ id: string; name: string }>
  preferences?: Record<string, unknown>
  training_notes?: string
  completed?: boolean
  providers_live?: Record<string, boolean>
  wf_progress?: Record<string, boolean>
  subscription_status?: string
  trial_end_ts?: number
}

export interface SettingsPayload {
  tenant_id: string
  tone?: string
  services?: Array<{ id: string; name: string }>
  preferences?: Record<string, unknown>
  brand_profile?: BrandSettings
  quiet_hours?: { start?: string; end?: string }
  training_notes?: string
  completed?: boolean
  providers_live?: Record<string, boolean>
  messaging?: {
    twilio_subaccount_sid?: string
    twilio_auth_token?: string
    sms_from_number?: string
  }
}
