import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Edit3, Plus, Star, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePlans } from '@/contexts/PlansContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Plan } from '@/types/plan'

const emptyPlanValues = {
  name: '',
  users: 1,
  storage: '',
  priceMonthly: 0,
  priceYearly: 0,
}

const planFormSchema = z.object({
  name: z.string().trim().min(1, 'نام پلن الزامی است'),
  users: z.number()
    .int('تعداد کاربران باید عدد صحیح باشد')
    .refine((users) => users === -1 || users > 0, 'تعداد کاربران باید -۱ یا عددی مثبت باشد'),
  storage: z.string().trim().min(1, 'فضای ذخیره‌سازی الزامی است'),
  priceMonthly: z.number().min(0, 'قیمت ماهانه نمی‌تواند منفی باشد'),
  priceYearly: z.number().min(0, 'قیمت سالانه نمی‌تواند منفی باشد'),
})

type PlanFormValues = z.infer<typeof planFormSchema>

export default function PlansManagementPage() {
  const { plans, serviceAvailable, loading, error, capabilities, displayCopy, createPlan, deletePlan, reorderPlan, updatePlan } = usePlans()
  const { currentPlanId } = useSubscription()
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [actionError, setActionError] = useState('')
  const orderedPlans = useMemo(() => [...plans].sort((a, b) => a.order - b.order), [plans])

  const createForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: emptyPlanValues,
  })
  const editForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: emptyPlanValues,
  })
  const canCreatePlan = serviceAvailable && !loading && capabilities.canCreatePlan && Boolean(createPlan)
  const canUpdatePlan = serviceAvailable && !loading && capabilities.canUpdatePlan && Boolean(updatePlan)
  const canDeletePlan = serviceAvailable && !loading && capabilities.canDeletePlan && Boolean(deletePlan)
  const canReorderPlan = serviceAvailable && !loading && capabilities.canReorderPlan && Boolean(reorderPlan)

  const openCreateModal = () => {
    setEditingPlan(null)
    createForm.reset(emptyPlanValues)
    setShowModal(true)
  }

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan)
    editForm.reset({
      name: plan.name,
      users: plan.users,
      storage: plan.storage,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPlan(null)
  }

  const submitCreate = async (values: PlanFormValues) => {
    if (!createPlan) {
      createForm.setError('root', { message: error ?? displayCopy.actionUnavailable })
      return
    }
    const result = await createPlan(values)
    if (!result.ok) {
      createForm.setError('root', { message: result.message ?? error ?? displayCopy.actionUnavailable })
      return
    }

    createForm.reset(emptyPlanValues)
    closeModal()
  }

  const submitEdit = async (values: PlanFormValues) => {
    if (!editingPlan) return
    if (!updatePlan) {
      editForm.setError('root', { message: error ?? displayCopy.actionUnavailable })
      return
    }
    const result = await updatePlan(editingPlan.id, values)
    if (!result.ok) {
      editForm.setError('root', { message: result.message ?? error ?? displayCopy.actionUnavailable })
      return
    }

    closeModal()
  }

  const formatPrice = (price: number) => {
    if (price === 0) return 'رایگان'
    return `${(price / 1000000).toFixed(0)}M`
  }

  const form = editingPlan ? editForm : createForm
  const submit = editingPlan ? submitEdit : submitCreate
  const requestDelete = (plan: Plan) => {
    setDeletingPlan(plan)
    setDeleteError('')
  }
  const submitInlineUpdate = async (planId: Plan['id'], updates: Parameters<NonNullable<typeof updatePlan>>[1]) => {
    if (!updatePlan) {
      setActionError(error ?? displayCopy.actionUnavailable)
      return
    }
    const result = await updatePlan(planId, updates)
    setActionError(result.ok ? '' : result.message ?? error ?? displayCopy.actionUnavailable)
  }
  const submitReorder = async (planId: Plan['id'], direction: 'up' | 'down') => {
    if (!reorderPlan) {
      setActionError(error ?? displayCopy.actionUnavailable)
      return
    }
    const result = await reorderPlan(planId, direction)
    setActionError(result.ok ? '' : result.message ?? error ?? displayCopy.actionUnavailable)
  }

  const confirmDelete = async () => {
    if (!deletingPlan) return
    if (deletingPlan.id === currentPlanId) {
      setDeleteError('پلن فعال فعلی قابل حذف نیست.')
      return
    }
    if (!deletePlan) {
      setDeleteError(error ?? displayCopy.actionUnavailable)
      return
    }
    const result = await deletePlan(deletingPlan.id)
    if (!result.ok) {
      setDeleteError(result.message ?? error ?? displayCopy.actionUnavailable)
      return
    }

    setDeletingPlan(null)
    setDeleteError('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">مدیریت پلن‌ها</h1>
          <p className="text-sm text-muted-foreground mt-1">{orderedPlans.length} پلن</p>
        </div>
        <button onClick={openCreateModal} disabled={!canCreatePlan} className="app-action">
          <Plus className="w-4 h-4" />
          پلن جدید
        </button>
      </div>

      <div className="karnex-card overflow-hidden">
        {actionError && <p className="px-4 pt-3 text-sm text-destructive">{actionError}</p>}
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">#</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">نام</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">کاربران</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">فضا</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">ماهانه</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">سالانه</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">فعال</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">برجسته</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {orderedPlans.map((plan, index) => (
              <tr key={plan.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{plan.order}</td>
                <td className="px-4 py-3 text-xs font-medium text-foreground">{plan.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{plan.users === -1 ? '∞' : plan.users}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{plan.storage}</td>
                <td className="px-4 py-3 text-xs text-foreground">{formatPrice(plan.priceMonthly)}</td>
                <td className="px-4 py-3 text-xs text-foreground">{formatPrice(plan.priceYearly)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { void submitInlineUpdate(plan.id, { active: !plan.active }) }}
                    disabled={!canUpdatePlan}
                    className={`w-8 h-4 rounded-full transition-colors relative ${plan.active ? 'bg-primary' : 'bg-secondary'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${plan.active ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { void submitInlineUpdate(plan.id, { highlighted: !plan.highlighted }) }}
                    disabled={!canUpdatePlan}
                    className={`p-1 rounded transition-colors ${plan.highlighted ? 'bg-yellow-500/10 text-yellow-400' : 'text-muted-foreground hover:bg-secondary'}`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { void submitReorder(plan.id, 'up') }}
                      disabled={!canReorderPlan || index === 0}
                      className="p-1.5 rounded hover:bg-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="انتقال به بالا"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { void submitReorder(plan.id, 'down') }}
                      disabled={!canReorderPlan || index === orderedPlans.length - 1}
                      className="p-1.5 rounded hover:bg-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="انتقال به پایین"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => openEditModal(plan)} disabled={!canUpdatePlan} className="p-1.5 rounded hover:bg-secondary transition-colors">
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => requestDelete(plan)} disabled={!canDeletePlan} className="p-1.5 rounded hover:bg-secondary transition-colors" title="حذف پلن">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-foreground mb-4">{editingPlan ? 'ویرایش' : 'پلن جدید'}</h2>
            <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">نام</label>
                <input {...form.register('name')} type="text" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">کاربران</label>
                  <input {...form.register('users', { valueAsNumber: true })} type="number" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" dir="ltr" />
                  {form.formState.errors.users && <p className="mt-1 text-xs text-destructive">{form.formState.errors.users.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">فضا</label>
                  <input {...form.register('storage')} type="text" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" dir="ltr" />
                  {form.formState.errors.storage && <p className="mt-1 text-xs text-destructive">{form.formState.errors.storage.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">ماهانه (تومان)</label>
                  <input {...form.register('priceMonthly', { valueAsNumber: true })} type="number" min="0" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" dir="ltr" />
                  {form.formState.errors.priceMonthly && <p className="mt-1 text-xs text-destructive">{form.formState.errors.priceMonthly.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">سالانه (تومان)</label>
                  <input {...form.register('priceYearly', { valueAsNumber: true })} type="number" min="0" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" dir="ltr" />
                  {form.formState.errors.priceYearly && <p className="mt-1 text-xs text-destructive">{form.formState.errors.priceYearly.message}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-secondary text-sm">انصراف</button>
                {form.formState.errors.root?.message && <p className="text-xs text-destructive">{String(form.formState.errors.root.message)}</p>}
                <button type="submit" disabled={editingPlan ? !canUpdatePlan : !canCreatePlan} className="app-action flex-1">{loading ? displayCopy.loading : 'ذخیره'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Dialog open={deletingPlan !== null} onOpenChange={(open) => {
        if (!open) {
          setDeletingPlan(null)
          setDeleteError('')
        }
      }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف پلن</DialogTitle>
            <DialogDescription>
              آیا از حذف پلن «{deletingPlan?.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <button type="button" className="app-action" onClick={() => {
              setDeletingPlan(null)
              setDeleteError('')
            }}>انصراف</button>
            <button type="button" disabled={!canDeletePlan} className="app-action" onClick={confirmDelete}>{loading ? displayCopy.loading : 'حذف پلن'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
