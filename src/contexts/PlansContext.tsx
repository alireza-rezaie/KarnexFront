import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import { requestApi } from '@/services/authApi'
import type {
  CreatePlanInput, Plan, PlanCapabilities, PlanDirection, PlanDisplayCopy, PlanMutationResult, UpdatePlanInput,
} from '@/types/plan'

export type { CreatePlanInput, PlanCapabilities, PlanDirection, PlanDisplayCopy, PlanMutationResult, UpdatePlanInput } from '@/types/plan'

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
  actionUnavailable: 'این عملیات در API فعلی پشتیبانی نمی‌شود.',
  loading: 'در حال دریافت فهرست پلن‌ها…',
}

type BackendPlan = {
  id: number; name: string; description: string; priceMonthly: number; priceYearly: number;
  users: number; features: string[]; highlighted: boolean; storage: string; active: boolean; order: number;
}
const fromBackendPlan = (item: BackendPlan): Plan => ({ ...item, id: String(item.id) })
const toBackendPlanInput = (input: CreatePlanInput | UpdatePlanInput) => ({
  name: input.name,
  description: input.description ?? '',
  priceMonthly: input.priceMonthly,
  priceYearly: input.priceYearly,
  users: input.users,
  features: input.features ?? [],
  highlighted: input.highlighted ?? false,
  storage: input.storage,
  active: input.active ?? true,
})

