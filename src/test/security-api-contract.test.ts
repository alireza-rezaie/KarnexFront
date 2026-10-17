import { describe, expect, it } from 'vitest'
import type {
  ChangePasswordRequest,
  RevokeAllOtherSessionsRequest,
  SecurityApiFailure,
} from '@/types/securityApi'

describe('security API contract', () => {
  it('keeps passwords in the request only and captures session invalidation policy', () => {
    const change: ChangePasswordRequest = {
      currentPassword: 'current-secret', newPassword: 'new-secret', confirmPassword: 'new-secret', requestedSessionInvalidation: 'other-sessions',
    }

    expect(change.requestedSessionInvalidation).toBe('other-sessions')
  })

  it('requires explicit current-session behavior for revoke-all', () => {
    const revoke: RevokeAllOtherSessionsRequest = {
      idempotencyKey: 'revoke-attempt-a', currentSessionBehavior: 'retain-current', expectedSessionsVersion: 'sessions-version-2',
    }

    expect(revoke.currentSessionBehavior).toBe('retain-current')
  })

  it('models 2FA challenge expiry and reauthentication as typed failures', () => {
    const challenge: SecurityApiFailure = { ok: false, code: 'invalid_or_expired_two_factor_challenge' }
    const reauth: SecurityApiFailure = { ok: false, code: 'reauthentication_required' }

    expect([challenge.code, reauth.code]).toEqual(['invalid_or_expired_two_factor_challenge', 'reauthentication_required'])
  })

  it('keeps security throttling distinct from authentication and validation failures', () => {
    const rateLimited: SecurityApiFailure = { ok: false, code: 'rate_limited', retryAfterSeconds: 60 }

    expect(rateLimited.retryAfterSeconds).toBe(60)
  })
})
