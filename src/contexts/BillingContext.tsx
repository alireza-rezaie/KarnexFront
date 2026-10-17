import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import { requestApi } from '@/services/authApi'
import type { BillingAccount, BillingCapabilities, BillingDisplayCopy, BillingInvoice, BillingMutationResult, BillingSubscription, BillingUsage, PaymentMethod } from '@/types/billing'

type BillingContextValue = { serviceAvailable: boolean; loading: boolean; error: string | null; billingAccount: BillingAccount | null; subscription: BillingSubscription | null; usage: BillingUsage | null; invoices: BillingInvoice[]; paymentMethods: PaymentMethod[]; capabilities: BillingCapabilities; displayCopy: BillingDisplayCopy; changePlan?: (planId: string) => Promise<BillingMutationResult>; cancelSubscription?: () => Promise<BillingMutationResult>; updatePaymentMethod?: (id: string) => Promise<BillingMutationResult>; updateBillingIdentity?: (updates: Partial<Pick<BillingAccount, 'legalName' | 'taxId' | 'billingEmail' | 'address'>>) => Promise<BillingMutationResult>; downloadInvoice?: (id: string) => Promise<BillingMutationResult> }
type BackendSubscription = { id: number; planId: number; status: BillingSubscription['status']; periodStart: string; periodEnd: string; cancelAtPeriodEnd: boolean }
const capabilities: BillingCapabilities = { canChangePlan: true, canCancelSubscription: true, canUpdatePaymentMethod: false, canViewInvoices: false, canDownloadInvoice: false, canManageBillingIdentity: false }
const displayCopy: BillingDisplayCopy = { serviceUnavailable: 'سرویس صورت‌حساب در دسترس نیست.', billingUnavailable: 'اطلاعات صورت‌حساب در دسترس نیست.', actionUnavailable: 'انجام عملیات ممکن نیست.', loading: 'در حال دریافت صورت‌حساب…' }
const fromSubscription = (value: BackendSubscription): BillingSubscription => ({ id: String(value.id), planId: String(value.planId), status: value.status, currentPeriodStart: value.periodStart, currentPeriodEnd: value.periodEnd, renewalDate: value.periodEnd, cancelAtPeriodEnd: value.cancelAtPeriodEnd })
const BillingContext = createContext<BillingContextValue | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext); const token = auth?.accessToken
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!token) { setSubscription(null); return }; setLoading(true); void requestApi<BackendSubscription | null>('/api/billing/subscription', {}, token).then((item) => { setSubscription(item ? fromSubscription(item) : null); setError(null) }).catch((e: unknown) => setError(e instanceof Error ? e.message : displayCopy.billingUnavailable)).finally(() => setLoading(false)) }, [token])
  const changePlan = async (planId: string): Promise<BillingMutationResult> => { if (!token) return { ok: false, message: 'ورود کاربر الزامی است.' }; try { const item = await requestApi<BackendSubscription>('/api/billing/subscription', { method: 'POST', body: JSON.stringify({ planId: Number(planId) }) }, token); setSubscription(fromSubscription(item)); return { ok: true } } catch (e) { return { ok: false, message: e instanceof Error ? e.message : displayCopy.actionUnavailable } } }
  const cancelSubscription = async (): Promise<BillingMutationResult> => { if (!token) return { ok: false, message: 'ورود کاربر الزامی است.' }; try { const item = await requestApi<BackendSubscription>('/api/billing/subscription/cancel', { method: 'POST', body: JSON.stringify({ immediate: false }) }, token); setSubscription(fromSubscription(item)); return { ok: true } } catch (e) { return { ok: false, message: e instanceof Error ? e.message : displayCopy.actionUnavailable } } }
  const value = useMemo<BillingContextValue>(() => ({ serviceAvailable: true, loading, error, billingAccount: null, subscription, usage: null, invoices: [], paymentMethods: [], capabilities, displayCopy, changePlan, cancelSubscription }), [error, loading, subscription])
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}
export function useBilling() { const context = useContext(BillingContext); if (!context) throw new Error('useBilling must be used within a BillingProvider.'); return context }
export function useOptionalBilling() { return useContext(BillingContext) }
