import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form'
import {
  Archive, Bookmark, CalendarDays, Check, CheckSquare, ChevronLeft, Clock3,
  Download, Edit3, File, FileImage, FileSpreadsheet, FileText, Flag, History, Link2,
  MessageSquare, MoreHorizontal, Paperclip, Play, Send, Share2, Square,
  Timer, Trash2, Upload, UserRound, X,
} from 'lucide-react'
import { priorityConfig, typeConfig } from '@/config/taskMetadata'
import { toPersianDigits } from '@/lib/persian-numbers'
import { formatEstimatedSeconds } from '@/utils/formatEstimate'
import BoardPage from './BoardPage'
import { useProjectStatus } from '@/contexts/ProjectStatusContext'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useSprints } from '@/contexts/SprintsContext'
import { useMembers } from '@/contexts/MembersContext'
import { useRoles } from '@/contexts/RolesContext'
import { useProjectWorkflow } from '@/contexts/ProjectWorkflowContext'
import { useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { useTaskCollaboration } from '@/contexts/TaskCollaborationContext'
import { useTaskTransitions } from '@/contexts/TaskTransitionContext'
import { ApprovalActions, ApprovalProgress, ApprovalStatusBadge } from '@/components/approvals/ApprovalRequestUI'
import { UserAvatar } from '@/components/UserAvatar'
import type { Task, TaskChecklistItem } from '@/types/task'
import type { TaskAttachment } from '@/types/taskCollaboration'
import { taskFormSchema, type TaskFormValues } from '@/validation/taskForm'
import { evaluateTaskTransitionAttempt, taskTransitionFeedback } from '@/utils/taskTransitionPolicy'
import { formatJalaliDate, toCanonicalIsoDate } from '@/utils/jalaliDate'
import { JalaliDatePicker } from '@/components/JalaliDatePicker'
import { toast } from 'sonner'

const panel = 'rounded-xl border border-border/70 bg-[linear-gradient(145deg,hsl(var(--surface-raised)/.96),hsl(var(--surface-interactive)/.84))] p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/.035),0_10px_26px_hsl(var(--depth-shadow)/.16)]'
const iconButton = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/55 bg-surface-interactive text-muted-foreground transition hover:border-primary/30 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/35'

const taskFormDefaultValues = (task: Task): TaskFormValues => ({
  type: task.type as TaskFormValues['type'],
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  assignee: task.assignee,
  storyPoints: task.storyPoints,
  estimatedHours: task.estimatedSeconds ? task.estimatedSeconds / 3600 : undefined,
  sprintId: task.sprintId ?? '',
  dueDate: toCanonicalIsoDate(task.dueDate) ?? '',
})

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams()
  const navigate = useNavigate()
  const { currentProject: project } = useProject()
  const { statuses } = useProjectStatus()
  const { tasks, serviceAvailable: taskServiceAvailable, loading: taskLoading, error: taskError, capabilities: taskCapabilities, displayCopy: taskCopy, updateTask } = useProjectTasks()
  const { sprints } = useSprints()
  const { currentMember } = useCurrentUser()
  const { members } = useMembers()
  const { roles } = useRoles()
  const { transitions } = useProjectWorkflow()
  const { createRequest, requests } = useApprovalRequests()
  const { getTaskTransitions, transitionTask } = useTaskTransitions()
  const { serviceAvailable: collaborationAvailable, loading: collaborationLoading, error: collaborationError, comments: collaborationComments, attachments, timeLogs, activeTimer, watchState, capabilities: collaborationCapabilities, displayCopy: collaborationCopy, addComment: persistComment, addTimeLog: persistTimeLog, uploadAttachment, downloadAttachment, deleteAttachment, startTimer, stopTimer, followTask, unfollowTask } = useTaskCollaboration()
  const task = tasks.find(item => item.id === taskId)!
  const assignee = members.find(member => member.id === task.assignee)
  const reporter = members.find(member => member.id === task.reporter)
  const sprint = sprints.find(item => item.id === task.sprintId)
  const statusDefinition = statuses.find((item) => item.id === task.status) ?? { id: task.status, name: 'بدون وضعیت', color: '#6b7280' }
  const status = { label: statusDefinition.name, color: statusDefinition.color, bgColor: `${statusDefinition.color}26` }
  const pendingApprovalRequest = requests.find((request) => request.projectId === task.projectId && request.taskId === task.id && request.status === 'pending')
  const priority = priorityConfig[task.priority]
  const type = typeConfig[task.type]
  const progress = task.subtasks ? Math.round(task.completedSubtasks / task.subtasks * 100) : 0
  const estimate = task.estimatedSeconds ?? 0
  const editForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema(statuses.map((status) => status.id))),
    defaultValues: taskFormDefaultValues(task),
  })

  const [editing, setEditing] = useState(false)
  const [transitionPolicyError, setTransitionPolicyError] = useState('')
  const [checklistError, setChecklistError] = useState('')
  const [pendingChecklistItem, setPendingChecklistItem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [timeLogMinutes, setTimeLogMinutes] = useState('')
  const [timeLogDescription, setTimeLogDescription] = useState('')
  const [timeLogError, setTimeLogError] = useState('')
  const [timeLogPending, setTimeLogPending] = useState(false)
  const canUpdateTask = Boolean(taskServiceAvailable && !taskLoading && taskCapabilities.canUpdateTask && updateTask)
  const fileInput = useRef<HTMLInputElement>(null)
  const scope = projectId && taskId ? { projectId, taskId } : null
  const comments = scope ? collaborationComments.filter((comment) => comment.projectId === scope.projectId && comment.taskId === scope.taskId) : []
  const files = scope ? attachments.filter((attachment) => attachment.projectId === scope.projectId && attachment.taskId === scope.taskId) : []
  const logs = scope ? timeLogs.filter((log) => log.projectId === scope.projectId && log.taskId === scope.taskId) : []
  const timer = scope && activeTimer?.projectId === scope.projectId && activeTimer.taskId === scope.taskId ? activeTimer : null
  const followed = scope && watchState?.projectId === scope.projectId && watchState.taskId === scope.taskId ? watchState.isFollowing : false
  const collaborationMessage = collaborationLoading ? collaborationCopy.loading : collaborationError ?? collaborationCopy.dataUnavailable
  const logged = logs.reduce((sum, item) => sum + item.durationSeconds, 0)
  const spent = logged
  const remaining = Math.max(0, estimate - spent)

  const acceptance = task.acceptanceCriteria ?? []
  const subtasks = task.subtaskItems ?? []
  const related = tasks.filter(item => item.id !== task.id && item.projectId === task.projectId).slice(0, 3)

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      navigate(`/projects/${projectId}/board`)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [navigate, projectId])

  const copyLink = () => navigator.clipboard?.writeText(window.location.href)
  const share = () => navigator.share ? navigator.share({ title: task.title, url: window.location.href }) : copyLink()
  const start = () => { if (scope && startTimer) void startTimer(scope) }
  const stop = () => { if (scope && timer && stopTimer) void stopTimer(scope, timer.id) }
  const addFiles = (incoming: FileList | File[]) => { if (!scope || !uploadAttachment) return; Array.from(incoming).forEach((file) => { void uploadAttachment(scope, file) }) }
  const removeFile = (id: string) => { if (scope && deleteAttachment) void deleteAttachment(scope, id) }
  const addComment = async () => { const text = commentText.trim(); if (!text || !scope || !persistComment) return; const result = await persistComment(scope, text); if (result.ok) setCommentText('') }
  const addTimeLog = async () => {
    const minutes = Number(timeLogMinutes)
    if (!scope || !persistTimeLog || !Number.isFinite(minutes) || minutes <= 0) {
      setTimeLogError('مدت زمان معتبر نیست.')
      return
    }

    setTimeLogPending(true)
    setTimeLogError('')
    try {
      const result = await persistTimeLog(scope, {
        startedAt: new Date().toISOString(),
        durationSeconds: Math.round(minutes * 60),
        description: timeLogDescription.trim(),
      })
      if (!result.ok) {
        setTimeLogError(result.message ?? collaborationMessage)
        return
      }
      setTimeLogMinutes('')
      setTimeLogDescription('')
    } finally {
      setTimeLogPending(false)
    }
  }
  const toggleChecklistItem = async (kind: 'subtask' | 'acceptance', itemId: string) => {
    if (!canUpdateTask || pendingChecklistItem) return
    const items = kind === 'subtask' ? subtasks : acceptance
    const nextItems = items.map((item) => item.id === itemId ? { ...item, completed: !item.completed } : item)
    const pendingKey = `${kind}:${itemId}`
    setPendingChecklistItem(pendingKey)
    setChecklistError('')
    const result = await updateTask(task.id, kind === 'subtask'
      ? {
          subtaskItems: nextItems,
          subtasks: nextItems.length,
          completedSubtasks: nextItems.filter((item) => item.completed).length,
        }
      : { acceptanceCriteria: nextItems })
    if (!result.ok) setChecklistError(taskError ?? result.message ?? taskCopy.updateUnavailable)
    setPendingChecklistItem(null)
  }
  const toggleFollow = () => { if (!scope) return; if (followed && unfollowTask) void unfollowTask(scope); if (!followed && followTask) void followTask(scope) }
  const openEdit = () => {
    if (!canUpdateTask) return
    editForm.reset(taskFormDefaultValues(task))
    setTransitionPolicyError('')
    setEditing(true)
  }
  const submitEditTask = async (values: TaskFormValues) => {
    if (!updateTask || !canUpdateTask) {
      setTransitionPolicyError(taskLoading ? taskCopy.loading : taskError ?? taskCopy.updateUnavailable)
      return
    }
    if (values.status !== task.status) {
      const actorRoleIds = currentMember?.roleId && roles.some((role) => role.id === currentMember.roleId) ? [currentMember.roleId] : []
      const result = evaluateTaskTransitionAttempt({ task, targetStatusId: values.status, transitions, currentMember, actorRoleIds })
      if (!result.allowed) {
        let message = taskTransitionFeedback(result)
        if (result.reason === 'approval-required' && result.transition) {
          const creation = await createRequest({ projectId: task.projectId, task, transition: result.transition, requesterId: currentMember?.id })
          message = creation.ok && creation.reason === 'approval-request-created' ? 'درخواست تأیید این انتقال ثبت شد.'
            : creation.reason === 'approval-already-pending' ? 'برای این وظیفه یک درخواست تأیید در انتظار بررسی است.'
              : creation.reason === 'insufficient-eligible-approvers' ? 'تأییدکنندهٔ واجد شرایط کافی برای این انتقال وجود ندارد.'
                : 'امکان ثبت درخواست تأیید وجود ندارد.'
        }
        setTransitionPolicyError(message)
        toast.error(message)
        return
      }
      const available = getTaskTransitions({ projectId: task.projectId, taskId: task.id })
      const transition = available.ok ? available.transitions.find((candidate) => candidate.to === values.status) : undefined
      if (!transition) {
        setTransitionPolicyError('انتقال انتخاب‌شده در گردش‌کار پروژه مجاز نیست.')
        return
      }
      const transitioned = await transitionTask({ projectId: task.projectId, taskId: task.id, transitionId: transition.id })
      if (!transitioned.ok) {
        setTransitionPolicyError(transitioned.message ?? 'انتقال وظیفه انجام نشد.')
        return
      }
    }
    const updated = await updateTask(task.id, {
      title: values.title,
      description: values.description,
      type: values.type,
      priority: values.priority,
      assignee: values.assignee,
      storyPoints: values.storyPoints,
      estimatedSeconds: values.estimatedHours ? values.estimatedHours * 3600 : undefined,
      sprintId: values.sprintId || undefined,
      dueDate: values.dueDate || undefined,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    })
    if (!updated.ok) {
      setTransitionPolicyError(taskError ?? updated.message ?? taskCopy.updateUnavailable)
      return
    }
    setTransitionPolicyError('')
    setEditing(false)
  }

  return <>
    <div className="pointer-events-none min-h-0 min-w-0" aria-hidden="true"><BoardPage /></div>
    <div className="fixed inset-0 z-50 overflow-hidden bg-[rgba(2,7,15,.42)] backdrop-blur-[2px]" onClick={() => navigate(`/projects/${projectId}/board`)}>
      <section dir="rtl" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()} className="fixed left-1/2 top-1/2 flex h-[calc(100vh-16px)] max-h-[930px] w-[calc(100vw-16px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border border-border/75 bg-[radial-gradient(circle_at_72%_0%,hsl(var(--primary)/.12),transparent_34%),linear-gradient(145deg,hsl(var(--surface-inset)/.99),hsl(var(--card)/.98))] shadow-[0_30px_110px_hsl(var(--depth-shadow)/.72),inset_0_1px_0_hsl(var(--foreground)/.04)] sm:h-[min(930px,calc(100vh-64px))] sm:w-[min(1180px,calc(100vw-120px))] sm:max-h-[90vh] sm:rounded-[22px]">
        <ModalHeader task={task} projectName={project?.name} sprintName={sprint?.name} status={status} followed={followed} followDisabled={!(collaborationAvailable && !collaborationLoading && collaborationCapabilities.canFollowTask && scope && (followed ? unfollowTask : followTask))} editDisabled={!canUpdateTask} onClose={() => navigate(`/projects/${projectId}/board`)} onEdit={openEdit} onCopy={copyLink} onShare={share} onFollow={toggleFollow} />

        <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-[18px]">
          <main dir="rtl" className="min-w-0 space-y-2.5">
            <div>
              <h1 className="text-xl font-extrabold leading-8 text-foreground sm:text-2xl">{task.title}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5"><Badge config={status} /><Badge config={priority} /><Badge config={type} /></div>
            </div>

            {pendingApprovalRequest && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3" aria-label="درخواست انتقال در انتظار تأیید">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-foreground">این وظیفه یک درخواست انتقال در انتظار تأیید دارد.</p><p className="mt-1 text-[11px] text-muted-foreground">{statuses.find((item) => item.id === pendingApprovalRequest.sourceStatusId)?.name ?? 'وضعیت نامشخص'} → {statuses.find((item) => item.id === pendingApprovalRequest.targetStatusId)?.name ?? 'وضعیت نامشخص'} · درخواست‌کننده: {members.find((item) => item.id === pendingApprovalRequest.requesterId)?.name ?? 'یافت نشد'}</p></div><ApprovalStatusBadge status={pendingApprovalRequest.status} /></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><ApprovalProgress request={pendingApprovalRequest} /><ApprovalActions request={pendingApprovalRequest} transitions={transitions} compact /></div>
            </section>}

            <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Meta label="مسئول انجام" value={assignee?.name || 'ثبت نشده'} avatarId={assignee?.avatarId} avatarName={assignee?.name} icon={<UserRound />} />
              <Meta label="گزارش‌دهنده" value={reporter?.name || 'ثبت نشده'} avatarId={reporter?.avatarId} avatarName={reporter?.name} icon={<UserRound />} />
              <Meta label="امتیاز استوری" value={task.storyPoints ? toPersianDigits(task.storyPoints) : 'ثبت نشده'} icon={<CheckSquare />} />
              <Meta label="اسپرینت" value={sprint?.name || 'ثبت نشده'} icon={<Flag />} />
              <Meta label="پیشرفت" value={`${toPersianDigits(progress)}٪`} progress={progress} />
              <Meta label="زمان سررسید" value={formatJalaliDate(task.dueDate) ? toPersianDigits(formatJalaliDate(task.dueDate)!) : 'ثبت نشده'} icon={<Clock3 />} />
              <Meta label="زمان برآورد" value={formatEstimatedSeconds(estimate)} icon={<Timer />} />
              <Meta label="تاریخ شروع" value={toPersianDigits(task.createdAt)} icon={<CalendarDays />} />
            </section>

            <section className={panel}>
              <PanelHeader title={editing ? 'ویرایش وظیفه' : 'توضیحات'} icon={<FileText className="h-4 w-4" />} />
              {editing ? <form onSubmit={editForm.handleSubmit((values) => void submitEditTask(values))} className="mt-3 space-y-3">
                {transitionPolicyError && <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{transitionPolicyError}</p>}
                <fieldset disabled={!canUpdateTask} className="contents">
                <div>
                  <label className="block text-[10px] font-medium text-foreground">عنوان</label>
                  <input {...editForm.register('title')} aria-invalid={!!editForm.formState.errors.title} autoFocus className="mt-1 w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                  {editForm.formState.errors.title && <p className="mt-1 text-[10px] text-red-500">{editForm.formState.errors.title.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-foreground">توضیحات</label>
                  <textarea {...editForm.register('description')} aria-invalid={!!editForm.formState.errors.description} rows={3} className="mt-1 min-h-20 w-full resize-none rounded-lg border border-border bg-surface-inset p-3 text-xs leading-6 outline-none focus:ring-2 focus:ring-primary/30" />
                  {editForm.formState.errors.description && <p className="mt-1 text-[10px] text-red-500">{editForm.formState.errors.description.message}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <EditSelect label="نوع" registration={editForm.register('type')} options={Object.entries(typeConfig).filter(([value]) => value !== 'subtask').map(([value, config]) => ({ value, label: config.label }))} />
                  <EditSelect label="وضعیت" registration={editForm.register('status')} error={editForm.formState.errors.status?.message} options={statuses.map(status => ({ value: status.id, label: status.name }))} />
                  <EditSelect label="اولویت" registration={editForm.register('priority')} options={Object.entries(priorityConfig).map(([value, config]) => ({ value, label: config.label }))} />
                  <EditSelect label="مسئول" registration={editForm.register('assignee')} error={editForm.formState.errors.assignee?.message} options={members.map(member => ({ value: member.id, label: member.name }))} />
                  <EditSelect label="اسپرینت" registration={editForm.register('sprintId')} options={[{ value: '', label: 'بک‌لاگ' }, ...sprints.filter(item => item.projectId === projectId).map(item => ({ value: item.id, label: item.name }))]} />
                  <div>
                    <label className="block text-[10px] font-medium text-foreground">تاریخ تحویل</label>
                    <div className="mt-1 space-y-1.5"><Controller control={editForm.control} name="dueDate" render={({ field }) => <><JalaliDatePicker value={field.value || null} onChange={field.onChange} disabled={!canUpdateTask} placeholder="انتخاب تاریخ تحویل" />{field.value && <button type="button" disabled={!canUpdateTask} onClick={() => field.onChange('')} className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60">پاک کردن تاریخ تحویل</button>}</>} /></div>
                    {editForm.formState.errors.dueDate && <p className="mt-1 text-[10px] text-red-500">{editForm.formState.errors.dueDate.message}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-foreground">Story Point</label>
                    <input {...editForm.register('storyPoints', { setValueAs: value => value === '' ? undefined : Number(value) })} aria-invalid={!!editForm.formState.errors.storyPoints} type="number" min="1" className="mt-1 w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" dir="ltr" />
                    {editForm.formState.errors.storyPoints && <p className="mt-1 text-[10px] text-red-500">{editForm.formState.errors.storyPoints.message}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-foreground">زمان تخمینی (ساعت)</label>
                    <input {...editForm.register('estimatedHours', { setValueAs: value => value === '' ? undefined : Number(value) })} aria-invalid={!!editForm.formState.errors.estimatedHours} type="number" min="1" className="mt-1 w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" dir="ltr" />
                    {editForm.formState.errors.estimatedHours && <p className="mt-1 text-[10px] text-red-500">{editForm.formState.errors.estimatedHours.message}</p>}
                  </div>
                </div>
                </fieldset>
                <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary">انصراف</button><button type="submit" disabled={!canUpdateTask} title={canUpdateTask ? undefined : taskLoading ? taskCopy.loading : taskError ?? taskCopy.updateUnavailable} className="app-action disabled:cursor-not-allowed disabled:opacity-50">ذخیره تغییرات</button></div>
              </form> : <p className="mt-2 text-xs leading-6 text-muted-foreground">{task.description || 'توضیحی ثبت نشده است.'}</p>}
            </section>

            <div dir="ltr" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr]">
              <section dir="rtl" className={`${panel} flex min-h-[440px] flex-col xl:order-1`}>
                <PanelHeader title="ثبت زمان" icon={<Timer className="h-4 w-4" />} />
                <div className="mt-3 flex flex-col items-center">
                  <button type="button" onClick={timer ? stop : start} disabled={!(collaborationAvailable && !collaborationLoading && (timer ? collaborationCapabilities.canStopTimer && stopTimer : collaborationCapabilities.canStartTimer && startTimer))} aria-label="کنترل زمان‌سنج" className={`relative grid h-36 w-36 place-items-center rounded-full border-[3px] bg-surface-inset shadow-[inset_0_0_28px_hsl(var(--depth-shadow)/.55)] transition disabled:opacity-45 ${timer ? 'border-orange-500/70 shadow-[0_0_30px_rgba(249,84,26,.22)]' : 'border-primary/80 shadow-[0_0_24px_hsl(var(--primary)/.2)]'}`}>
                    <span className="absolute inset-2 rounded-full border border-border/70" />
                    <span className="relative text-center"><span dir="ltr" style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif', letterSpacing: 0 }} className="block min-w-24 text-2xl font-bold tabular-nums text-foreground">{timer ? 'فعال' : '—'}</span><span className="mt-2 block text-[9px] text-muted-foreground">{collaborationAvailable ? 'زمان‌سنج وظیفه' : collaborationCopy.serviceUnavailable}</span></span>
                  </button>
                  <div className="mt-3 flex items-center gap-4"><TimerButton label="توقف" tone="red" onClick={stop} disabled={!timer || !(collaborationAvailable && !collaborationLoading && collaborationCapabilities.canStopTimer && Boolean(stopTimer))} icon={<Square />} /><TimerButton label="شروع" tone="blue" onClick={start} disabled={Boolean(timer) || !(collaborationAvailable && !collaborationLoading && collaborationCapabilities.canStartTimer && Boolean(startTimer))} icon={<Play />} /></div>
                </div>
                <form className="mt-3 space-y-2 rounded-lg border border-border/55 bg-surface-inset/45 p-2" onSubmit={(event) => { event.preventDefault(); void addTimeLog() }}>
                  <div className="flex gap-2">
                    <input value={timeLogMinutes} onChange={(event) => { setTimeLogMinutes(event.target.value); setTimeLogError('') }} type="number" min="1" step="1" inputMode="numeric" placeholder="مدت (دقیقه)" aria-label="مدت زمان به دقیقه" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] outline-none focus:ring-2 focus:ring-primary/30" dir="ltr" />
                    <button type="submit" disabled={!scope || !persistTimeLog || timeLogPending || !Number.isFinite(Number(timeLogMinutes)) || Number(timeLogMinutes) <= 0} className="rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45">{timeLogPending ? 'در حال ثبت…' : 'ثبت زمان'}</button>
                  </div>
                  <input value={timeLogDescription} onChange={(event) => setTimeLogDescription(event.target.value)} placeholder="یادداشت (اختیاری)" aria-label="یادداشت زمان" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] outline-none focus:ring-2 focus:ring-primary/30" />
                  {timeLogError && <p className="text-[9px] text-destructive">{timeLogError}</p>}
                </form>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <TimeStat label="زمان تعیین‌شده" value={formatEstimatedSeconds(estimate)} />
                  <TimeStat label="زمان صرف‌شده" value={duration(spent)} />
                  <TimeStat label="زمان باقی‌مانده" value={duration(remaining)} />
                </div>
                <div className="mt-3 overflow-hidden rounded-lg border border-border/55">
                  <div className="grid grid-cols-4 bg-surface-inset px-2 py-2 text-[9px] text-muted-foreground"><span>کاربر</span><span>تاریخ</span><span>مدت</span><span>یادداشت</span></div>
                  {logs.slice(0, 3).map(log => <div key={log.id} className="grid grid-cols-4 border-t border-border/45 px-2 py-2 text-[9px]"><span className="truncate">{members.find((member) => member.id === log.authorId)?.name ?? log.authorId}</span><span className="truncate">{toPersianDigits(log.startedAt)}</span><span>{duration(log.durationSeconds)}</span><span className="truncate">{log.description || '—'}</span></div>)}
                  {!logs.length && <p className="border-t border-border/45 px-2 py-4 text-center text-[9px] text-muted-foreground">{collaborationAvailable ? 'هنوز زمانی ثبت نشده است' : collaborationMessage}</p>}
                  <div className="flex justify-between border-t border-border/55 px-2 py-2 text-[10px] font-bold"><span>جمع کل</span><span className="text-primary">{duration(logged)}</span></div>
                </div>
              </section>

              <div dir="rtl" className="space-y-2.5 xl:order-4">
                <section className={panel}><PanelHeader title="برچسب‌ها" count={toPersianDigits(task.labels.length)} /><div className="mt-2 flex flex-wrap gap-1.5">{task.labels.map(label => <span key={label} className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] text-primary">{label}</span>)}</div></section>
                <section className={panel}><PanelHeader title="وابستگی‌ها / مرتبط‌ها" count={toPersianDigits(related.length)} /><div className="mt-2 space-y-1.5">{related.map((item, index) => <button key={item.id} onClick={() => navigate(`/projects/${projectId}/tasks/${item.id}`)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface-inset/50 px-2 py-1.5 text-start"><span className="min-w-0"><b className="block text-[9px] text-primary">{toPersianDigits(item.key)}</b><span className="block truncate text-[10px]">{item.title}</span></span><span className="text-[8px] text-muted-foreground">{index ? 'مرتبط' : 'وابسته'}</span></button>)}</div></section>
                <section className={panel}><PanelHeader title="پیوست‌ها" count={toPersianDigits(files.length)} icon={<Paperclip className="h-4 w-4" />} />{!collaborationAvailable ? <p className="mt-2 text-[9px] text-muted-foreground">{collaborationMessage}</p> : <><div onDragOver={event => event.preventDefault()} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }} className={`mt-2 grid min-h-16 place-items-center rounded-lg border border-dashed p-2 text-center ${dragging ? 'border-primary bg-primary/10' : 'border-border/70 bg-surface-inset/50'}`}><button type="button" disabled={!(collaborationCapabilities.canUploadAttachment && uploadAttachment)} onClick={() => fileInput.current?.click()} className="text-[9px] text-muted-foreground disabled:opacity-45"><Upload className="mx-auto mb-1 h-4 w-4 text-primary" />فایل‌ها را رها یا انتخاب کنید</button><input ref={fileInput} type="file" multiple className="sr-only" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }} /></div><div className="mt-2 space-y-1.5">{files.slice(0, 2).map(item => <FileRow key={item.id} item={item} canDownload={collaborationCapabilities.canDownloadAttachment && Boolean(downloadAttachment)} canDelete={collaborationCapabilities.canDeleteAttachment && Boolean(deleteAttachment)} onDownload={() => scope && downloadAttachment && void downloadAttachment(scope, item.id)} onRemove={() => removeFile(item.id)} />)}</div></>}</section>
              </div>

              <section dir="rtl" className={`${panel} xl:order-2`}>
                <PanelHeader title="معیارهای پذیرش" count={`${toPersianDigits(acceptance.filter((item) => item.completed).length)}/${toPersianDigits(acceptance.length)}`} />
                <Checklist items={acceptance} kind="acceptance" disabled={!canUpdateTask} pendingItem={pendingChecklistItem} onToggle={toggleChecklistItem} />
              </section>

              <section dir="rtl" className={`${panel} xl:order-3`}>
                <PanelHeader title="ریزوظیفه‌ها" count={`${toPersianDigits(subtasks.filter((item) => item.completed).length)}/${toPersianDigits(subtasks.length)}`} />
                <Checklist items={subtasks} kind="subtask" disabled={!canUpdateTask} pendingItem={pendingChecklistItem} onToggle={toggleChecklistItem} />
                {checklistError && <p className="mt-2 text-[10px] text-destructive">{checklistError}</p>}
              </section>
            </div>

            <div dir="ltr" className="grid items-stretch gap-2.5 lg:grid-cols-2">
              <section dir="rtl" className={`${panel} h-full min-h-44 lg:order-2`}>
                <PanelHeader title="نظرات" count={toPersianDigits(comments.length)} icon={<MessageSquare className="h-4 w-4" />} />
                {!collaborationAvailable ? <p className="mt-2 text-[9px] text-muted-foreground">{collaborationMessage}</p> : <><div className="mt-2 flex gap-2 rounded-lg border border-border/55 bg-surface-inset/55 p-1.5"><input value={commentText} onChange={event => setCommentText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void addComment() }} placeholder="نظر خود را بنویسید..." className="min-w-0 flex-1 bg-transparent px-2 text-[10px] outline-none" /><button onClick={() => void addComment()} disabled={!commentText.trim() || !(collaborationCapabilities.canAddComment && persistComment)} className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button></div><div className="mt-2 space-y-1.5">{comments.slice(-2).map(comment => { const member = members.find(item => item.id === comment.authorId); return <div key={comment.id} className="flex gap-2 rounded-lg border border-border/45 bg-surface-inset/40 p-2"><UserAvatar avatarId={member?.avatarId} name={member?.name} className="h-7 w-7" /><div className="min-w-0"><p className="text-[10px] font-bold">{member?.name ?? 'کاربر'} <span className="font-normal text-muted-foreground">· {toPersianDigits(comment.createdAt)}</span></p><p className="mt-1 line-clamp-2 text-[9px] leading-5 text-muted-foreground">{comment.body}</p></div></div> })}</div></>}
              </section>
              <section dir="rtl" className={`${panel} h-full min-h-44 lg:order-1`}>
                <PanelHeader title="تاریخچه فعالیت‌ها" count={toPersianDigits(0)} icon={<History className="h-4 w-4" />} />
                <p className="mt-2 text-[9px] text-muted-foreground">تاریخچهٔ فعالیت پس از اتصال سرویس وظیفه نمایش داده می‌شود.</p>
              </section>
            </div>
          </main>
        </div>
      </section>
    </div>
  </>
}

