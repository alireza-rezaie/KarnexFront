import type { Organization, UpdateOrganizationInput } from '@/types/organization'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch } from '@/types/api'

/** Canonical transport failures for organization profile/settings operations. */
export type OrganizationApiErrorCode = ApiErrorCode<
  | 'duplicate_slug'
  | 'invalid_logo_reference'
>

export type OrganizationApiFailure = ApiFailure<OrganizationApiErrorCode, {
  currentVersion?: string
}>

export type OrganizationApiSuccess<T> = ApiSuccess<T>
export type OrganizationApiResult<T> = ApiResult<T, OrganizationApiErrorCode, { currentVersion?: string }>
export type OrganizationMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentOrganizationVersion'>
  | ApiFailure<Exclude<OrganizationApiErrorCode, 'version_mismatch'>>

/** IDs and timestamps are backend-authoritative; existing UI fields are preserved unchanged. */
export type AuthoritativeOrganization = Organization & {
  id: string
  createdAt: string
  updatedAt: string
  version: string
}

/** `organization: null` is the valid uninitialized state used by a fresh runtime. */
export type GetOrganizationResponse = OrganizationApiResult<{
  organization: AuthoritativeOrganization | null
}>

export type InitializeOrganizationRequest = {
  input: Organization
}

export type InitializeOrganizationResponse = OrganizationApiResult<{
  organization: AuthoritativeOrganization
}>

export type UpdateOrganizationRequest = {
  organizationId: string
  expectedVersion: string
  changes: UpdateOrganizationInput
}

export type UpdateOrganizationResponse = OrganizationMutationResponse<{
  organization: AuthoritativeOrganization
}>

/**
 * The backend enforces organization-management authorization per existing product
 * policy, validates required name, slug syntax/uniqueness, email, website, timezone,
 * and accepts a logo only as a valid backend-managed Files reference. Client input
 * never supplies authoritative IDs or timestamps.
 */
export interface OrganizationApiContract {
  getOrganization(): Promise<GetOrganizationResponse>
  initializeOrganization(input: InitializeOrganizationRequest): Promise<InitializeOrganizationResponse>
  updateOrganization(input: UpdateOrganizationRequest): Promise<UpdateOrganizationResponse>
}
