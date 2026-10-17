import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  Search, Filter, ChevronDown, Plus,
  Bug, Layers, BookOpen, CheckSquare, CalendarDays, Clock3,
  BarChart3, ExternalLink
} from 'lucide-react'
import { priorityConfig, typeConfig } from '@/config/taskMetadata'
import { UserAvatar } from '@/components/UserAvatar'
import type { Sprint, SprintCompletionDestination } from '@/types/sprint'
import type { Task } from '@/types/task'
import { isProjectRoleManager } from '@/types/role'
import { toPersianDigits } from '@/lib/persian-numbers'
import { formatEstimatedSeconds } from '@/utils/formatEstimate'
import { formatJalaliDate, parseIsoDate, toCanonicalIsoDate, toJalaliComparableDate } from '@/utils/jalaliDate'
import { autoSprintEndDate, fixedSprintDurations, getSprintDurationMode, sprintDurationValue, type SprintDurationMode } from '@/utils/sprintDateRange'
import { useProject } from '@/contexts/ProjectContext'
import { getProjectMethodologyCapabilities } from '@/utils/projectMethodology'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useSprints } from '@/contexts/SprintsContext'
import { useMembers } from '@/contexts/MembersContext'
import { useProjectBoard } from '@/contexts/ProjectBoardContext'
import { useOptionalTerminalStatusPolicy } from '@/contexts/TerminalStatusPolicyContext'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { JalaliDatePicker } from '@/components/JalaliDatePicker'

const BACKLOG_TASK_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: '6fr 28fr 17fr 7fr 6fr 7fr 11fr 10fr 8fr',
  columnGap: 0,
  width: '100%',
  direction: 'rtl',
}

const getTaskSortDate = (task: Task) => {
  return toJalaliComparableDate(task.updatedAt)
    ?? toJalaliComparableDate(task.createdAt)
}

const createSprintSchema = z.object({
  name: z.string().trim().min(1, 'نام اسپرینت الزامی است'),
  goal: z.string().trim(),
  durationMode: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('custom')]),
  startDate: z.string().trim().refine((value) => parseIsoDate(value) !== undefined, 'تاریخ شروع معتبر نیست'),
  endDate: z.string().trim().refine((value) => parseIsoDate(value) !== undefined, 'تاریخ پایان معتبر نیست'),
}).refine(({ startDate, endDate }) => {
  return !parseIsoDate(startDate) || !parseIsoDate(endDate) || endDate > startDate
}, { message: 'تاریخ پایان باید بعد از تاریخ شروع باشد', path: ['endDate'] })

type CreateSprintFormValues = z.infer<typeof createSprintSchema>

const createSprintDefaultValues: CreateSprintFormValues = {
  name: '',
  goal: '',
  durationMode: 2,
  startDate: '',
  endDate: '',
}

