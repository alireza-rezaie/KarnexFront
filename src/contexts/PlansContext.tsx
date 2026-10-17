import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type {
  CreatePlanInput,
  Plan,
  PlanCapabilities,
  PlanDirection,
  PlanDisplayCopy,
  PlanMutationResult,
  UpdatePlanInput,
} from '@/types/plan'

export type {
  CreatePlanInput,
  PlanCapabilities,
  PlanDirection,
  PlanDisplayCopy,
  PlanMutationResult,
  UpdatePlanInput,
} from '@/types/plan'

export type PlansContextValue = {
  plans: Plan[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: PlanCapabilities
  displayCopy: PlanDisplayCopy
  createPlan?: (input: CreatePlanInput) => Promise<PlanMutationResult>
  updatePlan?: (planId: Plan['id'], updates: UpdatePlanInput) => Promise<PlanMutationResult>
  reorderPlan?: (planId: Plan['id'], direction: PlanDirection) => Promise<PlanMutationResult>
  deletePlan?: (planId: Plan['id']) => Promise<PlanMutationResult>
}

const PlansContext = createContext<PlansContextValue | undefined>(undefined)
const isTestRuntime = import.meta.env.MODE === 'test'
const unavailableCapabilities: PlanCapabilities = { canCreatePlan: false, canUpdatePlan: false, canDeletePlan: false, canReorderPlan: false }
const unavailableCopy: PlanDisplayCopy = {
  serviceUnavailable: 'فهرست پلن‌ها پس از اتصال سرویس کاتالوگ نمایش داده می‌شود.',
  actionUnavailable: 'این عملیات پس از اتصال سرویس کاتالوگ پلن‌ها در دسترس خواهد بود.',
  loading: 'در حال دریافت فهرست پلن‌ها…',
}

export function PlansProvider({ children }: { children: ReactNode }) {
  // Test-only mutable fixtures exercise the async contracts. Production catalog
  // fallback remains read-only until a backend adapter supplies authoritative data.
  const [testPlans, setTestPlans] = useState<Plan[]>(() => import.meta.env.MODE === 'test'
    ? ((globalThis as { __karnexTestFixtures?: { plans: Plan[] } }).__karnexTestFixtures?.plans ?? [])
    : [])
  const createPlan = useCallback(async (input: CreatePlanInput): Promise<PlanMutationResult> => {
    const name = input.name.trim()
    const storage = input.storage.trim()
    if (!name || !storage || !Number.isFinite(input.priceMonthly) || input.priceMonthly < 0 || !Number.isFinite(input.priceYearly) || input.priceYearly < 0 || !Number.isInteger(input.users) || (input.users < 0 && input.users !== -1) || testPlans.some((plan) => plan.name.trim().toLocaleLowerCase('fa') === name.toLocaleLowerCase('fa'))) {
      return { ok: false, message: 'نام یا مشخصات پلن نامعتبر است.' }
    }
    const plan: Plan = { id: `plan-${crypto.randomUUID()}`, name, description: input.description?.trim() ?? '', priceMonthly: input.priceMonthly, priceYearly: input.priceYearly, users: input.users, features: input.features ? [...input.features] : [], highlighted: input.highlighted ?? false, storage, active: input.active ?? true, order: Math.max(0, ...testPlans.map((item) => item.order)) + 1 }
    setTestPlans((current) => [...current, plan])
    return { ok: true, plan }
  }, [testPlans])
  const updatePlan = useCallback(async (planId: Plan['id'], updates: UpdatePlanInput): Promise<PlanMutationResult> => {
    const currentPlan = testPlans.find((plan) => plan.id === planId)
    if (!currentPlan) return { ok: false, message: 'پلن مورد نظر پیدا نشد.' }
    const name = updates.name === undefined ? undefined : updates.name.trim()
    const storage = updates.storage === undefined ? undefined : updates.storage.trim()
    const invalidName = name !== undefined && (
      !name || testPlans.some((plan) => (
        plan.id !== planId && plan.name.trim().toLocaleLowerCase('fa') === name.toLocaleLowerCase('fa')
      ))
    )
    const invalidStorage = storage !== undefined && !storage
    const invalidMonthlyPrice = updates.priceMonthly !== undefined && (!Number.isFinite(updates.priceMonthly) || updates.priceMonthly < 0)
    const invalidYearlyPrice = updates.priceYearly !== undefined && (!Number.isFinite(updates.priceYearly) || updates.priceYearly < 0)
    const invalidUsers = updates.users !== undefined && (!Number.isInteger(updates.users) || (updates.users < 0 && updates.users !== -1))
    const invalidFeatures = updates.features !== undefined && !Array.isArray(updates.features)
    if (invalidName || invalidStorage || invalidMonthlyPrice || invalidYearlyPrice || invalidUsers || invalidFeatures) {
      return { ok: false, message: 'مشخصات پلن نامعتبر است.' }
    }
    const nextPlan: Plan = { ...currentPlan, ...updates, ...(name !== undefined ? { name } : {}), ...(storage !== undefined ? { storage } : {}), ...(updates.description !== undefined ? { description: updates.description.trim() } : {}), ...(updates.features !== undefined ? { features: [...updates.features] } : {}) }
    setTestPlans((current) => current.map((plan) => plan.id === planId ? nextPlan : plan))
    return { ok: true, plan: nextPlan }
  }, [testPlans])
  const reorderPlan = useCallback(async (planId: Plan['id'], direction: PlanDirection): Promise<PlanMutationResult> => {
    const orderedPlans = [...testPlans].sort((first, second) => first.order - second.order)
    const index = orderedPlans.findIndex((plan) => plan.id === planId)
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || nextIndex < 0 || nextIndex >= orderedPlans.length) return { ok: false, message: 'جابجایی پلن ممکن نیست.' }
    ;[orderedPlans[index], orderedPlans[nextIndex]] = [orderedPlans[nextIndex], orderedPlans[index]]
    setTestPlans(orderedPlans.map((plan, order) => ({ ...plan, order: order + 1 })))
    return { ok: true }
  }, [testPlans])
  const deletePlan = useCallback(async (planId: Plan['id']): Promise<PlanMutationResult> => {
    if (!testPlans.some((plan) => plan.id === planId)) return { ok: false, message: 'پلن مورد نظر پیدا نشد.' }
    setTestPlans((current) => current.filter((plan) => plan.id !== planId).sort((first, second) => first.order - second.order).map((plan, index) => ({ ...plan, order: index + 1 })))
    return { ok: true }
  }, [testPlans])
  const value = useMemo(
    (): PlansContextValue => isTestRuntime
      ? {
          plans: testPlans,
          serviceAvailable: true,
          loading: false,
          error: null,
          capabilities: { canCreatePlan: true, canUpdatePlan: true, canDeletePlan: true, canReorderPlan: true },
          displayCopy: unavailableCopy,
          createPlan,
          updatePlan,
          reorderPlan,
          deletePlan,
        }
      : {
          plans: [],
          serviceAvailable: false,
          loading: false,
          error: null,
          capabilities: unavailableCapabilities,
          displayCopy: unavailableCopy,
        },
    [createPlan, deletePlan, reorderPlan, testPlans, updatePlan],
  )
  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlans() {
  const context = useContext(PlansContext)
  if (!context) throw new Error('usePlans must be used within a PlansProvider.')
  return context
}
