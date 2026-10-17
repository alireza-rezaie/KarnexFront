export type NotificationChannelKey = 'email' | 'push' | 'inApp'
export type NotificationPreferenceKey = 'assignedTask' | 'comments' | 'statusChanges' | 'reminders' | 'digest'

export type NotificationChannelSettings = Record<NotificationChannelKey, boolean>
export type NotificationPreferenceSettings = Record<NotificationPreferenceKey, boolean>

export type NotificationDeferredCopy = {
  pageDescription: string
  availabilityStatus: string
  availabilityDescription: string
  channelDescription: string
  preferenceDescription: string
  projectTeamNote: string
}