function ModalHeader({ task, projectName, sprintName, status, followed, followDisabled, editDisabled, onClose, onEdit, onCopy, onShare, onFollow }: { task: Task; projectName?: string; sprintName?: string; status: { label: string }; followed: boolean; followDisabled: boolean; editDisabled: boolean; onClose: () => void; onEdit: () => void; onCopy: () => void; onShare: () => void; onFollow: () => void }) {
  return <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-card/88 px-4 py-3 backdrop-blur-md">
    <div className="flex min-w-0 items-center gap-2"><button onClick={onClose} className={iconButton} aria-label="بستن"><X className="h-4 w-4" /></button><span dir="ltr" className="font-bold text-primary">{toPersianDigits(task.key)}</span><ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" /><span className="hidden truncate text-[10px] text-muted-foreground sm:inline">{projectName || 'پروژه'} · {sprintName || 'بدون اسپرینت'} · {status.label}</span></div>
    <div className="flex items-center gap-1.5">
      <DropdownMenu.Root dir="rtl"><DropdownMenu.Trigger asChild><button className={iconButton} aria-label="گزینه‌های بیشتر"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} collisionPadding={12} className="z-[100] w-[205px] max-w-[calc(100vw-24px)] rounded-xl border border-border bg-popover p-1.5 text-[11px] shadow-2xl outline-none"><MenuItem icon={<Edit3 />} label="ویرایش" onSelect={onEdit} disabled={editDisabled} /><MenuItem icon={<Link2 />} label="کپی لینک" onSelect={onCopy} /><MenuItem icon={<Share2 />} label="اشتراک‌گذاری" onSelect={onShare} /><MenuItem icon={<Bookmark />} label={followed ? 'لغو دنبال‌کردن' : 'دنبال کردن'} onSelect={onFollow} disabled={followDisabled} /></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
      <button onClick={onCopy} className={iconButton} aria-label="کپی لینک"><Link2 className="h-4 w-4" /></button><button onClick={onShare} className={iconButton} aria-label="اشتراک‌گذاری"><Share2 className="h-4 w-4" /></button><button onClick={onFollow} disabled={followDisabled} className={`${iconButton} ${followed ? 'text-primary' : ''} disabled:cursor-not-allowed disabled:opacity-45`} aria-label="دنبال کردن"><Bookmark className="h-4 w-4" /></button>
    </div>
  </header>
}

