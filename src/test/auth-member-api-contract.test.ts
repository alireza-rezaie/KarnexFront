import { describe, expect, it } from 'vitest'
import type { AuthAccount, AuthMemberApiErrorCode, MemberProfile, RegisterResponse } from '@/types/authMemberApi'

describe('Auth/Member API contract', () => {
  it('keeps account responses password-free while preserving the shared identity ID', () => {
    const account: AuthAccount = {
      id: 'user-1', firstName: 'نام', lastName: 'خانوادگی', username: 'user', email: 'user@example.test', phone: '', accountRole: 'user', isActive: true,
    }
    const member: MemberProfile = {
      id: 'user-1', name: 'نام خانوادگی', email: 'user@example.test', jobTitle: '', avatarId: 'avatar-1', avatar: '', status: 'online', projects: [], lastActivity: 'now',
    }
    const response: RegisterResponse = { ok: true, session: { id: 'session-1', userId: account.id }, account, member }

    expect(response.ok).toBe(true)
    expect(account.id).toBe(member.id)
    expect('password' in account).toBe(false)
  })

  it('keeps canonical backend errors stable and display-message independent', () => {
    const code: AuthMemberApiErrorCode = 'duplicate_email'
    const response: RegisterResponse = { ok: false, code, fieldErrors: { email: 'already used' } }

    expect(response).toMatchObject({ ok: false, code: 'duplicate_email' })
  })

  it('models authentication throttling with a required retry interval', () => {
    const response: RegisterResponse = { ok: false, code: 'rate_limited', retryAfterSeconds: 30 }

    expect(response.retryAfterSeconds).toBe(30)
  })
})
