import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type {
  NotificationChannelKey,
  NotificationChannelSettings,
  NotificationDeferredCopy,
  NotificationPreferenceKey,
  NotificationPreferenceSettings,
} from '@/types/notificationSettings'

type NotificationSettingsContextValue = {
  serviceAvailable: boolean
  loading: boolean
  channels: NotificationChannelSettings
  preferences: NotificationPreferenceSettings
  canManageService: boolean
  canManageChannels: boolean
  canManagePreferences: boolean
  displayCopy: NotificationDeferredCopy
  updateServiceAvailable?: (available: boolean) => void | Promise<boolean>
  updateChannel?: (channel: NotificationChannelKey, enabled: boolean) => void | Promise<boolean>
  updatePreference?: (preference: NotificationPreferenceKey, enabled: boolean) => void | Promise<boolean>
}

const unavailableCopy: NotificationDeferredCopy = {
  pageDescription: 'وضعیت دسترسی کانال‌ها و ترجیحات دریافت اعلان پس از اتصال سرویس اعلان‌ها قابل مدیریت است.',
  availabilityStatus: 'نیازمند اتصال سرویس اعلان‌ها',
  availabilityDescription: 'وضعیت ارسال و دریافت اعلان‌ها پس از اتصال سرویس اعلان‌ها قابل ارزیابی است.',
  channelDescription: 'پس از اتصال سرویس اعلان‌ها قابل مدیریت است.',
  preferenceDescription: 'ترجیحات دریافت این اعلان پس از اتصال سرویس اعلان‌ها قابل مدیریت است.',
  projectTeamNote: 'ⓘ تنظیمات اعلان‌های پروژه و تیم پس از اتصال سرویس اعلان‌ها در دسترس خواهد بود.',
}

const availableCopy: NotificationDeferredCopy = {
  pageDescription: 'وضعیت دسترسی کانال‌ها و ترجیحات دریافت اعلان از سرویس اعلان‌ها نمایش داده می‌شود.',
  availabilityStatus: 'سرویس اعلان‌ها در دسترس است',
  availabilityDescription: 'وضعیت فعلی ارسال و دریافت اعلان‌ها از سرویس اعلان‌ها دریافت شده است.',
  channelDescription: 'وضعیت این کانال از سرویس اعلان‌ها دریافت شده است.',
  preferenceDescription: 'ترجیح فعلی دریافت این اعلان از سرویس اعلان‌ها دریافت شده است.',
  projectTeamNote: 'ⓘ تنظیمات اعلان‌های پروژه و تیم از سرویس اعلان‌ها دریافت می‌شود.',
}

const fallbackChannels: NotificationChannelSettings = {
  email: false,
  push: false,
  inApp: false,
}

const fallbackPreferences: NotificationPreferenceSettings = {
  assignedTask: false,
  comments: false,
  statusChanges: false,
  reminders: false,
  digest: false,
}

const NotificationsContext = createContext<NotificationSettingsContextValue | undefined>(undefined)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  // This fallback is intentionally read-only until a backend-backed provider supplies data and mutations.
  const serviceAvailable = false
  const loading = false

  const value = useMemo<NotificationSettingsContextValue>(() => ({
    serviceAvailable,
    loading,
    channels: fallbackChannels,
    preferences: fallbackPreferences,
    canManageService: false,
    canManageChannels: false,
    canManagePreferences: false,
    displayCopy: serviceAvailable ? availableCopy : unavailableCopy,
  }), [serviceAvailable, loading])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const context = useContext(NotificationsContext)

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider.')
  }

  return context
}