function PanelHeader({ title, count, icon }: { title: string; count?: string; icon?: React.ReactNode }) { return <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-xs font-bold">{icon}{title}</div>{count && <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[9px] text-muted-foreground">{count}</span>}</div> }
function EditSelect({ label, registration, options, error }: { label: string; registration: UseFormRegisterReturn; options: { value: string; label: string }[]; error?: string }) { return <div><label className="block text-[10px] font-medium text-foreground">{label}</label><select {...registration} aria-invalid={!!error} className="mt-1 w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}</div> }
function TimeStat({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg border border-border/55 bg-surface-inset/65 px-2 py-2 text-center"><p className="truncate text-[8px] text-muted-foreground">{label}</p><p className="mt-1 text-[10px] font-bold leading-5 text-foreground">{value}</p></div> }
function Badge({ config }: { config: { label: string; color: string; bgColor: string } }) { return <span className="rounded-lg px-2.5 py-1 text-[9px] font-semibold" style={{ color: config.color, backgroundColor: config.bgColor }}>{config.label}</span> }
function Meta({ label, value, avatarId, avatarName, icon, progress }: { label: string; value: string; avatarId?: string | null; avatarName?: string; icon?: React.ReactNode; progress?: number }) { return <div className="min-h-[68px] rounded-xl border border-border/65 bg-surface-interactive/75 p-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/.03)]"><div className="flex items-center gap-1 text-[9px] text-muted-foreground">{icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}{label}</div><div className="mt-2 flex items-center gap-2 text-[11px] font-bold">{avatarName && <UserAvatar avatarId={avatarId} name={avatarName} className="h-6 w-6" />}<span className="truncate">{value}</span></div>{progress !== undefined && <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>}</div> }
export function Checklist({ items, kind, disabled, pendingItem, onToggle }: { items: TaskChecklistItem[]; kind: 'subtask' | 'acceptance'; disabled: boolean; pendingItem: string | null; onToggle: (kind: 'subtask' | 'acceptance', itemId: string) => Promise<void> }) { return <div className="mt-2 space-y-1.5">{items.slice(0, 4).map(item => { const pending = pendingItem === `${kind}:${item.id}`; const toggle = () => void onToggle(kind, item.id); return <div key={item.id} className="flex w-full items-center gap-2 rounded-lg border border-border/45 bg-surface-inset/45 px-2 py-1.5 text-start"><button type="button" role="checkbox" aria-checked={item.completed} aria-label={`${item.title}: ${item.completed ? 'انجام‌شده' : 'انجام‌نشده'}`} disabled={disabled || pending} onClick={(event) => { event.stopPropagation(); toggle() }} onKeyDown={(event) => { if (event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle() } }} className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${item.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/35'} disabled:cursor-not-allowed disabled:opacity-50`}>{item.completed && <Check className="h-3 w-3" />}</button><span className={`truncate text-[9px] ${item.completed ? 'text-muted-foreground line-through' : ''}`}>{item.title}</span></div> })}</div> }
function TimerButton({ label, tone, onClick, disabled, icon }: { label: string; tone: 'red' | 'neutral' | 'blue'; onClick: () => void; disabled: boolean; icon: React.ReactNode }) { const color = tone === 'red' ? 'border-red-500/40 text-red-500' : tone === 'blue' ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'; return <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center gap-1 text-[9px] disabled:opacity-35`}><span className={`grid h-10 w-10 place-items-center rounded-full border ${color} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span>{label}</button> }
function MenuItem({ icon, label, onSelect, disabled = false }: { icon: React.ReactNode; label: string; onSelect: () => void; disabled?: boolean }) { return <DropdownMenu.Item onSelect={onSelect} disabled={disabled} className="flex min-w-0 cursor-pointer items-center gap-2 whitespace-normal break-words rounded-lg px-3 py-2 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-secondary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}<span>{label}</span></DropdownMenu.Item> }
function FileRow({ item, canDownload, canDelete, onDownload, onRemove }: { item: TaskAttachment; canDownload: boolean; canDelete: boolean; onDownload: () => void; onRemove: () => void }) { return <div className="flex items-center gap-2 rounded-lg border border-border/45 bg-surface-inset/45 p-1.5"><span className="grid h-8 w-8 place-items-center rounded bg-primary/10 text-primary"><FileIcon name={item.name} contentType={item.contentType} /></span><span className="min-w-0 flex-1"><b className="block truncate text-[9px]">{item.name}</b><span className="text-[8px] text-muted-foreground">{extension(item.name)} · {fileSize(item.size)}</span></span><button onClick={onDownload} disabled={!canDownload} className="text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-45" aria-label="دریافت فایل"><Download className="h-3.5 w-3.5" /></button><button onClick={onRemove} disabled={!canDelete} className="text-muted-foreground hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-45" aria-label="حذف فایل"><Trash2 className="h-3.5 w-3.5" /></button></div> }
function FileIcon({ name, contentType }: { name: string; contentType: string }) { const ext = extension(name).toLowerCase(); if (contentType.startsWith('image/')) return <FileImage className="h-4 w-4" />; if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="h-4 w-4" />; if (['zip', 'rar', '7z'].includes(ext)) return <Archive className="h-4 w-4" />; if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return <FileText className="h-4 w-4" />; return <File className="h-4 w-4" /> }
function duration(seconds: number) { if (seconds <= 0) return '۰ دقیقه'; const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); return [hours && `${toPersianDigits(hours)} ساعت`, minutes && `${toPersianDigits(minutes)} دقیقه`].filter(Boolean).join(' و ') || `${toPersianDigits(seconds)} ثانیه` }
function extension(name: string) { const ext = name.split('.').pop(); return ext && ext !== name ? ext.toUpperCase() : 'FILE' }
function fileSize(bytes: number) { return bytes < 1024 * 1024 ? `${toPersianDigits((bytes / 1024).toFixed(1))} KB` : `${toPersianDigits((bytes / 1024 / 1024).toFixed(1))} MB` }
