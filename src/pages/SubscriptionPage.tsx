import { Check, Crown } from 'lucide-react'
import { usePlans } from '@/contexts/PlansContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

export default function SubscriptionPage() {
  const { plans: pricingPlans } = usePlans()
  const { currentPlanId, changePlan } = useSubscription()
  const currentPlan = pricingPlans.find(plan => plan.id === currentPlanId)
  const currentPlanUserLimit = currentPlan?.users === -1 ? 'نامحدود' : currentPlan?.users.toLocaleString('fa-IR') ?? '—'
  const currentPlanStorageLimit = currentPlan?.features.find(feature => feature.includes('فضا')) ?? '—'
  const selectPlan = async (planId: string, active: boolean) => {
    if (!active || planId === currentPlanId) return

    if (!changePlan) {
      toast.error('تغییر پلن پس از اتصال سرویس صورت‌حساب در دسترس است.')
      return
    }
    const result = await changePlan(planId)
    if (!result.ok) {
      toast.error(result.message ?? 'پلن انتخاب‌شده دیگر در دسترس نیست.')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">اشتراک و صورتحساب</h1>

      <div className="karnex-card p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-foreground">{currentPlan?.name}</h2>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">فعال</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">تا {currentPlanUserLimit} کاربر | {currentPlanStorageLimit}</p>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <div>
                <p className="text-foreground font-medium">8 کاربر</p>
                <p>از {currentPlanUserLimit}</p>
              </div>
              <div>
                <p className="text-foreground font-medium">3.2 GB</p>
                <p>از 10 GB</p>
              </div>
              <div>
                <p className="text-foreground font-medium">1403/05/01</p>
                <p>تجدید</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('subscription-plan-selection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="app-action"
          >
            ارتقا
          </button>
        </div>
      </div>

      <div id="subscription-plan-selection" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pricingPlans.filter(p => p.id !== 'enterprise').map(plan => {
          const isCurrentPlan = plan.id === currentPlanId
          const isSelectable = plan.active && !isCurrentPlan

          return (
          <div key={plan.id} className={`karnex-card p-5 ${isCurrentPlan ? 'border-primary/50' : ''}`}>
            <h3 className="font-semibold text-sm text-foreground mb-1">{plan.name}</h3>
            <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
            <p className="text-lg font-bold text-foreground mb-4">
              {plan.priceMonthly === 0 ? 'رایگان' : `${plan.priceMonthly.toLocaleString('fa-IR')} تومان/ماه`}
            </p>
            <ul className="space-y-2 mb-4">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3 h-3 text-green-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => void selectPlan(plan.id, plan.active)}
              disabled={!isSelectable}
              className={`w-full py-2 rounded-xl text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              isCurrentPlan
                ? 'bg-primary text-primary-foreground' 
                : 'border border-border text-foreground hover:bg-secondary'
            }`}>
              {isCurrentPlan ? 'پلن فعلی' : 'انتخاب'}
            </button>
          </div>
          )
        })}
      </div>

      <div className="karnex-card p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4">صورتحساب‌ها</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">شماره</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">تاریخ</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">مبلغ</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'INV-001', date: '۱۴۰۳/۰۴/۰۱', amount: '۲,۰۰۰,۰۰۰', status: 'پرداخت‌شده' },
              { id: 'INV-002', date: '۱۴۰۳/۰۳/۰۱', amount: '۲,۰۰۰,۰۰۰', status: 'پرداخت‌شده' },
              { id: 'INV-003', date: '۱۴۰۳/۰۲/۰۱', amount: '۲,۰۰۰,۰۰۰', status: 'پرداخت‌شده' },
            ].map(inv => (
              <tr key={inv.id} className="border-b border-border">
                <td className="px-4 py-3 text-xs text-foreground">{inv.id}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.date}</td>
                <td className="px-4 py-3 text-xs text-foreground">{inv.amount}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toaster />
    </div>
  )
}
