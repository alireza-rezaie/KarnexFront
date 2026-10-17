import { describe, expect, it } from 'vitest'
import type {
  InitializeOrganizationRequest,
  OrganizationApiFailure,
  UpdateOrganizationRequest,
} from '@/types/organizationApi'

describe('organization API contract', () => {
  it('initializes from current organization fields without client-owned IDs or timestamps', () => {
    const initialize: InitializeOrganizationRequest = {
      input: {
        name: 'کارنکس', display: 'کارنکس', slug: 'karnex', site: '', email: '', phone: '', timezone: 'Asia/Tehran', address: '', desc: '', logo: null,
      },
    }

    expect(initialize.input.slug).toBe('karnex')
  })

  it('makes settings updates version-ready', () => {
    const update: UpdateOrganizationRequest = {
      organizationId: 'organization-a',
      expectedVersion: 'organization-version-2',
      changes: { site: 'https://example.com' },
    }

    expect(update.expectedVersion).toBe('organization-version-2')
  })

  it('uses typed failures for slug and file-reference validation', () => {
    const slug: OrganizationApiFailure = { ok: false, code: 'duplicate_slug' }
    const logo: OrganizationApiFailure = { ok: false, code: 'invalid_logo_reference' }

    expect([slug.code, logo.code]).toEqual(['duplicate_slug', 'invalid_logo_reference'])
  })
})
