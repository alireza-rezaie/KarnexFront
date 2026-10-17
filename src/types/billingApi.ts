import type {
  BillingAccount,
  BillingInvoice,
  BillingSubscription,
  BillingUsage,
  PaymentMethod,
} from '@/types/billing'
import type { CreatePlanInput, Plan, UpdatePlanInput } from '@/types/plan'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch } from '@/types/api'

export type BillingApiErrorCode = ApiErrorCode<
  | 'provider_unavailable'
  | 'payment_failed'
  | 'payment_method_invalid'
  | 'subscription_conflict'
  | 'plan_unavailable'
  | 'invoice_unavailable'
>

export type BillingApiFailure = ApiFailure<BillingApiErrorCode, {
  currentVersion?: string
}>

export type BillingApiSuccess<T> = ApiSuccess<T>
export type BillingApiResult<T> = ApiResult<T, BillingApiErrorCode, { currentVersion?: string }>
export type PlanMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentPlanVersion'>
  | ApiFailure<Exclude<BillingApiErrorCode, 'version_mismatch'>>
export type PlanCatalogMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentCatalogVersion'>
  | ApiFailure<Exclude<BillingApiErrorCode, 'version_mismatch'>>
export type SubscriptionMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentSubscriptionVersion'>
  | ApiFailure<Exclude<BillingApiErrorCode, 'version_mismatch'>>
export type PaymentMethodMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentPaymentMethodVersion'>
  | ApiFailure<Exclude<BillingApiErrorCode, 'version_mismatch'>>
export type BillingAccountMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentBillingAccountVersion'>
  | ApiFailure<Exclude<BillingApiErrorCode, 'version_mismatch'>>

export type AuthoritativePlan = Plan & {
  version: string
  updatedAt: string
}

export type AuthoritativeBillingAccount = BillingAccount & {
  version: string
  updatedAt: string
}

export type AuthoritativeSubscription = BillingSubscription & {
  version: string
  providerConfirmedAt: string
}

export type AuthoritativeBillingUsage = BillingUsage & {
  computedAt: string
  timezone: string
}

export type AuthoritativeBillingInvoice = BillingInvoice & {
  version: string
  updatedAt: string
}

/** No PAN, CVC, or provider secret appears in this shape. */
export type AuthoritativePaymentMethod = PaymentMethod & {
  version: string
  providerConfirmedAt: string
}

export type ListPublicPlansQuery = {
  billingCycle?: 'monthly' | 'yearly'
  currency?: string
}

export type ListPublicPlansResponse = BillingApiResult<{
  plans: AuthoritativePlan[]
  catalogVersion: string
}>

export type ListAdminPlansResponse = BillingApiResult<{
  plans: AuthoritativePlan[]
  catalogVersion: string
}>

export type CreatePlanRequest = { input: CreatePlanInput }
export type CreatePlanResponse = BillingApiResult<{ plan: AuthoritativePlan; catalogVersion: string }>

export type UpdatePlanRequest = {
  planId: string
  expectedVersion: string
  changes: UpdatePlanInput
}
export type UpdatePlanResponse = PlanMutationResponse<{ plan: AuthoritativePlan; catalogVersion: string }>

/** Ordering every returned plan once makes duplicate orders impossible. */
export type ReorderPlansRequest = {
  expectedCatalogVersion: string
  orderedPlanIds: string[]
}
export type ReorderPlansResponse = PlanCatalogMutationResponse<{ plans: AuthoritativePlan[]; catalogVersion: string }>

export type DeletePlanRequest = { planId: string; expectedVersion: string }
export type DeletePlanResponse = PlanMutationResponse<{ planId: string; catalogVersion: string }>

export type GetBillingAccountResponse = BillingApiResult<{ account: AuthoritativeBillingAccount }>
export type GetCurrentSubscriptionResponse = BillingApiResult<{ subscription: AuthoritativeSubscription | null }>
export type GetBillingUsageResponse = BillingApiResult<{ usage: AuthoritativeBillingUsage }>

/** Provider confirmation and retry safety are mandatory before a subscription becomes authoritative. */
export type ChangeSubscriptionRequest = {
  planId: string
  paymentMethodId?: string
  idempotencyKey: string
} & (
  /** Activation when this billing account has no existing subscription. */
  | { kind: 'new-subscription'; expectedSubscriptionVersion?: never }
  /** A change to an existing subscription must be based on its current version. */
  | { kind: 'existing-subscription'; expectedSubscriptionVersion: string }
)
export type ChangeSubscriptionResponse = SubscriptionMutationResponse<{ subscription: AuthoritativeSubscription }>

