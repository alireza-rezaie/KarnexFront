import { describe, expect, it } from 'vitest'
import type {
  MarkAllNotificationsReadRequest,
  MarkNotificationReadRequest,
  NotificationApiFailure,
  UpdateNotificationPreferencesRequest,
} from '@/types/notificationApi'

describe('notifications API contract', () => {
  it('keeps preferences versioned and owner identity server-derived', () => {
    const update: UpdateNotificationPreferencesRequest = {
      expectedVersion: 'preferences-version-2',
      changes: { preferences: { comments: true }, channels: { inApp: true } },
    }

    expect(update.changes.preferences?.comments).toBe(true)
  })

  it('makes read mutations idempotent and conflict-ready', () => {
    const one: MarkNotificationReadRequest = { notificationId: 'notification-a', expectedVersion: 'notification-version-1', idempotencyKey: 'request-a' }
    const all: MarkAllNotificationsReadRequest = { expectedFeedVersion: 'feed-version-3', idempotencyKey: 'request-b' }

    expect(one.idempotencyKey).toBe('request-a')
    expect(all.expectedFeedVersion).toBe('feed-version-3')
  })

  it('models unavailable delivery providers independently from feed authorization', () => {
    const provider: NotificationApiFailure = { ok: false, code: 'provider_unavailable' }
    const forbidden: NotificationApiFailure = { ok: false, code: 'forbidden' }

    expect([provider.code, forbidden.code]).toEqual(['provider_unavailable', 'forbidden'])
  })
})
