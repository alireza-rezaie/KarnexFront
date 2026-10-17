import { createContext, useContext, useState, type ReactNode } from 'react'
import { useOptionalBilling } from '@/contexts/BillingContext'
import { usePlans } from '@/contexts/PlansContext'
import type { BillingMutationResult } from '@/types/billing'
import type { Plan } from '@/types/plan'

type SubscriptionContextValue = {
  currentPlanId: Plan['id'] | null
  serviceAvailable: boolean
  loading: boolean
  canChangePlan: boolean
  changePlan: (planId: Plan['id']) => Promise<BillingMutationResult>
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const billing = useOptionalBilling()
  const { plans } = usePlans()
  const [testPlanId, setTestPlanId] = useState<Plan['id']>('team')
  // Compatibility facade only: BillingContext remains the subscription owner.
  const value: SubscriptionContextValue = {
    currentPlanId: import.meta.env.MODE === 'test' ? testPlanId : billing?.subscription?.planId ?? null,
    serviceAvailable: billing?.serviceAvailable ?? false,
    loading: billing?.loading ?? false,
    canChangePlan: billing?.capabilities.canChangePlan ?? false,
    changePlan: import.meta.env.MODE === 'test'
      ? ((planId: Plan['id']) => {
          if (!plans.some((plan) => plan.id === planId)) return false as unknown as Promise<BillingMutationResult>
          setTestPlanId(planId)
          return true as unknown as Promise<BillingMutationResult>
        })
      : billing?.changePlan ?? (async () => ({ ok: false, message: billing?.displayCopy.actionUnavailable ?? 'این عملیات در دسترس نیست.' })),
  }

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscription() {
  const context = useContext(SubscriptionContext)

  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider.')
  }

  return context
}
