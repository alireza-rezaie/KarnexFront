import { useState } from 'react'
import { Check, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useMembers } from '@/contexts/MembersContext'
import { useRoles } from '@/contexts/RolesContext'
import type { ApprovalRequest } from '@/types/approvalRequest'
import type { WorkflowTransition } from '@/types/workflow'
import { approvalStatusLabel, getApprovalActionState } from '@/utils/approvalRequestView'

const statusStyles = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-500',
  invalidated: 'border-muted-foreground/30 bg-secondary text-muted-foreground',
}

export function ApprovalStatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyles[status]}`}>{approvalStatusLabel(status)}</span>
}

export function ApprovalProgress({ request }: { request: ApprovalRequest }) {
  const approvals = request.votes.filter((vote) => vote.action === 'approve').length
  return <span className="text-[11px] text-muted-foreground">{approvals} از {request.policySnapshot.minApprovals} تأیید دریافت شده</span>
}

function voteMessage(result: string) {
  if (result === 'pending-more-approvals') return 'تأیید شما ثبت شد و درخواست هنوز به تأیید بیشتری نیاز دارد.'
  if (result === 'approved') return 'انتقال تأیید شد و با اجرای همان انتقال ثبت می‌شود.'
  if (result === 'request-invalidated') return 'این درخواست دیگر قابل اجرا نیست زیرا وضعیت وظیفه تغییر کرده است.'
  if (result === 'already-voted') return 'رأی شما پیش‌تر ثبت شده است.'
  if (result === 'requester-cannot-approve') return 'درخواست‌کننده نمی‌تواند درخواست خودش را تأیید یا رد کند.'
  if (result === 'unauthorized') return 'شما مجاز به رأی‌دادن به این درخواست نیستید.'
  return 'انجام این عملیات ممکن نیست.'
}

export function ApprovalActions({ request, transitions, onResult, compact = false }: {
  request: ApprovalRequest
  transitions: WorkflowTransition[]
  onResult?: () => void
  compact?: boolean
}) {
  const { currentMember } = useCurrentUser()
  const { members } = useMembers()
  const { roles } = useRoles()
  const { approveRequest, rejectRequest, capabilities, loading, displayCopy } = useApprovalRequests()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const state = getApprovalActionState(request, currentMember, members, roles)
  const buttonClass = compact
    ? 'rounded-md border px-2 py-1 text-[10px] font-medium'
    : 'rounded-lg border px-3 py-2 text-xs font-medium'

  const approve = async () => {
    if (!currentMember || !capabilities.canApproveRequest || loading) return
    const result = await approveRequest(request.id, request.projectId, currentMember.id, transitions)
    if (result.ok) toast.success(voteMessage(result.reason))
    else toast.error(voteMessage(result.reason))
    onResult?.()
  }
  const reject = async () => {
    if (!currentMember || !capabilities.canRejectRequest || loading) return
    const result = await rejectRequest(request.id, request.projectId, currentMember.id, reason)
    if (result.reason === 'reason-required') {
      setError('وارد کردن دلیل رد الزامی است.')
      return
    }
    if (result.ok && result.reason === 'rejected') {
      toast.success('درخواست انتقال رد شد.')
      setRejectOpen(false)
      setReason('')
    } else toast.error(voteMessage(result.reason))
    onResult?.()
  }

  if (state.vote) return <span className="text-[11px] text-muted-foreground">رأی شما: {state.vote.action === 'approve' ? 'تأیید' : 'رد'}</span>
  if (state.requesterRestricted) return <span className="text-[11px] text-muted-foreground">درخواست‌کننده نمی‌تواند درخواست خودش را تأیید یا رد کند.</span>
  if (request.status === 'invalidated') return <span className="text-[11px] text-muted-foreground">این درخواست دیگر قابل اجرا نیست زیرا وضعیت وظیفه تغییر کرده است.</span>
  if (!state.eligible) return null

  return <>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!capabilities.canApproveRequest || loading} title={!capabilities.canApproveRequest ? displayCopy.actionUnavailable : undefined} onClick={() => void approve()} className={`${buttonClass} border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50`}><Check className="ml-1 inline size-3.5" />تأیید</button>
      <button type="button" disabled={!capabilities.canRejectRequest || loading} title={!capabilities.canRejectRequest ? displayCopy.actionUnavailable : undefined} onClick={() => { setError(''); setRejectOpen(true) }} className={`${buttonClass} border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50`}>رد</button>
    </div>
    {rejectOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onMouseDown={() => setRejectOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="reject-approval-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl" dir="rtl">
        <div className="flex items-center justify-between gap-3"><h2 id="reject-approval-title" className="text-sm font-bold text-foreground">رد درخواست انتقال</h2><button type="button" onClick={() => setRejectOpen(false)} aria-label="بستن" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button></div>
        <label className="mt-4 block text-xs text-foreground">دلیل رد{request.policySnapshot.rejectionRequiresReason ? ' *' : ' (اختیاری)'}<textarea value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} rows={3} aria-invalid={!!error} className="mt-2 w-full resize-none rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" /></label>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRejectOpen(false)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary">انصراف</button><button type="button" onClick={() => void reject()} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/15">رد درخواست</button></div>
      </section>
    </div>}
  </>
}

export function ApprovalRequestMeta({ request, approverNames }: { request: ApprovalRequest; approverNames: string[] }) {
  return <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
    <span>نوع تأییدکننده: {request.policySnapshot.approverType === 'role' ? 'نقش' : 'عضو'}</span>
    <span className="truncate">تأییدکنندگان: {approverNames.join('، ') || 'یافت نشد'}</span>
  </div>
}

export function ApprovalPendingIcon() {
  return <ShieldAlert className="size-3.5" aria-hidden="true" />
}
