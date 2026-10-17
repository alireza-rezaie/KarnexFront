import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type {
  Organization,
  OrganizationCapabilities,
  OrganizationDisplayCopy,
  OrganizationMutationResult,
  UpdateOrganizationInput,
} from '@/types/organization'

export type {
  OrganizationCapabilities,
  OrganizationDisplayCopy,
  OrganizationMutationResult,
  UpdateOrganizationInput,
} from '@/types/organization'

// eslint-disable-next-line react-refresh/only-export-components
export const initialOrganization: Organization = {
  name: '', display: '', slug: '', site: '', email: '', phone: '', timezone: '', address: '', desc: '', logo: null,
}

export type OrganizationContextValue = {
  organization: Organization | undefined
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: OrganizationCapabilities
  displayCopy: OrganizationDisplayCopy
  updateOrganization?: (updates: UpdateOrganizationInput) => Promise<OrganizationMutationResult>
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined)
const runtimeCapabilities: OrganizationCapabilities = { canUpdateOrganization: true }
const unavailableCopy: OrganizationDisplayCopy = {
  serviceUnavailable: 'اطلاعات سازمان پس از اتصال سرویس سازمان نمایش داده می‌شوند.',
  actionUnavailable: 'ویرایش تنظیمات سازمان پس از اتصال سرویس سازمان در دسترس خواهد بود.',
  loading: 'در حال دریافت اطلاعات سازمان…',
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  // Production starts without an organization. An explicit form save initializes it
  // for the current runtime session only.
  const [organization, setOrganization] = useState<Organization | undefined>(undefined)
  const updateOrganization = useCallback(async (updates: UpdateOrganizationInput): Promise<OrganizationMutationResult> => {
    if (!updates || typeof updates !== 'object') return { ok: false, message: 'اطلاعات سازمان معتبر نیست.' }

    const nextOrganization = { ...initialOrganization, ...organization, ...updates }
    setOrganization(nextOrganization)
    return { ok: true, organization: nextOrganization }
  }, [organization])
  const value = useMemo(
    (): OrganizationContextValue => ({
      organization,
      serviceAvailable: true,
      loading: false,
      error: null,
      capabilities: runtimeCapabilities,
      displayCopy: unavailableCopy,
      updateOrganization,
    }),
    [organization, updateOrganization],
  )
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error('useOrganization must be used within an OrganizationProvider.')
  return context
}
