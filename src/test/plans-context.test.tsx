import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { PlansProvider, usePlans } from '@/contexts/PlansContext'
import { SubscriptionProvider, useSubscription } from '@/contexts/SubscriptionContext'

function PlansWrapper({ children }: { children: ReactNode }) {
  return <PlansProvider>{children}</PlansProvider>
}

function SubscriptionWrapper({ children }: { children: ReactNode }) {
  return <PlansProvider><SubscriptionProvider>{children}</SubscriptionProvider></PlansProvider>
}

describe('PlansContext', () => {
  it('blocks duplicate names and preserves id and order during an update', async () => {
    const { result } = renderHook(() => usePlans(), { wrapper: PlansWrapper })
    const original = result.current.plans.find((plan) => plan.id === 'free')!

    await act(async () => {
      expect((await result.current.createPlan?.({
        name: ' رایگان ', users: 1, storage: '۱ گیگ', priceMonthly: 0, priceYearly: 0,
      }))?.ok).toBe(false)
    })

    await act(async () => {
      expect((await result.current.updatePlan?.('free', { name: 'شروع', active: false }))?.ok).toBe(true)
    })

    expect(result.current.plans.find((plan) => plan.id === 'free')).toMatchObject({
      id: original.id,
      order: original.order,
      name: 'شروع',
      active: false,
    })
  })

  it('normalizes remaining orders after a delete', async () => {
    const { result } = renderHook(() => usePlans(), { wrapper: PlansWrapper })

    await act(async () => {
      expect((await result.current.deletePlan?.('business'))?.ok).toBe(true)
    })

    expect(result.current.plans.map((plan) => plan.id)).not.toContain('business')
    expect(result.current.plans.map((plan) => plan.order).sort((first, second) => first - second))
      .toEqual([1, 2, 3])
  })

  it('only changes the subscription to a plan that exists in the shared catalog', () => {
    const { result } = renderHook(() => useSubscription(), { wrapper: SubscriptionWrapper })

    act(() => {
      expect(result.current.changePlan('missing-plan')).toBe(false)
      expect(result.current.changePlan('business')).toBe(true)
    })

    expect(result.current.currentPlanId).toBe('business')
  })
})
