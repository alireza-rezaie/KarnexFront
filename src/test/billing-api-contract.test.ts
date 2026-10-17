import { describe, expect, it } from 'vitest'
import type {
  BillingApiFailure,
  ChangeSubscriptionRequest,
  ReorderPlansRequest,
} from '@/types/billingApi'

describe('plans and billing API contract', () => {
  it('uses one catalog ordering request to prevent duplicate plan orders', () => {
    const reorder: ReorderPlansRequest = {
      expectedCatalogVersion: 'catalog-version-2', orderedPlanIds: ['plan-basic', 'plan-pro', 'plan-enterprise'],
    }

    expect(new Set(reorder.orderedPlanIds).size).toBe(reorder.orderedPlanIds.length)
  })

  it('requires idempotency for provider-confirmed subscription changes', () => {
    const change: ChangeSubscriptionRequest = {
      kind: 'existing-subscription', planId: 'plan-pro', expectedSubscriptionVersion: 'subscription-version-1', paymentMethodId: 'payment-method-a', idempotencyKey: 'subscription-attempt-a',
    }

    expect(change.idempotencyKey).toBe('subscription-attempt-a')
  })

  it('distinguishes activating a new subscription from changing a versioned one', () => {
    const activation: ChangeSubscriptionRequest = {
      kind: 'new-subscription', planId: 'plan-basic', idempotencyKey: 'subscription-activation-a',
    }

    expect(activation.kind).toBe('new-subscription')
    expect('expectedSubscriptionVersion' in activation).toBe(false)
  })

  it('models payment and invoice failures explicitly', () => {
    const payment: BillingApiFailure = { ok: false, code: 'payment_failed' }
    const invoice: BillingApiFailure = { ok: false, code: 'invoice_unavailable' }

    expect([payment.code, invoice.code]).toEqual(['payment_failed', 'invoice_unavailable'])
  })
})