export type CancelSubscriptionRequest = {
  expectedSubscriptionVersion: string
  idempotencyKey: string
  cancellation: 'end-of-period' | 'immediate'
}
export type CancelSubscriptionResponse = SubscriptionMutationResponse<{ subscription: AuthoritativeSubscription }>

export type ListInvoicesQuery = { cursor?: string; limit?: number; status?: BillingInvoice['status'] }
export type ListInvoicesResponse = BillingApiResult<{ invoices: AuthoritativeBillingInvoice[]; nextCursor?: string }>

export type GetInvoiceDownloadReferenceResponse = BillingApiResult<{
  invoice: AuthoritativeBillingInvoice
  downloadReference: string
  expiresAt: string
}>

export type ListPaymentMethodsResponse = BillingApiResult<{ paymentMethods: AuthoritativePaymentMethod[] }>

/** The browser supplies a provider setup reference, never raw payment credentials. */
export type AddPaymentMethodRequest = {
  providerSetupReference: string
  idempotencyKey: string
}
export type AddPaymentMethodResponse = BillingApiResult<{ paymentMethod: AuthoritativePaymentMethod }>

export type RemovePaymentMethodRequest = {
  paymentMethodId: string
  expectedVersion: string
  idempotencyKey: string
}
export type RemovePaymentMethodResponse = PaymentMethodMutationResponse<{ paymentMethodId: string }>

export type SetDefaultPaymentMethodRequest = {
  paymentMethodId: string
  expectedVersion: string
  idempotencyKey: string
}
export type SetDefaultPaymentMethodResponse = PaymentMethodMutationResponse<{ paymentMethod: AuthoritativePaymentMethod }>

export type UpdateBillingIdentityRequest = {
  expectedVersion: string
  changes: Partial<Pick<BillingAccount, 'legalName' | 'taxId' | 'billingEmail' | 'address'>>
}
export type UpdateBillingIdentityResponse = BillingAccountMutationResponse<{ account: AuthoritativeBillingAccount }>

/**
 * Plan CRUD/reordering is System Admin-only. Billing, subscription and payment
 * operations require the existing organization billing authority; project PM/SM
 * membership grants no billing authority. Provider-confirmed responses are required
 * for payment/subscription changes, invoices and downloads are authoritative, and no
 * frontend action may claim success before those responses arrive.
 */
export interface BillingApiContract {
  listPublicPlans(query?: ListPublicPlansQuery): Promise<ListPublicPlansResponse>
  listAdminPlans(): Promise<ListAdminPlansResponse>
  createPlan(input: CreatePlanRequest): Promise<CreatePlanResponse>
  updatePlan(input: UpdatePlanRequest): Promise<UpdatePlanResponse>
  reorderPlans(input: ReorderPlansRequest): Promise<ReorderPlansResponse>
  deletePlan(input: DeletePlanRequest): Promise<DeletePlanResponse>
  getBillingAccount(): Promise<GetBillingAccountResponse>
  getCurrentSubscription(): Promise<GetCurrentSubscriptionResponse>
  changeSubscription(input: ChangeSubscriptionRequest): Promise<ChangeSubscriptionResponse>
  cancelSubscription(input: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse>
  getUsage(): Promise<GetBillingUsageResponse>
  listInvoices(query?: ListInvoicesQuery): Promise<ListInvoicesResponse>
  getInvoiceDownloadReference(invoiceId: string): Promise<GetInvoiceDownloadReferenceResponse>
  listPaymentMethods(): Promise<ListPaymentMethodsResponse>
  addPaymentMethod(input: AddPaymentMethodRequest): Promise<AddPaymentMethodResponse>
  removePaymentMethod(input: RemovePaymentMethodRequest): Promise<RemovePaymentMethodResponse>
  setDefaultPaymentMethod(input: SetDefaultPaymentMethodRequest): Promise<SetDefaultPaymentMethodResponse>
  updateBillingIdentity(input: UpdateBillingIdentityRequest): Promise<UpdateBillingIdentityResponse>
}
