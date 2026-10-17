export interface Plan {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  users: number
  features: string[]
  highlighted: boolean
  storage: string
  active: boolean
  order: number
}

export type CreatePlanInput = Pick<Plan, 'name' | 'priceMonthly' | 'priceYearly' | 'users' | 'storage'>
  & Partial<Pick<Plan, 'description' | 'features' | 'highlighted' | 'active'>>
export type UpdatePlanInput = Partial<Omit<Plan, 'id' | 'order'>>
export type PlanDirection = 'up' | 'down'

export type PlanMutationResult =
  | { ok: true; plan?: Plan }
  | { ok: false; message?: string }

export interface PlanCapabilities {
  canCreatePlan: boolean
  canUpdatePlan: boolean
  canDeletePlan: boolean
  canReorderPlan: boolean
}

export interface PlanDisplayCopy {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}
