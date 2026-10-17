import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext'

function Wrapper({ children }: { children: ReactNode }) {
  return <OrganizationProvider>{children}</OrganizationProvider>
}

describe('frontend organization runtime', () => {
  it('starts empty and initializes only user-provided organization values in session memory', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useOrganization(), { wrapper: Wrapper })

    expect(result.current.organization).toBeUndefined()
    expect(result.current.capabilities.canUpdateOrganization).toBe(true)

    await act(async () => {
      expect(await result.current.updateOrganization?.({
        name: 'سازمان runtime', display: 'نمایش runtime', slug: 'runtime-org', email: 'org@example.test',
      })).toMatchObject({ ok: true, organization: { name: 'سازمان runtime', display: 'نمایش runtime', slug: 'runtime-org', email: 'org@example.test' } })
    })

    expect(result.current.organization).toMatchObject({
      name: 'سازمان runtime', display: 'نمایش runtime', slug: 'runtime-org', email: 'org@example.test',
    })
    expect(result.current.organization?.address).toBe('')
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })
})