export default function BacklogPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentProject, projectId } = useProject()
  const methodology = getProjectMethodologyCapabilities(currentProject?.type)
  const { tasks, updateTask } = useProjectTasks()
  const { sprints, serviceAvailable: sprintServiceAvailable, loading: sprintLoading, error: sprintError, capabilities: sprintCapabilities, displayCopy: sprintCopy, createSprint, updateSprint, startSprint, completeSprint } = useSprints()
  const { currentMember } = useCurrentUser()
  const { members } = useMembers()
  const { getBoardConfiguration } = useProjectBoard()
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy()
  const terminalStatusIds = terminalStatusPolicy?.getTerminalStatusIds(projectId ?? '') ?? []
  const isProjectTaskCompleted = (task: Task) => task.projectId === projectId && terminalStatusIds.includes(task.status)
  const projectPath = `/projects/${currentProject?.id ?? ''}`
  const kanbanPlanningEnabled = methodology.boardWorkSelectionMode === 'continuous-flow'
    && getBoardConfiguration(projectId ?? '', []).kanbanBacklogEnabled
  const [search, setSearch] = useState('')
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null)
  const [completionDestination, setCompletionDestination] = useState<SprintCompletionDestination>({ kind: 'backlog' })
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [completionPending, setCompletionPending] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>(() => ({
    backlog: true,
    ...Object.fromEntries(sprints.map(sprint => [sprint.id, true])),
  }))
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(true)
  const [sortByRecent, setSortByRecent] = useState(false)
  const sprintForm = useForm<CreateSprintFormValues>({
    resolver: zodResolver(createSprintSchema),
    defaultValues: createSprintDefaultValues,
  })
  const selectedSprintDuration = useWatch({ control: sprintForm.control, name: 'durationMode' })
  const canManageProjectSprints = Boolean(currentProject && currentMember && isProjectRoleManager(currentProject.memberRoles?.[currentMember.id]))
  const canCreateSprint = Boolean(canManageProjectSprints && methodology.supportsSprints && projectId && sprintServiceAvailable && !sprintLoading && sprintCapabilities.canCreateSprint && createSprint)
  const canUpdateSprint = Boolean(canManageProjectSprints && methodology.supportsSprints && projectId && sprintServiceAvailable && !sprintLoading && sprintCapabilities.canUpdateSprint && updateSprint)
  const canCompleteSprint = Boolean(canUpdateSprint && completeSprint)

  const openCreateTask = () => {
    setShowCreateTask(true)
  }
  const openCreateSprint = () => {
    sprintForm.reset(createSprintDefaultValues)
    setEditingSprint(null)
    setShowCreateSprint(true)
  }

  const openEditSprint = (sprint: Sprint) => {
    const startDate = toCanonicalIsoDate(sprint.startDate) ?? ''
    const endDate = toCanonicalIsoDate(sprint.endDate) ?? ''
    sprintForm.reset({ name: sprint.name, goal: sprint.goal, startDate, endDate, durationMode: getSprintDurationMode(startDate, endDate) })
    setEditingSprint(sprint)
    setShowCreateSprint(true)
  }

  const openCompleteSprint = (sprint: Sprint) => {
    setCompletingSprint(sprint)
    setCompletionDestination({ kind: 'backlog' })
    setCompletionError(null)
  }

  const closeCompleteSprint = () => {
    if (completionPending) return
    setCompletingSprint(null)
    setCompletionError(null)
  }

  const submitSprintCompletion = async () => {
    if (!completingSprint || !projectId || !completeSprint) return
    const remaining = getSprintTasks(completingSprint.id).filter((task) => !isProjectTaskCompleted(task)).length
    if (remaining > 0 && !completionDestination) {
      setCompletionError('مقصد وظایف ناتمام را انتخاب کنید.')
      return
    }
    setCompletionPending(true)
    setCompletionError(null)
    const result = await completeSprint(projectId, completingSprint.id, completionDestination)
    setCompletionPending(false)
    if (!result.ok) {
      setCompletionError(result.message ?? 'تکمیل اسپرینت ناموفق بود.')
      return
    }
    setCompletingSprint(null)
  }

  const selectSprintDuration = (durationMode: Exclude<SprintDurationMode, 'custom'>) => {
    const startDate = sprintForm.getValues('startDate')
    sprintForm.setValue('durationMode', durationMode, { shouldDirty: true, shouldValidate: true })
    if (startDate) sprintForm.setValue('endDate', autoSprintEndDate(startDate, durationMode) ?? '', { shouldDirty: true, shouldValidate: true })
  }

  const changeSprintStartDate = (startDate: string) => {
    const durationMode = sprintForm.getValues('durationMode')
    if (durationMode !== 'custom') sprintForm.setValue('endDate', autoSprintEndDate(startDate, durationMode) ?? '', { shouldDirty: true, shouldValidate: true })
  }

  const changeSprintEndDate = () => {
    sprintForm.setValue('durationMode', 'custom', { shouldDirty: true, shouldValidate: true })
  }

  useEffect(() => {
    if (!(location.state as { openCreateSprint?: boolean } | null)?.openCreateSprint) return

    if (!methodology.supportsSprints) {
      navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })
      return
    }

    sprintForm.reset(createSprintDefaultValues)
    // The route state is a one-time external navigation intent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCreateSprint(true)
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })
  }, [location.hash, location.pathname, location.search, location.state, methodology.supportsSprints, navigate, sprintForm])

  const submitSprint = async (values: CreateSprintFormValues) => {
    if (!projectId || !methodology.supportsSprints) {
      sprintForm.setError('root', { message: 'پروژه جاری برای ایجاد اسپرینت در دسترس نیست' })
      return
    }

    if ((editingSprint && (!updateSprint || !canUpdateSprint)) || (!editingSprint && (!createSprint || !canCreateSprint))) return

    const input = {
      name: values.name,
      goal: values.goal,
      status: 'planned' as const,
      startDate: values.startDate,
      endDate: values.endDate,
      duration: sprintDurationValue(values.durationMode, values.startDate, values.endDate),
    }
    const result = editingSprint
      ? await updateSprint?.(projectId, editingSprint.id, input)
      : await createSprint?.(projectId, input)
    if (!result?.ok) {
      sprintForm.setError('root', { message: result?.message ?? 'ذخیرهٔ اسپرینت ناموفق بود.' })
      return
    }

    sprintForm.reset(createSprintDefaultValues)
    setEditingSprint(null)
    setShowCreateSprint(false)
  }

  const activeSprints = sprints.filter(s => s.projectId === currentProject?.id && s.status === 'active')
  const plannedSprints = sprints.filter(s => s.projectId === currentProject?.id && s.status === 'planned')
  const normalizedSearch = search.trim().toLocaleLowerCase('fa')
  const filteredTasks = tasks.filter(task => {
    if (task.projectId !== currentProject?.id) return false
    const matchesSearch = !normalizedSearch || `${task.title} ${task.key}`.toLocaleLowerCase('fa').includes(normalizedSearch)
    const matchesMine = !myTasksOnly || task.assignee === currentMember?.id
    const matchesAssignee = assigneeFilter === 'all' || task.assignee === assigneeFilter
    const matchesPriorityFilter = priorityFilter === 'all' || task.priority === priorityFilter
    return matchesSearch && matchesMine && matchesAssignee && matchesPriorityFilter
  })
  const sortedTasks = sortByRecent
    ? [...filteredTasks].sort((first, second) => {
      const firstDate = getTaskSortDate(first)
      const secondDate = getTaskSortDate(second)
      if (firstDate === undefined) return secondDate === undefined ? 0 : 1
      if (secondDate === undefined) return -1
      return secondDate - firstDate
    })
    : filteredTasks
  const backlogTasks = sortedTasks.filter((task) => {
    if (methodology.supportsSprints) return !task.sprintId
    return kanbanPlanningEnabled && task.inKanbanBacklog === true
  })
  
  const toggleSprint = (id: string) => {
    setExpandedSprints(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getSprintTasks = (sprintId: string) => sortedTasks.filter(t => t.sprintId === sprintId)
  const moveTaskToSprint = (taskId: string, sprintId: string) => void updateTask(taskId, { sprintId: sprintId || undefined })
  const moveKanbanTask = (taskId: string, inKanbanBacklog: boolean) => void updateTask(taskId, { inKanbanBacklog })

  const typeIcon = (type: string) => {
    switch (type) {
      case 'epic': return <Layers className="w-3.5 h-3.5" />
      case 'story': return <BookOpen className="w-3.5 h-3.5" />
      case 'bug': return <Bug className="w-3.5 h-3.5" />
      default: return <CheckSquare className="w-3.5 h-3.5" />
    }
  }

  const scheduledTime = (task: Task) => formatEstimatedSeconds(task.estimatedSeconds)

  const renderTaskTable = (items: Task[]) => (
    <>
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[1120px]">
          <div style={BACKLOG_TASK_GRID_STYLE} className="grid h-9 items-center border-b border-border/70 bg-surface-inset/70 text-[10px] font-medium text-muted-foreground">
            {['شناسه', 'عنوان', 'برچسب‌ها', 'نوع', 'امتیاز (SP)', 'اولویت', 'مسئول', 'زمان تعیین‌شده', 'عملیات'].map((label, index) => <div key={label} className={`min-w-0 box-border px-2.5 ${index === 1 || index === 2 ? 'text-start' : 'text-center'}`}>{label}</div>)}
          </div>
          <div>
            {items.map(task => {
              const assignee = members.find(member => member.id === task.assignee)
              const priority = priorityConfig[task.priority]
              const type = typeConfig[task.type]
              return (
                <div key={task.id} style={BACKLOG_TASK_GRID_STYLE} role="button" tabIndex={0} onClick={() => navigate(`${projectPath}/tasks/${task.id}`)} onKeyDown={event => { if (event.key === 'Enter') navigate(`${projectPath}/tasks/${task.id}`) }} className="group grid h-[52px] cursor-pointer items-center border-b border-border/55 py-1.5 text-[11px] outline-none transition hover:bg-primary/[0.035] focus-visible:bg-primary/[0.05] last:border-b-0">
                  <div className="min-w-0 box-border px-2.5 text-center"><span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap font-medium text-primary"><span style={{ color: type.color }}>{typeIcon(task.type)}</span>{toPersianDigits(task.key)}</span></div>
                  <div className="min-w-0 truncate box-border px-2.5 text-start font-semibold text-foreground" title={task.title}>{task.title}</div>
                  <div className="min-w-0 box-border px-2.5 text-start"><span className="flex min-w-0 items-center gap-1.5 overflow-hidden">{task.labels.slice(0, 2).map(label => <span key={label} className="h-6 shrink-0 rounded-md bg-secondary/80 px-2 leading-6 text-muted-foreground">{label}</span>)}{task.labels.length > 2 && <span className="shrink-0 text-[10px] text-muted-foreground">+{toPersianDigits(task.labels.length - 2)}</span>}</span></div>
                  <div className="min-w-0 box-border px-2.5 text-center"><span className="inline-flex h-6 items-center rounded-md px-2" style={{ backgroundColor: type.bgColor, color: type.color }}>{type.label}</span></div>
                  <div className="min-w-0 box-border px-2.5 text-center"><span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-secondary font-semibold text-foreground">{toPersianDigits(task.storyPoints ?? 0)}</span></div>
                  <div className="min-w-0 box-border px-2.5 text-center"><span className="inline-flex h-6 items-center rounded-md px-2 font-medium" style={{ backgroundColor: priority.bgColor, color: priority.color }}>{priority.label}</span></div>
                  <div className="min-w-0 box-border px-2.5 text-center"><span className="inline-flex min-w-0 items-center gap-2">{assignee && <UserAvatar avatarId={assignee.avatarId} name={assignee.name} className="h-7 w-7 border border-border" />}<span className="truncate text-foreground">{assignee?.name || 'بدون مسئول'}</span></span></div>
                  <div className="min-w-0 box-border whitespace-nowrap px-2.5 text-center text-foreground"><Clock3 className="me-1 inline h-3.5 w-3.5 text-muted-foreground" />{scheduledTime(task)}</div>
                  <div className="min-w-0 box-border px-2.5 text-center"><span className="inline-flex items-center gap-1"><button type="button" aria-label="باز کردن وظیفه" onClick={event => { event.stopPropagation(); navigate(`${projectPath}/tasks/${task.id}`) }} className="rounded-md p-1.5 text-primary hover:bg-primary/10"><ExternalLink className="h-3.5 w-3.5" /></button>{methodology.supportsSprints && <select aria-label={`انتقال ${task.title} به اسپرینت`} value={task.sprintId ?? ''} onClick={event => event.stopPropagation()} onChange={event => moveTaskToSprint(task.id, event.target.value)} className="max-w-28 rounded border border-border bg-background px-1 py-1 text-[9px] text-foreground"><option value="">بک‌لاگ</option>{[...activeSprints, ...plannedSprints].map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>}{kanbanPlanningEnabled && <button type="button" aria-label={`ارسال ${task.title} به جریان کانبان`} onClick={event => { event.stopPropagation(); moveKanbanTask(task.id, false) }} className="rounded border border-primary/25 px-2 py-1 text-[9px] text-primary hover:bg-primary/10">ارسال به جریان</button>}</span></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="space-y-2 p-2 md:hidden">
        {items.map(task => {
          const assignee = members.find(member => member.id === task.assignee)
          const priority = priorityConfig[task.priority]
          const type = typeConfig[task.type]
          return <button type="button" key={task.id} onClick={() => navigate(`${projectPath}/tasks/${task.id}`)} className="w-full rounded-xl border border-border/70 bg-surface-interactive p-3 text-right shadow-sm">
            <span className="flex items-center justify-between gap-3"><strong className="line-clamp-1 text-xs text-foreground">{task.title}</strong><span className="shrink-0 text-[10px] text-primary">{toPersianDigits(task.key)}</span></span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">{task.labels.slice(0, 2).map(label => <span key={label} className="rounded-md bg-secondary px-2 py-1 text-[9px] text-muted-foreground">{label}</span>)}<span className="rounded-md px-2 py-1 text-[9px]" style={{ backgroundColor: type.bgColor, color: type.color }}>{type.label}</span><span className="rounded-md px-2 py-1 text-[9px]" style={{ backgroundColor: priority.bgColor, color: priority.color }}>{priority.label}</span><span className="rounded-md bg-secondary px-2 py-1 text-[9px]">{toPersianDigits(task.storyPoints ?? 0)} SP</span></span>
            <span className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5">{assignee && <UserAvatar avatarId={assignee.avatarId} name={assignee.name} className="h-5 w-5" />}{assignee?.name || 'بدون مسئول'}</span><span>زمان تعیین‌شده: <b className="text-foreground">{scheduledTime(task)}</b></span></span>
            {methodology.supportsSprints && <select aria-label={`انتقال ${task.title} به اسپرینت`} value={task.sprintId ?? ''} onChange={event => moveTaskToSprint(task.id, event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground"><option value="">بک‌لاگ</option>{[...activeSprints, ...plannedSprints].map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>}
            {kanbanPlanningEnabled && <button type="button" onClick={event => { event.stopPropagation(); moveKanbanTask(task.id, false) }} className="mt-2 w-full rounded-lg border border-primary/25 px-2 py-1.5 text-[10px] text-primary hover:bg-primary/10">ارسال به جریان کانبان</button>}
          </button>
        })}
      </div>
    </>
  )

  const renderSprintPanel = (sprint: Sprint) => {
    const sprintTasks = getSprintTasks(sprint.id)
    const completed = sprintTasks.filter(isProjectTaskCompleted).length
    const remaining = sprintTasks.length - completed
    const progress = sprintTasks.length ? Math.round((completed / sprintTasks.length) * 100) : 0
    const sprintMembers = [...new Set(sprintTasks.map(task => task.assignee))].map(id => members.find(member => member.id === id)).filter(Boolean)
    const active = sprint.status === 'active'
    return <section key={sprint.id} className="w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_32px_hsl(var(--depth-shadow)/0.18),inset_0_1px_0_hsl(var(--foreground)/0.025)]">
      <header className="grid min-h-14 grid-cols-1 items-center gap-3 border-b border-border/70 bg-surface-elevated/45 px-4 py-2.5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" onClick={() => toggleSprint(sprint.id)} aria-label="باز و بسته کردن اسپرینت" className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronDown className={`h-4 w-4 transition-transform ${expandedSprints[sprint.id] ? '' : '-rotate-90'}`} /></button>
          <h2 className="truncate text-sm font-bold text-foreground">{sprint.name}</h2>
          <span className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold ${active ? 'bg-emerald-500/12 text-emerald-500' : 'bg-amber-500/12 text-amber-500'}`}>{active ? 'فعال' : 'در انتظار شروع'}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:flex-nowrap">
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{toPersianDigits(formatJalaliDate(sprint.startDate) ?? sprint.startDate)} تا {toPersianDigits(formatJalaliDate(sprint.endDate) ?? sprint.endDate)}</span>
          <div className="flex min-w-[180px] max-w-[260px] flex-1 items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${active ? 'bg-primary' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} /></div><span className="w-9 text-[10px] font-semibold text-foreground">{toPersianDigits(progress)}٪</span></div>
          <div className="flex shrink-0 items-center gap-4 whitespace-nowrap text-[10px] text-muted-foreground"><span>{toPersianDigits(sprintTasks.length)} وظیفه</span><span>{toPersianDigits(completed)} انجام شده</span><span>{toPersianDigits(remaining)} باقی‌مانده</span></div>
        </div>
          <div className="flex items-center justify-end gap-2 lg:justify-start">
            <div className="flex -space-x-2 space-x-reverse">{sprintMembers.slice(0, 4).map(member => member && <UserAvatar key={member.id} avatarId={member.avatarId} name={member.name} className="h-7 w-7 border-2 border-card" />)}{sprintMembers.length > 4 && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-secondary text-[9px] text-foreground">+{toPersianDigits(sprintMembers.length - 4)}</span>}</div>
          <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => openEditSprint(sprint)} disabled={!canUpdateSprint} className="rounded-lg border border-border/70 px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">ویرایش</button>{active ? <button type="button" onClick={() => openCompleteSprint(sprint)} disabled={!canCompleteSprint} className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-[10px] text-amber-600 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50">تکمیل اسپرینت</button> : <button type="button" onClick={() => void startSprint?.(currentProject!.id, sprint.id)} disabled={!canUpdateSprint} className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-[10px] text-emerald-600 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50">شروع اسپرینت</button>}</div>
          <button type="button" onClick={() => navigate(`${projectPath}/reports`)} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-interactive px-3 py-1.5 text-[10px] text-foreground hover:border-primary/25"><BarChart3 className="h-3.5 w-3.5" />نمایش گزارش</button>
        </div>
      </header>
      {expandedSprints[sprint.id] && <>{renderTaskTable(sprintTasks)}{sprintTasks.length === 0 && <div className="px-4 py-6 text-center text-xs text-muted-foreground">وظیفه‌ای در این اسپرینت وجود ندارد</div>}<button type="button" onClick={openCreateTask} className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-[10px] text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5" />افزودن وظیفه</button></>}
    </section>
  }

  return (
    <div className="w-full min-w-0 space-y-4 text-start" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-xl font-bold text-foreground">بک‌لاگ</h1><p className="mt-1 text-xs text-muted-foreground">{methodology.supportsSprints ? 'مدیریت وظایف و برنامه‌ریزی اسپرینت' : 'مدیریت و اولویت‌بندی کارهای آینده در جریان کانبان'}</p></div>
        <div className="flex items-center gap-2">
          {methodology.supportsSprints && <button type="button" onClick={openCreateSprint} disabled={!canCreateSprint} title={canCreateSprint ? undefined : sprintLoading ? sprintCopy.loading : sprintError ?? sprintCopy.createUnavailable} className="flex items-center gap-2 rounded-xl border border-border bg-surface-interactive px-4 py-2 text-xs text-foreground hover:border-primary/25 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />اسپرینت جدید</button>}
          <button type="button" onClick={openCreateTask} className="app-action"><Plus className="h-4 w-4" />وظیفه جدید</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-card/80 p-2 shadow-sm">
        <div className="relative min-w-[240px] flex-1 lg:max-w-sm"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="جستجو در بک‌لاگ..." className="w-full rounded-xl border border-border bg-surface-inset py-2 pe-3 ps-9 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/35" /></div>
        <button type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} className="flex items-center gap-2 rounded-xl border border-border bg-surface-interactive px-3 py-2 text-xs text-muted-foreground hover:text-foreground"><Filter className="h-3.5 w-3.5" />فیلتر</button>
        {showFilters && <>
          <button type="button" onClick={() => setMyTasksOnly(value => !value)} className={`rounded-xl border px-3 py-2 text-xs ${myTasksOnly ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-surface-interactive text-muted-foreground'}`}>وظایف من</button>
          <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className="rounded-xl border border-border bg-surface-interactive px-3 py-2 text-xs text-muted-foreground outline-none"><option value="all">اولویت</option>{Object.entries(priorityConfig).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select>
          <select value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} className="rounded-xl border border-border bg-surface-interactive px-3 py-2 text-xs text-muted-foreground outline-none"><option value="all">مسئول</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
        </>}
        <button type="button" onClick={() => setSortByRecent(value => !value)} aria-pressed={sortByRecent} className={`rounded-xl border px-3 py-2 text-xs ${sortByRecent ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-surface-interactive text-muted-foreground hover:text-foreground'}`}>اخیراً بروزرسانی</button>
      </div>

      {methodology.supportsSprints && [...activeSprints, ...plannedSprints].map(renderSprintPanel)}

      {(methodology.supportsSprints || kanbanPlanningEnabled) ? <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_32px_hsl(var(--depth-shadow)/0.16)]">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border/70 bg-surface-elevated/45 px-4">
          <button type="button" onClick={() => toggleSprint('backlog')} className="flex items-center gap-3"><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedSprints.backlog ? '' : '-rotate-90'}`} /><h2 className="text-sm font-bold text-foreground">بک‌لاگ</h2><span className="rounded-md bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{toPersianDigits(backlogTasks.length)} وظیفه</span></button>
          <button type="button" onClick={openCreateTask} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-interactive px-3 py-1.5 text-[10px] text-primary hover:border-primary/25"><Plus className="h-3.5 w-3.5" />افزودن وظیفه</button>
        </header>
        {expandedSprints.backlog && <>{backlogTasks.length ? renderTaskTable(backlogTasks) : <div className="px-4 py-6 text-center text-xs text-muted-foreground">بک‌لاگ خالی است</div>}</>}
      </section> : <section className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-5 py-8 text-center"><h2 className="text-sm font-bold text-foreground">ناحیه برنامه‌ریزی کانبان غیرفعال است</h2><p className="mt-2 text-xs text-muted-foreground">کارهای بدون اسپرینت مستقیماً در جریان برد کانبان قرار می‌گیرند.</p><button type="button" onClick={() => navigate(`${projectPath}/board`)} className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary hover:bg-primary/15">رفتن به برد کانبان</button></section>}

      {/* Create Sprint Modal */}
      {methodology.supportsSprints && showCreateSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-foreground mb-6">{editingSprint ? 'ویرایش اسپرینت' : 'اسپرینت جدید'}</h2>
            <form onSubmit={sprintForm.handleSubmit((values) => void submitSprint(values))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">نام اسپرینت</label>
                <input {...sprintForm.register('name')} disabled={!canCreateSprint} aria-invalid={!!sprintForm.formState.errors.name} type="text" placeholder="اسپرینت ۵" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
                {sprintForm.formState.errors.name && <p className="mt-1 text-xs text-red-500">{sprintForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">هدف</label>
                <textarea {...sprintForm.register('goal')} disabled={!canCreateSprint} placeholder="هدف اسپرینت..." rows={2} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none disabled:cursor-not-allowed disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">مدت</label>
                <div className="flex gap-2">
                  {fixedSprintDurations.map((duration) => (
                    <button type="button" disabled={!(editingSprint ? canUpdateSprint : canCreateSprint)} key={duration} onClick={() => selectSprintDuration(duration)} className={`flex-1 py-2 rounded-xl border text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectedSprintDuration === duration ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'}`}>{toPersianDigits(duration)} هفته</button>
                  ))}
                  <button type="button" disabled={!(editingSprint ? canUpdateSprint : canCreateSprint)} onClick={() => sprintForm.setValue('durationMode', 'custom', { shouldDirty: true })} className={`flex-1 py-2 rounded-xl border text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectedSprintDuration === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'}`}>سفارشی</button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">تاریخ شروع</label>
                  <Controller control={sprintForm.control} name="startDate" render={({ field }) => <JalaliDatePicker value={field.value || null} onChange={(value) => { field.onChange(value); changeSprintStartDate(value) }} disabled={!(editingSprint ? canUpdateSprint : canCreateSprint)} placeholder="انتخاب تاریخ شروع" />} />
                  {sprintForm.formState.errors.startDate && <p className="mt-1 text-xs text-red-500">{sprintForm.formState.errors.startDate.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">تاریخ پایان</label>
                  <Controller control={sprintForm.control} name="endDate" render={({ field }) => <JalaliDatePicker value={field.value || null} onChange={(value) => { field.onChange(value); changeSprintEndDate() }} disabled={!(editingSprint ? canUpdateSprint : canCreateSprint)} placeholder="انتخاب تاریخ پایان" />} />
                  {sprintForm.formState.errors.endDate && <p className="mt-1 text-xs text-red-500">{sprintForm.formState.errors.endDate.message}</p>}
                </div>
              </div>
              {sprintForm.formState.errors.root && <p className="text-xs text-red-500">{sprintForm.formState.errors.root.message}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateSprint(false); setEditingSprint(null) }} className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-secondary transition-all text-sm">انصراف</button>
                <button type="submit" disabled={!(editingSprint ? canUpdateSprint : canCreateSprint)} title={(editingSprint ? canUpdateSprint : canCreateSprint) ? undefined : sprintLoading ? sprintCopy.loading : sprintError ?? sprintCopy.createUnavailable} className="app-action flex-1 disabled:cursor-not-allowed disabled:opacity-50">{editingSprint ? 'ذخیره تغییرات' : 'ساخت اسپرینت'}</button>
              </div>
              {!(editingSprint ? canUpdateSprint : canCreateSprint) && <p className="text-xs text-muted-foreground">{sprintLoading ? sprintCopy.loading : sprintError ?? sprintCopy.createUnavailable}</p>}
            </form>
          </div>
        </div>
      )}

      {methodology.supportsSprints && completingSprint && (() => {
        const sprintTasks = getSprintTasks(completingSprint.id)
        const completed = sprintTasks.filter(isProjectTaskCompleted).length
        const unfinished = sprintTasks.length - completed
        const eligibleFutureSprints = plannedSprints.filter((sprint) => sprint.id !== completingSprint.id)
        return (
          <div role="dialog" aria-modal="true" aria-labelledby="complete-sprint-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" dir="rtl">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-right shadow-xl">
              <h2 id="complete-sprint-title" className="text-lg font-bold text-foreground">تکمیل اسپرینت</h2>
              <p className="mt-2 text-sm text-muted-foreground">اسپرینت «{completingSprint.name}» بسته می‌شود.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3"><span className="block text-[11px] text-muted-foreground">وظایف تکمیل‌شده</span><strong className="mt-1 block text-lg text-emerald-600">{toPersianDigits(completed)}</strong></div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"><span className="block text-[11px] text-muted-foreground">وظایف ناتمام</span><strong className="mt-1 block text-lg text-amber-600">{toPersianDigits(unfinished)}</strong></div>
              </div>
              {unfinished > 0 && <fieldset className="mt-5"><legend className="text-sm font-semibold text-foreground">مقصد وظایف ناتمام</legend><p className="mt-1 text-xs text-muted-foreground">وظایف تکمیل‌شده در همین اسپرینت باقی می‌مانند.</p><div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-interactive p-3 text-sm text-foreground"><input type="radio" name="sprint-completion-destination" checked={completionDestination.kind === 'backlog'} onChange={() => setCompletionDestination({ kind: 'backlog' })} disabled={completionPending} />بک‌لاگ</label>
                {eligibleFutureSprints.map((sprint) => <label key={sprint.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-interactive p-3 text-sm text-foreground"><input type="radio" name="sprint-completion-destination" checked={completionDestination.kind === 'future-sprint' && completionDestination.sprintId === sprint.id} onChange={() => setCompletionDestination({ kind: 'future-sprint', sprintId: sprint.id })} disabled={completionPending} />{sprint.name}</label>)}
              </div></fieldset>}
              {unfinished === 0 && <p className="mt-5 rounded-xl border border-border bg-surface-interactive p-3 text-xs text-muted-foreground">همهٔ وظایف تکمیل شده‌اند؛ این اسپرینت بدون انتقال وظیفه بسته می‌شود.</p>}
              {completionError && <p role="alert" className="mt-4 text-xs text-red-500">{completionError}</p>}
              <div className="mt-6 flex gap-3"><button type="button" onClick={closeCompleteSprint} disabled={completionPending} className="flex-1 rounded-xl border border-border py-2.5 text-sm text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">انصراف</button><button type="button" onClick={() => void submitSprintCompletion()} disabled={!canCompleteSprint || completionPending} className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">{completionPending ? 'در حال تکمیل…' : 'تکمیل اسپرینت'}</button></div>
            </div>
          </div>
        )
      })()}

      <CreateTaskDialog open={showCreateTask} onOpenChange={setShowCreateTask} />
    </div>
  )
}
