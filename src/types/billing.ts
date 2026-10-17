export type BillingCurrency = 'IRR' | 'USD' | 'EUR'

export type BillingAccount = {
  id: string
  organizationId: string
  legalName: string | null
  taxId: string | null
  billingEmail: string | null
  address: string | null
}

export type BillingSubscription = {
  id: string
  planId: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unavailable'
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  renewalDate: string | null
}

export type BillingUsage = {
  periodStart: string
  periodEnd: string
  metrics: { key: string; label: string; used: number; limit: number | null }[]
}

export type BillingInvoice = {
  id: string
  number: string
  issuedAt: string
  dueAt: string | null
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount: number
  currency: BillingCurrency
}

export type PaymentMethod = {
  id: string
  type: 'card' | 'bank_transfer' | 'wallet' | 'other'
  label: string
  lastFour: string | null
  expiresAt: string | null
  isDefault: boolean
}

export type BillingCapabilities = {
  canChangePlan: boolean
  canCancelSubscription: boolean
  canUpdatePaymentMethod: boolean
  canViewInvoices: boolean
  canDownloadInvoice: boolean
  canManageBillingIdentity: boolean
}

export type BillingMutationResult = { ok: true } | { ok: false; message?: string }

export type BillingDisplayCopy = {
  serviceUnavailable: string
  billingUnavailable: string
  actionUnavailable: string
  loading: string
}
