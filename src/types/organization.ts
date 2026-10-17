export interface Organization {
  name: string
  display: string
  slug: string
  site: string
  email: string
  phone: string
  timezone: string
  address: string
  desc: string
  logo: string | null
}

export type UpdateOrganizationInput = Partial<Organization>
export type OrganizationMutationResult =
  | { ok: true; organization?: Organization }
  | { ok: false; message?: string }

export interface OrganizationCapabilities {
  canUpdateOrganization: boolean
}

export interface OrganizationDisplayCopy {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}
