import type { NotificationFeedItem } from '@/types/notificationFeed'
import type {
  NotificationChannelKey,
  NotificationChannelSettings,
  NotificationPreferenceKey,
  NotificationPreferenceSettings,
} from '@/types/notificationSettings'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch } from '@/types/api'

/** Canonical transport failures for owner-scoped notification settings and feed data. */
export type NotificationApiErrorCode = ApiErrorCode<
  | 'provider_unavailable'
>

export type NotificationApiFailure = ApiFailure<NotificationApiErrorCode, {
  currentVersion?: string
}>

export type NotificationApiSuccess<T> = ApiSuccess<T>
export type NotificationApiResult<T> = ApiResult<T, NotificationApiErrorCode, { currentVersion?: string }>
export type NotificationPreferencesMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentPreferencesVersion'>
  | ApiFailure<Exclude<NotificationApiErrorCode, 'version_mismatch'>>

/** All settings are for the authenticated owner resolved by the backend, never a client-selected owner. */
export type AuthoritativeNotificationPreferences = {
  channels: NotificationChannelSettings
  preferences: NotificationPreferenceSettings
  version: string
  updatedAt: string
}

export type NotificationChannel = {
  key: NotificationChannelKey
  /** Whether the configured provider is presently eligible to deliver via this channel. */
  providerAvailable: boolean
}

export type GetNotificationPreferencesResponse = NotificationApiResult<{
  settings: AuthoritativeNotificationPreferences
}>

export type UpdateNotificationPreferencesRequest = {
  expectedVersion: string
  changes: Partial<{
    channels: Partial<NotificationChannelSettings>
    preferences: Partial<NotificationPreferenceSettings>
  }>
}

export type UpdateNotificationPreferencesResponse = NotificationPreferencesMutationResponse<{
  settings: AuthoritativeNotificationPreferences
}>

export type GetNotificationChannelsResponse = NotificationApiResult<{
  channels: NotificationChannel[]
}>

/** `time` remains for UI compatibility; `createdAt` is the server-authoritative timestamp. */
export type AuthoritativeNotificationFeedItem = NotificationFeedItem & {
  createdAt: string
  updatedAt: string
  version: string
}

export type ListNotificationFeedQuery = {
  cursor?: string
  limit?: number
  includeRead?: boolean
}

export type ListNotificationFeedResponse = NotificationApiResult<{
  notifications: AuthoritativeNotificationFeedItem[]
  nextCursor?: string
  feedVersion: string
}>

export type GetUnreadNotificationCountResponse = NotificationApiResult<{
  /** Computed by the backend for the authenticated owner. */
  unreadCount: number
  feedVersion: string
  computedAt: string
}>

/** Idempotency allows retrying a network-uncertain mark-read request safely. */
export type MarkNotificationReadRequest = {
  notificationId: string
  expectedVersion?: string
  idempotencyKey: string
}

export type MarkNotificationReadResponse = NotificationApiResult<{
  notification: AuthoritativeNotificationFeedItem
  unreadCount: number
  feedVersion: string
}>

export type MarkAllNotificationsReadRequest = {
  expectedFeedVersion?: string
  idempotencyKey: string
}

export type MarkAllNotificationsReadResponse = NotificationApiResult<{
  markedCount: number
  unreadCount: number
  feedVersion: string
}>

/**
 * Delivery through email, push, and in-app providers is backend-only. This contract
 * exposes provider availability but never treats preference changes as delivery success.
 * Every feed/preferences method is owner-scoped and must reject another user's data.
 */
export interface NotificationsApiContract {
  getPreferences(): Promise<GetNotificationPreferencesResponse>
  updatePreferences(input: UpdateNotificationPreferencesRequest): Promise<UpdateNotificationPreferencesResponse>
  getChannels(): Promise<GetNotificationChannelsResponse>
  listFeed(query: ListNotificationFeedQuery): Promise<ListNotificationFeedResponse>
  getUnreadCount(): Promise<GetUnreadNotificationCountResponse>
  markRead(input: MarkNotificationReadRequest): Promise<MarkNotificationReadResponse>
  markAllRead(input: MarkAllNotificationsReadRequest): Promise<MarkAllNotificationsReadResponse>
}

export type NotificationPreferencePatch = Partial<Record<NotificationPreferenceKey, boolean>>
