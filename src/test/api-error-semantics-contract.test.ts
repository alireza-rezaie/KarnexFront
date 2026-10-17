import { describe, expect, it } from 'vitest'
import type { ApiAuthorizationErrorCode, ApiFailure } from '@/types/api'
import type { ProjectAccessApiError } from '@/types/projectAccessApi'
import type { SprintApiFailure } from '@/types/sprintApi'

describe('shared API error semantics', () => {
  it('distinguishes a missing session from insufficient authority', () => {
    const unauthorized: ApiFailure<ApiAuthorizationErrorCode> = { ok: false, code: 'unauthorized' }
    const forbidden: ApiFailure<ApiAuthorizationErrorCode> = { ok: false, code: 'forbidden' }

    expect(unauthorized.code).toBe('unauthorized')
    expect(forbidden.code).toBe('forbidden')
  })

  it('preserves domain failures alongside canonical authorization errors', () => {
    const stale: ProjectAccessApiError = { ok: false, code: 'version_mismatch', currentVersion: 'project-v2' }
    const sprintState: SprintApiFailure = { ok: false, code: 'invalid_sprint_state' }

    expect(stale.code).toBe('version_mismatch')
    expect(sprintState.code).toBe('invalid_sprint_state')
  })
})
