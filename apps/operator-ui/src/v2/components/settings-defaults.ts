import type * as SettingsTypes from './types/settings.ts'

export type {
  ProfileSettings,
  BusinessSettings,
  BrandSettings,
  NotificationsSettings,
  GoalSettings,
  TwilioSettings,
  IntegrationStatusItem,
  SettingsResponseData,
  SettingsPayload,
} from './types/settings.ts'

export const DEFAULT_PROFILE: SettingsTypes.ProfileSettings = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah@elegantbeauty.com',
  phone: '+1 (555) 123-4567',
}

export const DEFAULT_BUSINESS: SettingsTypes.BusinessSettings = {
  businessName: 'Elegant Beauty Studio',
  address: '123 Beauty Lane, Beverly Hills, CA 90210',
  phone: '+1 (555) 123-4567',
  email: 'hello@elegantbeauty.com',
  website: 'www.elegantbeauty.com',
  hours: 'Mon-Fri: 9AM-7PM, Sat: 9AM-5PM, Sun: Closed',
  description: 'Premium beauty services specializing in skincare, makeup, and wellness treatments.',
}

export const DEFAULT_BRAND: SettingsTypes.BrandSettings = {
  primaryColor: '#E03C91',
  accentColor: '#2F5D9F',
  tagline: 'Where Beauty Meets Excellence',
  bio: 'Creating beautiful transformations with personalized beauty solutions.',
  socialInstagram: '@elegantbeauty',
  socialFacebook: 'Elegant Beauty Studio',
  socialTiktok: '@elegantbeauty',
}

export const DEFAULT_NOTIFICATIONS: SettingsTypes.NotificationsSettings = {
  emailMarketing: true,
  appointmentReminders: true,
  clientUpdates: true,
  systemUpdates: false,
}

export const DEFAULT_GOALS: SettingsTypes.GoalSettings = {
  weeklyClients: 25,
  monthlyClients: 100,
  clientRetentionRate: 85,
  newClientsPerMonth: 15,
  monthlyRevenue: 8000,
  yearlyRevenue: 96000,
  averageServicePrice: 120,
  upsellRate: 30,
  socialMediaFollowers: 5000,
  emailListSize: 1000,
  referralRate: 20,
  bookingConversionRate: 60,
  hoursWorkedPerWeek: 35,
  averageServiceTime: 90,
  bookingBuffer: 15,
  adminTimePerDay: 30,
}