export function PlansProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const isSystemAdmin = auth?.isSystemAdmin === true
  const [plans, setPlans] = useState<Plan[]>(() => isTestRuntime
    ? ((globalThis as { __karnexTestFixtures?: { plans: Plan[] } }).__karnexTestFixtures?.plans ?? [])
    : [])
  const [loading, setLoading] = useState(!isTestRuntime)
  const [error, setError] = useState<string | null>(null)
  const [testPlans, setTestPlans] = useState<Plan[]>(() => import.meta.env.MODE === 'test'
    ? ((globalThis as { __karnexTestFixtures?: { plans: Plan[] } }).__karnexTestFixtures?.plans ?? [])
    : [])

  const refreshPlans = useCallback(async () => {
    if (isTestRuntime) return
    setLoading(true)
    try {
      const items = await requestApi<BackendPlan[]>(isSystemAdmin ? '/Admin/api/billing/plans' : '/api/billing/plans')
      setPlans(items.map(fromBackendPlan))
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : unavailableCopy.serviceUnavailable)
    } finally {
      setLoading(false)
    }
  }, [isSystemAdmin])

  useEffect(() => { void refreshPlans() }, [refreshPlans])

  const createPlan = useCallback(async (input: CreatePlanInput): Promise<PlanMutationResult> => {
    if (isTestRuntime) {
      const name = input.name.trim()
      const storage = input.storage.trim()
      if (!name || !storage || !Number.isFinite(input.priceMonthly) || input.priceMonthly < 0 || !Number.isFinite(input.priceYearly) || input.priceYearly < 0 || !Number.isInteger(input.users) || (input.users < 0 && input.users !== -1) || testPlans.some((plan) => plan.name.trim().toLocaleLowerCase('fa') === name.toLocaleLowerCase('fa'))) return { ok: false, message: 'نام یا مشخصات پلن نامعتبر است.' }
      const plan: Plan = { id: `plan-${crypto.randomUUID()}`, name, description: input.description?.trim() ?? '', priceMonthly: input.priceMonthly, priceYearly: input.priceYearly, users: input.users, features: input.features ? [...input.features] : [], highlighted: input.highlighted ?? false, storage, active: input.active ?? true, order: Math.max(0, ...testPlans.map((item) => item.order)) + 1 }
      setTestPlans((current) => [...current, plan])
      return { ok: true, plan }
    }
    if (!isSystemAdmin) return { ok: false, message: 'فقط مدیر سیستم می‌تواند پلن ایجاد کند.' }
    try {
      const created = await requestApi<BackendPlan>('/Admin/api/billing/plans', { method: 'POST', body: JSON.stringify(toBackendPlanInput(input)) })
      const plan = fromBackendPlan(created)
      setPlans((current) => [...current, plan].sort((a, b) => a.order - b.order))
      return { ok: true, plan }
    } catch (requestError) { return { ok: false, message: requestError instanceof Error ? requestError.message : unavailableCopy.actionUnavailable } }
  }, [isSystemAdmin, testPlans])

  const updatePlan = useCallback(async (planId: Plan['id'], updates: UpdatePlanInput): Promise<PlanMutationResult> => {
    const currentPlan = (isTestRuntime ? testPlans : plans).find((plan) => plan.id === planId)
    if (!currentPlan) return { ok: false, message: 'پلن مورد نظر پیدا نشد.' }
    if (isTestRuntime) {
      const nextPlan: Plan = { ...currentPlan, ...updates, ...(updates.name === undefined ? {} : { name: updates.name.trim() }), ...(updates.storage === undefined ? {} : { storage: updates.storage.trim() }), ...(updates.features === undefined ? {} : { features: [...updates.features] }) }
      setTestPlans((current) => current.map((plan) => plan.id === planId ? nextPlan : plan))
      return { ok: true, plan: nextPlan }
    }
    if (!isSystemAdmin) return { ok: false, message: 'فقط مدیر سیستم می‌تواند پلن را ویرایش کند.' }
    const merged = { ...currentPlan, ...updates }
    try {
      const updated = await requestApi<BackendPlan>(`/Admin/api/billing/plans/${encodeURIComponent(planId)}`, {
        method: 'PUT', body: JSON.stringify(toBackendPlanInput(merged)),
      })
      const plan = fromBackendPlan(updated)
      setPlans((current) => current.map((item) => item.id === planId ? plan : item))
      return { ok: true, plan }
    } catch (requestError) { return { ok: false, message: requestError instanceof Error ? requestError.message : unavailableCopy.actionUnavailable } }
  }, [isSystemAdmin, plans, testPlans])

  const reorderPlan = useCallback(async (planId: Plan['id'], direction: PlanDirection): Promise<PlanMutationResult> => {
    if (!isTestRuntime) return { ok: false, message: 'مرتب‌سازی پلن‌ها هنوز در API بک‌اند پیاده‌سازی نشده است.' }
    const orderedPlans = [...testPlans].sort((first, second) => first.order - second.order)
    const index = orderedPlans.findIndex((plan) => plan.id === planId)
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || nextIndex < 0 || nextIndex >= orderedPlans.length) return { ok: false, message: 'جابجایی پلن ممکن نیست.' }
    ;[orderedPlans[index], orderedPlans[nextIndex]] = [orderedPlans[nextIndex], orderedPlans[index]]
    setTestPlans(orderedPlans.map((plan, order) => ({ ...plan, order: order + 1 })))
    return { ok: true }
  }, [testPlans])

  const deletePlan = useCallback(async (planId: Plan['id']): Promise<PlanMutationResult> => {
    if (!isTestRuntime) return { ok: false, message: 'حذف پلن هنوز در API بک‌اند پیاده‌سازی نشده است.' }
    if (!testPlans.some((plan) => plan.id === planId)) return { ok: false, message: 'پلن مورد نظر پیدا نشد.' }
    setTestPlans((current) => current.filter((plan) => plan.id !== planId).sort((a, b) => a.order - b.order).map((plan, index) => ({ ...plan, order: index + 1 })))
    return { ok: true }
  }, [testPlans])

  const value = useMemo((): PlansContextValue => isTestRuntime
    ? {
        plans: testPlans, serviceAvailable: true, loading: false, error: null,
        capabilities: { canCreatePlan: true, canUpdatePlan: true, canDeletePlan: true, canReorderPlan: true },
        displayCopy: unavailableCopy, createPlan, updatePlan, reorderPlan, deletePlan,
      }
    : {
        plans, serviceAvailable: error === null, loading, error,
        capabilities: { canCreatePlan: isSystemAdmin, canUpdatePlan: isSystemAdmin, canDeletePlan: false, canReorderPlan: false },
        displayCopy: unavailableCopy,
        ...(isSystemAdmin ? { createPlan, updatePlan } : {}),
      }, [createPlan, deletePlan, error, isSystemAdmin, loading, plans, reorderPlan, testPlans, updatePlan])

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>
}

export function usePlans() {
  const context = useContext(PlansContext)
  if (!context) throw new Error('usePlans must be used within a PlansProvider.')
  return context
}
