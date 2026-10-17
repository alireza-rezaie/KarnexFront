import { useMemo, useState } from 'react'
import { ArrowLeft, Clock3, FileCheck2, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useMembers } from '@/contexts/MembersContext'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectStatus } from '@/contexts/ProjectStatusContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useProjectWorkflow } from '@/contexts/ProjectWorkflowContext'
import { useRoles } from '@/contexts/RolesContext'
import { ApprovalActions, ApprovalProgress, ApprovalRequestMeta, ApprovalStatusBadge } from '@/components/approvals/ApprovalRequestUI'
import type { ApprovalRequest, ApprovalRequestStatus } from '@/types/approvalRequest'
import { getApprovalActionState } from '@/utils/approvalRequestView'

type ApprovalTab = 'action' | 'mine' | 'all'
type StatusFilter = 'all' | ApprovalRequestStatus

const tabLabels: Record<ApprovalTab, string> = {
  action: 'نیازمند اقدام من',
  mine: 'درخواست‌های من',
  all: 'همه درخواست‌ها',
}
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'همه' }, { value: 'pending', label: 'در انتظار' }, { value: 'approved', label: 'تأیید شده' }, { value: 'rejected', label: 'رد شده' }, { value: 'invalidated', label: 'نامعتبر' },
]

export default function ApprovalsPage() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const { tasks } = useProjectTasks()
  const { statuses } = useProjectStatus()
  const { transitions } = useProjectWorkflow()
  const { requests, serviceAvailable, loading, error, displayCopy } = useApprovalRequests()
  const { currentMember } = useCurrentUser()
  const { members } = useMembers()
  const { roles } = useRoles()
  const [tab, setTab] = useState<ApprovalTab>('action')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const projectRequests = useMemo(() => requests.filter((request) => request.projectId === currentProject?.id), [requests, currentProject?.id])
  const visibleRequests = useMemo(() => projectRequests.filter((request) => {
    if (tab === 'action') return getApprovalActionState(request, currentMember, members, roles).eligible
    if (tab === 'mine') return request.requesterId === currentMember?.id
    return statusFilter === 'all' || request.status === statusFilter
  }), [projectRequests, tab, statusFilter, currentMember, members, roles])

  const emptyText = !serviceAvailable ? error ?? (loading ? displayCopy.loading : displayCopy.requestsUnavailable) : tab === 'all' && statusFilter !== 'all' && projectRequests.length > 0
    ? 'درخواستی با فیلتر وضعیت انتخاب‌شده پیدا نشد.'
    : tab === 'action'
    ? 'درخواست تأییدی برای بررسی شما وجود ندارد.'
    : tab === 'mine' ? 'هنوز درخواست تأییدی ثبت نکرده‌اید.' : 'درخواست تأییدی برای این پروژه وجود ندارد.'

  return <main dir="rtl" className="mx-auto min-h-[calc(100dvh-6rem)] max-w-6xl px-4 py-6 text-start sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><FileCheck2 className="size-5 text-primary" /><h1 className="text-xl font-bold text-foreground">درخواست‌های تأیید</h1></div><p className="mt-2 text-xs text-muted-foreground">بررسی انتقال‌های نیازمند تأیید در پروژه «{currentProject?.name}»</p></div>
      <div className="rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs text-muted-foreground"><Clock3 className="ml-1 inline size-3.5" />{serviceAvailable ? 'درخواست‌های تأیید از سرویس پروژه دریافت می‌شوند' : displayCopy.serviceUnavailable}</div>
    </header>

    <section className="mt-6 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {(['action', 'mine', 'all'] as ApprovalTab[]).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${tab === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>{tabLabels[value]}</button>)}
        {tab === 'all' && <div className="mr-auto flex flex-wrap gap-1">{statusFilters.map((filter) => <button key={filter.value} type="button" onClick={() => setStatusFilter(filter.value)} className={`rounded-md px-2 py-1 text-[10px] ${statusFilter === filter.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/70'}`}>{filter.label}</button>)}</div>}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {visibleRequests.map((request) => <ApprovalRequestCard key={request.id} request={request} tasks={tasks} statuses={statuses} members={members} roles={roles} transitions={transitions} onNavigate={(taskId) => navigate(`/projects/${currentProject?.id}/tasks/${taskId}`)} />)}
        {!visibleRequests.length && <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-border bg-surface-inset/45 px-5 text-center text-sm text-muted-foreground">{emptyText}</div>}
      </div>
    </section>
  </main>
}

function ApprovalRequestCard({ request, tasks, statuses, members, roles, transitions, onNavigate }: {
  request: ApprovalRequest
  tasks: ReturnType<typeof useProjectTasks>['tasks']
  statuses: ReturnType<typeof useProjectStatus>['statuses']
  members: ReturnType<typeof useMembers>['members']
  roles: ReturnType<typeof useRoles>['roles']
  transitions: ReturnType<typeof useProjectWorkflow>['transitions']
  onNavigate: (taskId: string) => void
}) {
  const task = tasks.find((item) => item.id === request.taskId)
  const source = statuses.find((status) => status.id === request.sourceStatusId)
  const target = statuses.find((status) => status.id === request.targetStatusId)
  const requester = members.find((member) => member.id === request.requesterId)
  const approverNames = request.policySnapshot.approverType === 'role'
    ? roles.filter((role) => request.policySnapshot.approverIds.includes(role.id)).map((role) => role.name)
    : members.filter((member) => request.policySnapshot.approverIds.includes(member.id)).map((member) => member.name)

  return <article className="rounded-xl border border-border bg-surface-interactive p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><button type="button" onClick={() => task && onNavigate(task.id)} disabled={!task} className="flex min-w-0 items-center gap-2 text-right text-sm font-bold text-foreground hover:text-primary disabled:cursor-default disabled:hover:text-foreground"><span className="truncate">{task?.title ?? 'وظیفهٔ حذف‌شده'}</span>{task && <ArrowLeft className="size-4 shrink-0 text-primary" />}</button><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{task?.key ?? 'وظیفه در دسترس نیست'}</span><span>•</span><span>{source?.name ?? 'وضعیت نامشخص'} → {target?.name ?? 'وضعیت نامشخص'}</span></div></div><ApprovalStatusBadge status={request.status} /></div>
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2"><ApprovalProgress request={request} /><span className="text-[11px] text-muted-foreground"><UserRound className="ml-1 inline size-3.5" />درخواست‌کننده: {requester?.name ?? 'یافت نشد'}</span><span className="text-[11px] text-muted-foreground">ثبت: {new Date(request.createdAt).toLocaleString('fa-IR')}</span></div>
    <div className="mt-3 border-t border-border/70 pt-3"><ApprovalRequestMeta request={request} approverNames={approverNames} /></div>
    {request.status === 'rejected' && request.votes.find((vote) => vote.action === 'reject')?.reason && <p className="mt-3 rounded-lg bg-red-500/8 px-3 py-2 text-[11px] text-red-500">دلیل رد: {request.votes.find((vote) => vote.action === 'reject')?.reason}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[10px] text-muted-foreground">انتقال: {source?.name ?? request.sourceStatusId} → {target?.name ?? request.targetStatusId}</span><ApprovalActions request={request} transitions={transitions} /></div>
  </article>
}
