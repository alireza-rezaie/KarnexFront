import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarDays, Check, ExternalLink, Filter, LayoutGrid, List, MoreHorizontal, Palette, Pin,
  Plus, Search, Tag, Timer, Trash2, Users, X,
} from 'lucide-react'
import { priorityConfig, typeConfig } from '@/config/taskMetadata'
import type { Task } from '@/types/task'
import type { WorkflowTransition } from '@/types/workflow'
import { resolveTaskBoardColumn, type BoardColumn as BoardColumnMapping } from '@/types/board'
import { getProjectMethodologyCapabilities, selectBoardWork } from '@/utils/projectMethodology'
import { toPersianDigits } from '@/lib/persian-numbers'
import { formatEstimatedSeconds } from '@/utils/formatEstimate'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectStatus } from '@/contexts/ProjectStatusContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useSprints } from '@/contexts/SprintsContext'
import { useMembers } from '@/contexts/MembersContext'
import { useAuth } from '@/contexts/AuthContext'
import { useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { useProjectBoard } from '@/contexts/ProjectBoardContext'
import { useOptionalTerminalStatusPolicy } from '@/contexts/TerminalStatusPolicyContext'
import { useProjects } from '@/contexts/ProjectsContext'
import { useTaskTransitions } from '@/contexts/TaskTransitionContext'
import { ApprovalPendingIcon } from '@/components/approvals/ApprovalRequestUI'
import { UserAvatar } from '@/components/UserAvatar'
import { canStartBoardTaskTransition, executeBoardTransitionById, getBoardStatusTargets, resolveBoardStatusTarget } from '@/utils/boardTransition'
import { toast } from 'sonner'

type BoardColumn = BoardColumnMapping & { color: string; pinned: boolean; custom: boolean }

type FilterKey = 'labels' | 'priorities' | 'assignees'
type ViewMode = 'board' | 'list'
type ColumnDialog =
  | { type: 'rename'; column: BoardColumn; value: string; error?: string }
  | { type: 'color'; column: BoardColumn }
  | { type: 'wip'; column: BoardColumn; value: string; error?: string }
  | { type: 'delete'; column: BoardColumn; destinationId: string; error?: string }
  | null
type TransitionChooser = { taskId: string; destinationStatusId: string; transitions: WorkflowTransition[] } | null

const resolveBoardColumns = (columns: BoardColumnMapping[], statuses: ReturnType<typeof useProjectStatus>['statuses']): BoardColumn[] => columns.map((column) => {
  const mappedStatus = statuses.find((status) => status.id === column.statusIds[0])
  return {
    ...column,
    color: column.color ?? mappedStatus?.color ?? '#6b7280',
    pinned: Boolean(column.pinned),
    custom: Boolean(column.custom),
  }
})

const COLUMN_COLORS = [
  { name: 'آبی', value: '#3b82f6' },
  { name: 'سبز', value: '#22c55e' },
  { name: 'نارنجی', value: '#f59e0b' },
  { name: 'بنفش', value: '#a855f7' },
  { name: 'قرمز', value: '#ef4444' },
  { name: 'خنثی', value: '#6b7280' },
]

const normalize = (value: string) => value.trim().toLocaleLowerCase('fa')
export default function BoardPage() {
  const navigate = useNavigate()
  const { currentProject, projectId } = useProject()
  const { statuses } = useProjectStatus()
  const { tasks } = useProjectTasks()
  const { sprints } = useSprints()
  const { members } = useMembers()
  const { currentUserId } = useAuth()
  const { createRequest, requests } = useApprovalRequests()
  const { getBoardConfiguration, resolveColumns, updateBoardConfiguration, setKanbanBacklogEnabled, canManageBoardMapping } = useProjectBoard()
  const { accessCapabilities, canManageProjectAccess } = useProjects()
  const { getTaskTransitions, transitionTask } = useTaskTransitions()
  const projectPath = `/projects/${currentProject?.id ?? ''}`
  const methodology = getProjectMethodologyCapabilities(currentProject?.type)
  const canManageMapping = Boolean(projectId && accessCapabilities.canManageProjectAccess && canManageProjectAccess(projectId) && canManageBoardMapping(projectId))
  const boardConfiguration = useMemo(() => getBoardConfiguration(projectId ?? '', statuses), [getBoardConfiguration, projectId, statuses])
  const kanbanBacklogEnabled = methodology.boardWorkSelectionMode === 'continuous-flow' && boardConfiguration.kanbanBacklogEnabled
  const activeSprint = sprints.find(sprint => sprint.projectId === currentProject?.id && sprint.status === 'active')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [pendingTransitionTaskIds, setPendingTransitionTaskIds] = useState<string[]>([])
  const [transitionChooser, setTransitionChooser] = useState<TransitionChooser>(null)
  const boardTasks = useMemo(
    () => selectBoardWork(
      methodology.boardWorkSelectionMode,
      tasks,
      activeSprint?.id,
      kanbanBacklogEnabled,
    ),
    [activeSprint, kanbanBacklogEnabled, methodology.boardWorkSelectionMode, tasks],
  )
  const [openFilter, setOpenFilter] = useState<'all' | FilterKey | null>(null)
  const [filters, setFilters] = useState<Record<FilterKey, string[]>>({ labels: [], priorities: [], assignees: [] })
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [columnColor, setColumnColor] = useState(COLUMN_COLORS[0].value)
  const [columnError, setColumnError] = useState('')
  const [columnMenu, setColumnMenu] = useState<string | null>(null)
  const [columnDialog, setColumnDialog] = useState<ColumnDialog>(null)
  const columns = useMemo(() => {
    const configuredColumns = resolveBoardColumns(resolveColumns(projectId ?? '', statuses), statuses)
    const mappedStatusIds = new Set(configuredColumns.flatMap((column) => column.statusIds))
    // A customized board can outlive its workflow mapping. Keep every active
    // workflow status visible by deriving a recovery column for unmapped statuses.
    const recoveryColumns: BoardColumn[] = statuses
      .filter((status) => !mappedStatusIds.has(status.id))
      .map((status, index) => ({
        id: `board-column-recovered-${status.id}`,
        name: status.name,
        color: status.color,
        order: configuredColumns.length + index,
        statusIds: [status.id],
        pinned: false,
        custom: false,
      }))
    return [...configuredColumns, ...recoveryColumns]
  }, [projectId, resolveColumns, statuses])
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy()

  const orderedColumns = useMemo(() => [...columns].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order), [columns])
  const unmappedTasks = useMemo(() => boardTasks.filter((task) => !resolveTaskBoardColumn(columns, task.status)), [boardTasks, columns])
  // Completion is defined by the final mapped Board column of the active workflow.
  const terminalStatusIds = useMemo(
    () => new Set(terminalStatusPolicy?.getTerminalStatusIds(projectId ?? '') ?? []),
    [projectId, terminalStatusPolicy],
  )
  const completedCount = boardTasks.filter((task) => terminalStatusIds.has(task.status)).length
  const progress = boardTasks.length ? Math.round((completedCount / boardTasks.length) * 100) : 0
  const activeFilterCount = filters.labels.length + filters.priorities.length + filters.assignees.length + (search.trim() ? 1 : 0)
  const labelOptions = useMemo(() => [...new Set(boardTasks.flatMap(task => task.labels))].sort((a, b) => a.localeCompare(b, 'fa')), [boardTasks])
  const priorityOptions = Object.entries(priorityConfig).map(([value, config]) => ({ value, label: config.label }))
  const assigneeOptions = members.filter(member => boardTasks.some(task => task.assignee === member.id)).map(member => ({ value: member.id, label: member.name }))
  const matchesFilters = (task: Task) => {
    const assignee = members.find(member => member.id === task.assignee)
    const haystack = `${task.title} ${task.key} ${task.labels.join(' ')} ${assignee?.name ?? ''}`.toLocaleLowerCase('fa')
    const searchMatch = !search.trim() || haystack.includes(normalize(search))
    const labelMatch = !filters.labels.length || task.labels.some(label => filters.labels.includes(label))
    const priorityMatch = !filters.priorities.length || filters.priorities.includes(task.priority)
    const assigneeMatch = !filters.assignees.length || filters.assignees.includes(task.assignee)
    return searchMatch && labelMatch && priorityMatch && assigneeMatch
  }
  const listTasks = boardTasks.filter(matchesFilters)

  const getAllColumnTasks = (column: BoardColumn) => boardTasks.filter(task => {
    return resolveTaskBoardColumn(columns, task.status)?.id === column.id
  })

  const getColumnTasks = (column: BoardColumn) => getAllColumnTasks(column).filter(matchesFilters)

  const setColumnPatch = (columnId: string, patch: Partial<BoardColumn>) => {
    if (!projectId) return
    void updateBoardConfiguration(projectId, columns.map(
      column => column.id === columnId ? { ...column, ...patch } : column,
    ), statuses)
  }

  const setColumnStatus = async (column: BoardColumn, statusId: string) => {
    if (!projectId || !canManageMapping) return
    if (statusId && columns.some((candidate) => candidate.id !== column.id && candidate.statusIds.includes(statusId))) {
      toast.error('این وضعیت هم‌اکنون به ستون دیگری نگاشت شده است.')
      return
    }
    const result = await updateBoardConfiguration(
      projectId,
      columns.map((candidate) => candidate.id === column.id ? { ...candidate, statusIds: statusId ? [statusId] : [] } : candidate),
      statuses,
    )
    if (!result.ok) toast.error(result.message)
  }

  const toggleFilterValue = (key: FilterKey, value: string) => {
    setFilters(current => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value],
    }))
  }

  const removeFilterValue = (key: FilterKey, value: string) => {
    setFilters(current => ({ ...current, [key]: current[key].filter(item => item !== value) }))
  }

  const clearFilters = () => {
    setSearch('')
    setFilters({ labels: [], priorities: [], assignees: [] })
  }

  const handleDragStart = (event: React.DragEvent, taskId: string) => {
    if (!canStartBoardTaskTransition(pendingTransitionTaskIds, taskId)) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('taskId', taskId)
    setDraggingTaskId(taskId)
  }

  const handleDragEnd = () => {
    setDraggingTaskId(null)
    setDragOverColumn(null)
  }

  const reportTransitionFailure = async (task: Task, result: Awaited<ReturnType<typeof transitionTask>>) => {
    if (result.ok) return
    if (result.code === 'approval-required' && result.transition) {
      const creation = await createRequest({ projectId: task.projectId, task, transition: result.transition, requesterId: currentUserId ?? undefined })
      if (creation.ok && creation.reason === 'approval-request-created') toast.info('درخواست تأیید این انتقال ثبت شد.')
      else if (creation.reason === 'approval-already-pending') toast.info('برای این وظیفه یک درخواست تأیید در انتظار بررسی است.')
      else toast.error(creation.message ?? 'امکان ثبت درخواست تأیید وجود ندارد.')
      return
    }
    const fallback = result.code === 'condition-failed' ? 'شرایط لازم برای این انتقال برقرار نیست.'
      : result.code === 'validation-failed' ? result.validationErrors?.join(' ') || 'اطلاعات وظیفه برای این انتقال معتبر نیست.'
        : 'انتقال وظیفه انجام نشد.'
    toast.error(result.message ?? fallback)
  }

  const executeTransition = async (task: Task, transitionId: string) => {
    if (!projectId || !canStartBoardTaskTransition(pendingTransitionTaskIds, task.id)) return false
    setPendingTransitionTaskIds((current) => [...current, task.id])
    try {
      const result = await executeBoardTransitionById({ projectId, taskId: task.id, transitionId, transitionTask })
      if (!result.ok) await reportTransitionFailure(task, result)
      return result.ok
    } finally {
      setPendingTransitionTaskIds((current) => current.filter((id) => id !== task.id))
    }
  }

  const dropToStatus = async (task: Task, destinationStatusId: string) => {
    if (!projectId) return
    const resolution = getTaskTransitions({ projectId, taskId: task.id })
    if (!resolution.ok) return toast.error(resolution.message ?? 'امکان تعیین انتقال وجود ندارد.')
    const target = resolveBoardStatusTarget(task.status, destinationStatusId, resolution.transitions)
    if (target.kind === 'same-status-noop') return
    if (target.kind === 'no-matching-transition') return toast.error('این انتقال در گردش‌کار پروژه مجاز نیست.')
    if (target.kind === 'multiple-matching-transitions') {
      const candidates = resolution.transitions.filter((transition) => target.transitionIds.includes(transition.id))
      setTransitionChooser({ taskId: task.id, destinationStatusId, transitions: candidates })
      return
    }
    await executeTransition(task, target.transitionId)
  }

  const handleDrop = async (event: React.DragEvent, column: BoardColumn) => {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('taskId')
    const task = boardTasks.find((item) => item.id === taskId)
    if (!task) return setDragOverColumn(null)

    if (column.statusIds.length !== 1) {
      toast.error('انتخاب وضعیت مقصد لازم است.')
    } else await dropToStatus(task, column.statusIds[0]!)
    setDragOverColumn(null)
  }

  const handleStatusDrop = async (event: React.DragEvent, column: BoardColumn, destinationStatusId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const taskId = event.dataTransfer.getData('taskId')
    const task = boardTasks.find((item) => item.id === taskId)
    if (task) await dropToStatus(task, destinationStatusId)
    setDragOverColumn(null)
  }

  const getStatusTargets = (column: BoardColumn) => {
    const task = draggingTaskId ? boardTasks.find((candidate) => candidate.id === draggingTaskId) : undefined
    if (!task || !projectId) return []
    const resolution = getTaskTransitions({ projectId, taskId: task.id })
    return getBoardStatusTargets(task.status, column.statusIds, resolution.ok ? resolution.transitions : []).map((target) => ({
      status: statuses.find((status) => status.id === target.statusId),
      ...target,
    }))
  }

  const addColumn = () => {
    const name = columnName.trim()
    if (!name) return setColumnError('نام ستون را وارد کنید')
    if (columns.some(column => normalize(column.name) === normalize(name))) return setColumnError('ستونی با این نام وجود دارد')
    const maxOrder = columns.reduce((max, column) => Math.max(max, column.order), -1)
    if (projectId && canManageMapping) void updateBoardConfiguration(projectId, [...columns, { id: `custom-${crypto.randomUUID()}`, name, color: columnColor, order: maxOrder + 1, pinned: false, custom: true, statusIds: [] }], statuses)
    setColumnName('')
    setColumnError('')
    setColumnColor(COLUMN_COLORS[0].value)
    setShowAddColumn(false)
  }

  const saveRename = () => {
    if (columnDialog?.type !== 'rename') return
    const name = columnDialog.value.trim()
    if (!name) return setColumnDialog({ ...columnDialog, error: 'نام ستون نمی‌تواند خالی باشد' })
    if (columns.some(column => column.id !== columnDialog.column.id && normalize(column.name) === normalize(name))) {
      return setColumnDialog({ ...columnDialog, error: 'ستونی با این نام وجود دارد' })
    }
    setColumnPatch(columnDialog.column.id, { name })
    setColumnDialog(null)
  }

  const saveWipLimit = () => {
    if (columnDialog?.type !== 'wip') return
    const rawValue = columnDialog.value.trim()
    if (!rawValue) {
      setColumnPatch(columnDialog.column.id, { wipLimit: undefined })
      setColumnDialog(null)
      return
    }
    const limit = Number(rawValue)
    if (!Number.isSafeInteger(limit) || limit < 1) return setColumnDialog({ ...columnDialog, error: 'سقف WIP باید یک عدد صحیح مثبت باشد.' })
    setColumnPatch(columnDialog.column.id, { wipLimit: limit })
    setColumnDialog(null)
  }

  const deleteColumn = () => {
    if (columnDialog?.type !== 'delete') return
    const columnTasks = getAllColumnTasks(columnDialog.column)
    if (columns.length <= 1) return setColumnDialog({ ...columnDialog, error: 'حذف آخرین ستون مجاز نیست' })
    if (columnTasks.length && !columnDialog.destinationId) return setColumnDialog({ ...columnDialog, error: 'ستون مقصد را انتخاب کنید' })
    if (columnTasks.length) {
      const destination = columns.find(column => column.id === columnDialog.destinationId)
      if (!destination || destination.id === columnDialog.column.id) return setColumnDialog({ ...columnDialog, error: 'ستون مقصد معتبر نیست' })
      const mergedStatusIds = [...new Set([...destination.statusIds, ...columnDialog.column.statusIds])]
      const nextColumns = columns
        .filter((column) => column.id !== columnDialog.column.id)
        .map((column, index) => column.id === destination.id ? { ...column, statusIds: mergedStatusIds, order: index } : { ...column, order: index })
      if (projectId) void updateBoardConfiguration(projectId, nextColumns, statuses)
      setColumnDialog(null)
      return
    }
    if (projectId) void updateBoardConfiguration(projectId, columns.filter(column => column.id !== columnDialog.column.id).map((column, index) => ({ ...column, order: index })), statuses)
    setColumnDialog(null)
  }

  const renderMultiSelect = (key: FilterKey, title: string, options: { value: string; label: string }[]) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-foreground">{title}</span>
        {!!filters[key].length && <button type="button" onClick={() => setFilters(current => ({ ...current, [key]: [] }))} className="text-[10px] text-primary hover:underline">پاک‌کردن</button>}
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {options.map(option => {
          const selected = filters[key].includes(option.value)
          return <button
            key={option.value}
            type="button"
            onClick={() => toggleFilterValue(key, option.value)}
            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-start text-[10px] outline-none hover:bg-secondary focus:ring-2 focus:ring-primary/35 ${selected ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
            aria-pressed={selected}
          >
            <span>{option.label}</span>
            {selected && <Check className="h-3.5 w-3.5" />}
          </button>
        })}
      </div>
    </div>
  )

  const renderFilterPopover = (key: 'all' | FilterKey) => {
    const content = key === 'all'
      ? <div className="space-y-4">
          <label className="block text-[10px] font-semibold text-foreground">جستجو<input value={search} onChange={event => setSearch(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface-inset px-2.5 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/35" /></label>
          {renderMultiSelect('labels', 'برچسب', labelOptions.map(label => ({ value: label, label })))}
          {renderMultiSelect('priorities', 'اولویت', priorityOptions)}
          {renderMultiSelect('assignees', 'مسئول', assigneeOptions)}
          {!!activeFilterCount && <button type="button" onClick={clearFilters} className="w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/15">پاک‌کردن همه</button>}
        </div>
      : renderMultiSelect(key, key === 'labels' ? 'برچسب' : key === 'priorities' ? 'اولویت' : 'مسئول', key === 'labels' ? labelOptions.map(label => ({ value: label, label })) : key === 'priorities' ? priorityOptions : assigneeOptions)
    return <div className="absolute start-0 top-11 z-40 w-64 rounded-xl border border-border bg-popover p-3 shadow-2xl" role="dialog" onKeyDown={event => { if (event.key === 'Escape') setOpenFilter(null) }}>{content}</div>
  }

  const renderTaskCard = (task: Task, color: string) => {
    const assignee = members.find(member => member.id === task.assignee)
    const priority = priorityConfig[task.priority]
    const type = typeConfig[task.type]
    const scheduledTime = formatEstimatedSeconds(task.estimatedSeconds)
    const pendingApproval = requests.some((request) => request.projectId === task.projectId && request.taskId === task.id && request.status === 'pending')
    const transitionPending = !canStartBoardTaskTransition(pendingTransitionTaskIds, task.id)
    return <article key={task.id} draggable={!transitionPending} onDragStart={event => handleDragStart(event, task.id)} onDragEnd={handleDragEnd} onClick={() => navigate(`${projectPath}/tasks/${task.id}`)} className={`group rounded-xl border border-border/70 bg-[linear-gradient(145deg,hsl(var(--surface-raised)/0.96),hsl(var(--surface-interactive)/0.88))] p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_10px_24px_hsl(var(--depth-shadow)/0.22)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_14px_28px_hsl(var(--depth-shadow)/0.3)] active:scale-[0.99] ${transitionPending ? 'cursor-wait opacity-75' : 'cursor-grab active:cursor-grabbing'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="line-clamp-2 text-xs font-semibold leading-5 text-foreground">{task.title}</h3><span className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">{toPersianDigits(task.key)}<ExternalLink className="h-3 w-3 text-primary" /></span></div>
      </div>
      {pendingApproval && <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`${projectPath}/approvals`) }} className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-medium text-amber-500 hover:bg-amber-500/15"><ApprovalPendingIcon />در انتظار تأیید</button>}
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden"><span className="h-6 shrink-0 rounded-md px-2 text-[9px] leading-6" style={{ backgroundColor: priority.bgColor, color: priority.color }}>{priority.label}</span><span className="h-6 shrink-0 rounded-md px-2 text-[9px] leading-6" style={{ backgroundColor: type.bgColor, color: type.color }}>{type.label}</span>{task.labels.slice(0, 2).map(label => <span key={label} className="h-6 shrink-0 rounded-md border border-border/50 bg-secondary/75 px-2 text-[9px] leading-6 text-muted-foreground">{label}</span>)}{task.labels.length > 2 && <span className="shrink-0 text-[9px] text-muted-foreground">+{toPersianDigits(task.labels.length - 2)}</span>}</div>
        <span className="h-6 shrink-0 rounded-full bg-secondary px-2 text-[9px] leading-6 text-foreground">SP {toPersianDigits(task.storyPoints ?? 0)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-muted-foreground"><span className="flex min-w-0 items-center gap-1.5">{assignee && <UserAvatar avatarId={assignee.avatarId} name={assignee.name} className="h-6 w-6 border border-border shadow-sm" />}<span className="truncate">{assignee?.name || 'بدون مسئول'}</span></span><span className="flex shrink-0 items-center gap-1 whitespace-nowrap"><Timer className="h-3.5 w-3.5" />زمان تعیین‌شده: {scheduledTime}</span></div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${task.subtasks ? (task.completedSubtasks / task.subtasks) * 100 : 0}%`, backgroundColor: color }} /></div>
    </article>
  }

  const renderListTask = (task: Task) => {
    const assignee = members.find(member => member.id === task.assignee)
    const status = statuses.find(item => item.id === task.status) ?? { name: 'بدون وضعیت', color: '#6b7280' }
    const priority = priorityConfig[task.priority]
    const type = typeConfig[task.type]
    const scheduledTime = formatEstimatedSeconds(task.estimatedSeconds)

    return <button key={task.id} type="button" onClick={() => navigate(`${projectPath}/tasks/${task.id}`)} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-surface-interactive p-3 text-start shadow-sm transition hover:-translate-y-px hover:border-primary/30 hover:bg-accent/50">
      <span className="rounded-lg bg-background/60 px-2 py-1 text-[10px] font-semibold text-primary">{toPersianDigits(task.key)}</span>
      <div className="min-w-[180px] flex-1"><h3 className="truncate text-xs font-semibold text-foreground">{task.title}</h3><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="rounded-md px-2 py-1 text-[9px]" style={{ backgroundColor: type.bgColor, color: type.color }}>{type.label}</span><span className="rounded-md px-2 py-1 text-[9px]" style={{ backgroundColor: priority.bgColor, color: priority.color }}>{priority.label}</span></div></div>
      <span className="rounded-full px-2 py-1 text-[10px]" style={{ backgroundColor: `${status.color}26`, color: status.color }}>{status.name}</span>
      <span className="flex min-w-[110px] items-center gap-2 text-[10px] text-muted-foreground">{assignee && <UserAvatar avatarId={assignee.avatarId} name={assignee.name} className="h-6 w-6 border border-border" />}<span className="truncate">{assignee?.name ?? 'بدون مسئول'}</span></span>
      <span className="whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-[10px] text-foreground">SP {toPersianDigits(task.storyPoints ?? 0)}</span>
      <span className="flex whitespace-nowrap items-center gap-1 text-[10px] text-muted-foreground"><Timer className="h-3.5 w-3.5" />{scheduledTime}</span>
      <ExternalLink className="h-3.5 w-3.5 text-primary" />
    </button>
  }

  return <div dir="rtl" className="flex min-h-[calc(100dvh-6rem)] min-w-0 flex-col overflow-hidden bg-[linear-gradient(180deg,hsl(var(--primary)/0.025),transparent_18rem)] text-start">
    {openFilter && <div className="fixed inset-0 z-30" onMouseDown={() => setOpenFilter(null)} />}
    <header className="flex flex-none flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><h1 className="text-xl font-bold text-foreground">{methodology.boardWorkSelectionMode === 'active-sprint' ? activeSprint?.name || 'اسپرینت فعال' : 'برد کانبان'}</h1><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-500">فعال</span></div><p className="mt-1 text-xs text-muted-foreground">{methodology.boardWorkSelectionMode === 'active-sprint' ? 'تکمیل وظایف و مدیریت اجرای اسپرینت' : 'مدیریت جریان پیوستهٔ وظایف پروژه'}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {methodology.boardWorkSelectionMode === 'continuous-flow' ? <button type="button" onClick={() => projectId && void setKanbanBacklogEnabled(projectId, !kanbanBacklogEnabled, statuses)} aria-pressed={kanbanBacklogEnabled} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary shadow-[0_6px_20px_hsl(var(--primary)/0.1)] hover:bg-primary/15"><Plus className="h-4 w-4" />{kanbanBacklogEnabled ? 'غیرفعال‌سازی ناحیه برنامه‌ریزی' : 'فعال‌سازی ناحیه برنامه‌ریزی'}</button> : <button type="button" onClick={() => navigate(`${projectPath}/backlog`)} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary shadow-[0_6px_20px_hsl(var(--primary)/0.1)] hover:bg-primary/15"><Plus className="h-4 w-4" />افزودن از بک‌لاگ</button>}
        <button type="button" onClick={() => setShowAddColumn(true)} className="flex items-center gap-2 rounded-xl border border-border bg-surface-interactive px-4 py-2 text-xs text-foreground hover:border-primary/25"><Plus className="h-4 w-4 text-primary" />افزودن ستون</button>
      </div>
    </header>

    <div className="mt-4 flex flex-none flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-stretch gap-2 rounded-2xl border border-border/70 bg-card/65 p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.025),0_8px_24px_hsl(var(--depth-shadow)/0.12)]">
        {methodology.boardWorkSelectionMode === 'active-sprint' && <div className="flex items-center gap-2 rounded-xl bg-surface-interactive px-3 py-2 text-[10px] text-muted-foreground"><CalendarDays className="h-4 w-4" />{toPersianDigits(activeSprint?.startDate || '')} تا {toPersianDigits(activeSprint?.endDate || '')}</div>}
        <div className="flex min-w-[180px] items-center gap-2 rounded-xl bg-surface-interactive px-3 py-2"><span className="text-[10px] text-muted-foreground">پیشرفت کلی</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div><span className="text-[10px] font-semibold text-foreground">{toPersianDigits(progress)}٪</span></div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/60 rounded-xl bg-surface-interactive text-center text-[9px] text-muted-foreground"><span className="px-3 py-1.5">کل وظایف<b className="mt-0.5 block text-xs text-foreground">{toPersianDigits(boardTasks.length)}</b></span><span className="px-3 py-1.5">تکمیل‌شده<b className="mt-0.5 block text-xs text-emerald-500">{toPersianDigits(completedCount)}</b></span><span className="px-3 py-1.5">باقی‌مانده<b className="mt-0.5 block text-xs text-foreground">{toPersianDigits(boardTasks.length - completedCount)}</b></span></div>
      </div>
      <div className="flex rounded-xl border border-border bg-surface-inset p-1"><button type="button" onClick={() => setViewMode('board')} aria-pressed={viewMode === 'board'} className={`rounded-lg p-2 ${viewMode === 'board' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'}`} aria-label="نمای برد"><LayoutGrid className="h-4 w-4" /></button><button type="button" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'}`} aria-label="نمای فهرست"><List className="h-4 w-4" /></button></div>
    </div>

    <div className="mt-4 flex flex-none flex-wrap items-center gap-2">
      <div className="relative min-w-[230px] flex-1 sm:max-w-sm"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="جستجوی وظایف..." aria-label="جستجوی وظایف" className="w-full rounded-xl border border-border bg-surface-inset py-2.5 pe-3 ps-9 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/35" /></div>
      {([
        ['all', 'فیلتر', <Filter className="h-3.5 w-3.5" />],
        ['labels', 'برچسب', <Tag className="h-3.5 w-3.5" />],
        ['priorities', 'اولویت', null],
        ['assignees', 'مسئول', <Users className="h-3.5 w-3.5" />],
      ] as const).map(([key, label, icon]) => <div key={key} className="relative" onMouseDown={event => event.stopPropagation()}>
        <button type="button" onClick={() => setOpenFilter(openFilter === key ? null : key)} aria-expanded={openFilter === key} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${openFilter === key || (key === 'all' && activeFilterCount) ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-surface-interactive text-muted-foreground'}`}>{icon}{label}{key === 'all' && activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground">{toPersianDigits(activeFilterCount)}</span>}</button>
        {openFilter === key && renderFilterPopover(key)}
      </div>)}
      {!!activeFilterCount && <button type="button" onClick={clearFilters} className="rounded-xl border border-border bg-surface-interactive px-3 py-2.5 text-xs text-primary hover:border-primary/25">پاک‌کردن همه</button>}
    </div>

    {!!activeFilterCount && <div className="mt-3 flex flex-wrap gap-1.5">
      {search.trim() && <button type="button" onClick={() => setSearch('')} className="flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[10px] text-foreground">جستجو: {search}<X className="h-3 w-3" /></button>}
      {filters.labels.map(value => <button key={value} type="button" onClick={() => removeFilterValue('labels', value)} className="flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[10px] text-foreground">{value}<X className="h-3 w-3" /></button>)}
      {filters.priorities.map(value => <button key={value} type="button" onClick={() => removeFilterValue('priorities', value)} className="flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[10px] text-foreground">{priorityConfig[value as Task['priority']].label}<X className="h-3 w-3" /></button>)}
      {filters.assignees.map(value => <button key={value} type="button" onClick={() => removeFilterValue('assignees', value)} className="flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[10px] text-foreground">{members.find(member => member.id === value)?.name}<X className="h-3 w-3" /></button>)}
    </div>}

    {unmappedTasks.length > 0 && <div role="status" className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-600 dark:text-amber-400">{toPersianDigits(unmappedTasks.length)} وظیفه دارای وضعیتی است که در هیچ ستون بردی نگاشت نشده است.</div>}
    {viewMode === 'board' ? <div className="mt-4 min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2 [scroll-snap-type:x_proximity]">
      <div className="grid h-full min-h-[590px] gap-3" style={{ gridTemplateColumns: `repeat(${orderedColumns.length}, minmax(260px, 1fr))`, minWidth: `${orderedColumns.length * 260 + (orderedColumns.length - 1) * 12}px` }}>
        {orderedColumns.map(column => {
          const columnTasks = getColumnTasks(column)
          const allColumnTasks = getAllColumnTasks(column)
          const isDragOver = dragOverColumn === column.id
          const wipLimitReached = methodology.supportsWipLimits && column.wipLimit !== undefined && allColumnTasks.length >= column.wipLimit
          const statusTargets = isDragOver && draggingTaskId && column.statusIds.length > 1 ? getStatusTargets(column) : []
          const isPresentationColumn = column.custom === true && column.statusIds.length === 0
          const mappedStatusNames = column.statusIds.map(statusId => statuses.find(status => status.id === statusId)?.name ?? statusId)
          const selectedColumnStatus = column.statusIds.length === 1 ? column.statusIds[0]! : ''
          return <section key={column.id} onDragOver={event => { event.preventDefault(); setDragOverColumn(column.id) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null) }} onDrop={event => void handleDrop(event, column)} className={`relative flex min-h-0 scroll-ms-3 snap-start flex-col overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,hsl(var(--surface-inset)/0.98),hsl(var(--card)/0.9))] p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.035),0_14px_34px_hsl(var(--depth-shadow)/0.2)] transition ${isDragOver ? 'bg-primary/5 ring-2 ring-primary/20' : ''}`} style={{ borderColor: `${column.color}80` }}>
            <header className="sticky top-0 z-10 flex h-[52px] flex-none items-center justify-between border-b border-border/55 bg-surface-inset/90 px-3.5 backdrop-blur-sm">
              <div className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: column.color, color: column.color }} />{column.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-label="سنجاق‌شده" />}<h2 className="truncate text-xs font-bold text-foreground">{column.name}</h2><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] ${wipLimitReached ? 'border-amber-500/50 bg-amber-500/15 text-amber-600' : 'border-border/60 bg-secondary text-muted-foreground'}`}>{toPersianDigits(columnTasks.length)}</span>{methodology.supportsWipLimits && column.wipLimit !== undefined && <span className={`shrink-0 text-[9px] font-semibold ${wipLimitReached ? 'text-amber-600' : 'text-muted-foreground'}`}>WIP {toPersianDigits(allColumnTasks.length)}/{toPersianDigits(column.wipLimit)}</span>}</div>
              <button type="button" onClick={() => setColumnMenu(columnMenu === column.id ? null : column.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`گزینه‌های ستون ${column.name}`}><MoreHorizontal className="h-3.5 w-3.5" /></button>
              {columnMenu === column.id && <div className="absolute end-0 top-10 z-20 w-40 rounded-xl border border-border bg-popover p-1.5 text-[10px] text-foreground shadow-xl">
                {isPresentationColumn && <><button onClick={() => { setColumnDialog({ type: 'rename', column, value: column.name }); setColumnMenu(null) }} className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-secondary">تغییر نام</button>
                <button onClick={() => { setColumnDialog({ type: 'color', column }); setColumnMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-secondary"><Palette className="h-3.5 w-3.5" />تغییر رنگ</button></>}
                {methodology.supportsWipLimits && <button onClick={() => { setColumnDialog({ type: 'wip', column, value: column.wipLimit?.toString() ?? '' }); setColumnMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-secondary"><AlertTriangle className="h-3.5 w-3.5" />تنظیم سقف WIP</button>}
                <button onClick={() => { setColumnPatch(column.id, { pinned: !column.pinned }); setColumnMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-secondary"><Pin className="h-3.5 w-3.5" />{column.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</button>
                {isPresentationColumn && <button onClick={() => { setColumnDialog({ type: 'delete', column, destinationId: '' }); setColumnMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />حذف ستون</button>}
              </div>}
            </header>
            <div className={`mx-2 mt-2 rounded-lg border px-2.5 py-2 text-[10px] ${column.statusIds.length ? 'border-border/70 bg-secondary/35 text-muted-foreground' : 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
              <div className="flex items-center justify-between gap-2"><span>وضعیت نگاشت‌شده: {mappedStatusNames.length ? mappedStatusNames.join('، ') : 'بدون نگاشت'}</span>{!column.statusIds.length && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}</div>
              {canManageMapping ? <label className="mt-1.5 block text-[9px]">تغییر نگاشت<select aria-label={`وضعیت ستون ${column.name}`} value={selectedColumnStatus} onChange={event => void setColumnStatus(column, event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-surface-inset px-2 py-1.5 text-[10px] text-foreground"><option value="">بدون نگاشت</option>{column.statusIds.length > 1 && <option value="" disabled>چند وضعیت نگاشت شده</option>}{statuses.map(status => <option key={status.id} value={status.id} disabled={column.id !== resolveTaskBoardColumn(columns, status.id)?.id}>{status.name}</option>)}</select></label> : <p className="mt-1.5 text-[9px]">فقط مدیر پروژه یا اسکرام‌مستر می‌تواند نگاشت را تغییر دهد.</p>}
            </div>
            {wipLimitReached && <div role="status" className="mx-2 mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />سقف WIP این ستون رسیده یا رد شده است؛ انتقال‌ها همچنان طبق گردش‌کار انجام می‌شوند.</div>}
            {statusTargets.length > 0 && <div className="mx-2 mt-2 grid gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-1.5" aria-label="وضعیت‌های مقصد">
              {statusTargets.map((target) => <div key={target.statusId} onDragOver={event => { event.preventDefault(); event.stopPropagation() }} onDrop={event => void handleStatusDrop(event, column, target.statusId)} aria-disabled={!target.reachable} className={`rounded-lg border px-2.5 py-2 text-[10px] ${target.reachable ? 'border-primary/35 bg-primary/10 text-primary' : 'cursor-not-allowed border-border/60 bg-secondary/35 text-muted-foreground opacity-60'}`}>
                <span className="flex items-center justify-between gap-2"><span>{target.status?.name ?? target.statusId}</span><span className="text-[9px]">{target.current ? 'وضعیت فعلی' : target.reachable ? 'انتقال مجاز' : 'ناموجود'}</span></span>
              </div>)}
            </div>}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-0.5 pb-2 overscroll-contain">{columnTasks.map(task => renderTaskCard(task, column.color))}{!columnTasks.length && <div className="grid h-16 place-items-center rounded-xl border border-dashed border-border/70 bg-background/10 px-3 text-center text-[10px] text-muted-foreground">{activeFilterCount && allColumnTasks.length ? 'وظیفه‌ای مطابق فیلترها نیست' : 'وظیفه‌ای در این مرحله نیست'}</div>}</div>
          </section>
        })}
      </div>
    </div> : <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/70 bg-card/65 p-3 shadow-[0_12px_32px_hsl(var(--depth-shadow)/0.14)]">
      {listTasks.length ? <div className="space-y-2">{listTasks.map(renderListTask)}</div> : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border/70 bg-surface-inset/50 px-4 text-center text-xs text-muted-foreground">{boardTasks.length ? 'وظیفه‌ای مطابق فیلترها نیست' : methodology.boardWorkSelectionMode === 'active-sprint' ? 'در اسپرینت فعال وظیفه‌ای وجود ندارد' : 'وظیفه‌ای در جریان کانبان وجود ندارد'}</div>}
    </div>}

    {showAddColumn && <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-sm" onMouseDown={() => setShowAddColumn(false)}><div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">افزودن ستون</h2><button onClick={() => setShowAddColumn(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="بستن"><X className="h-4 w-4" /></button></div><label className="mt-5 block text-xs text-muted-foreground">نام ستون<input autoFocus value={columnName} onChange={event => { setColumnName(event.target.value); setColumnError('') }} onKeyDown={event => { if (event.key === 'Enter') addColumn(); if (event.key === 'Escape') setShowAddColumn(false) }} className="mt-2 w-full rounded-xl border border-border bg-surface-inset px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/35" /></label>{columnError && <p className="mt-2 text-[10px] text-red-500">{columnError}</p>}<div className="mt-4"><span className="text-xs text-muted-foreground">رنگ ستون</span><div className="mt-2 flex gap-2">{COLUMN_COLORS.map(color => <button key={color.value} onClick={() => setColumnColor(color.value)} className={`h-7 w-7 rounded-full border-2 ${columnColor === color.value ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: color.value }} aria-label={`رنگ ${color.name}`} />)}</div></div><div className="mt-6 flex gap-2"><button onClick={addColumn} className="flex-1 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-xs font-medium text-primary hover:bg-primary/15">افزودن</button><button onClick={() => setShowAddColumn(false)} className="flex-1 rounded-xl border border-border py-2.5 text-xs text-muted-foreground hover:bg-secondary">انصراف</button></div></div></div>}

    {columnDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-sm" onMouseDown={() => setColumnDialog(null)}><div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setColumnDialog(null) }}>
      {columnDialog.type === 'rename' && <><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">تغییر نام</h2><button onClick={() => setColumnDialog(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="بستن"><X className="h-4 w-4" /></button></div><label className="mt-5 block text-xs text-muted-foreground">نام ستون<input autoFocus value={columnDialog.value} onChange={event => setColumnDialog({ ...columnDialog, value: event.target.value, error: undefined })} onKeyDown={event => { if (event.key === 'Enter') saveRename() }} className="mt-2 w-full rounded-xl border border-border bg-surface-inset px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/35" /></label>{columnDialog.error && <p className="mt-2 text-[10px] text-red-500">{columnDialog.error}</p>}<div className="mt-5 flex gap-2"><button onClick={saveRename} className="flex-1 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-xs font-medium text-primary hover:bg-primary/15">ذخیره</button><button onClick={() => setColumnDialog(null)} className="flex-1 rounded-xl border border-border py-2.5 text-xs text-muted-foreground hover:bg-secondary">انصراف</button></div></>}
      {columnDialog.type === 'color' && <><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">تغییر رنگ</h2><button onClick={() => setColumnDialog(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="بستن"><X className="h-4 w-4" /></button></div><div className="mt-5 grid grid-cols-3 gap-2">{COLUMN_COLORS.map(color => <button key={color.value} onClick={() => { setColumnPatch(columnDialog.column.id, { color: color.value }); setColumnDialog(null) }} className="flex items-center gap-2 rounded-xl border border-border bg-surface-inset px-2 py-2 text-[10px] text-foreground hover:border-primary/30" aria-label={`انتخاب رنگ ${color.name}`}><span className="h-4 w-4 rounded-full" style={{ backgroundColor: color.value }} />{color.name}</button>)}</div></>}
      {columnDialog.type === 'wip' && <><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">سقف WIP ستون</h2><button onClick={() => setColumnDialog(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="بستن"><X className="h-4 w-4" /></button></div><p className="mt-3 text-[10px] leading-5 text-muted-foreground">این سقف فقط هشدار بصری است و اجازهٔ انتقال در گردش‌کار را تغییر نمی‌دهد.</p><label className="mt-4 block text-xs text-muted-foreground">حداکثر کار در جریان<input autoFocus type="number" min="1" value={columnDialog.value} onChange={event => setColumnDialog({ ...columnDialog, value: event.target.value, error: undefined })} onKeyDown={event => { if (event.key === 'Enter') saveWipLimit() }} placeholder="بدون سقف" className="mt-2 w-full rounded-xl border border-border bg-surface-inset px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/35" /></label>{columnDialog.error && <p className="mt-2 text-[10px] text-red-500">{columnDialog.error}</p>}<div className="mt-5 flex gap-2"><button onClick={saveWipLimit} className="flex-1 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-xs font-medium text-primary hover:bg-primary/15">ذخیره</button><button onClick={() => { setColumnPatch(columnDialog.column.id, { wipLimit: undefined }); setColumnDialog(null) }} className="flex-1 rounded-xl border border-border py-2.5 text-xs text-muted-foreground hover:bg-secondary">بدون سقف</button></div></>}
      {columnDialog.type === 'delete' && <><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">حذف ستون</h2><button onClick={() => setColumnDialog(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="بستن"><X className="h-4 w-4" /></button></div><p className="mt-4 text-xs leading-6 text-muted-foreground">{getAllColumnTasks(columnDialog.column).length ? `برای حذف «${columnDialog.column.name}»، ستون مقصد وظایف را انتخاب کنید.` : `ستون «${columnDialog.column.name}» حذف شود؟`}</p>{getAllColumnTasks(columnDialog.column).length > 0 && <label className="mt-4 block text-xs text-muted-foreground">ستون مقصد<select value={columnDialog.destinationId} onChange={event => setColumnDialog({ ...columnDialog, destinationId: event.target.value, error: undefined })} className="mt-2 w-full rounded-xl border border-border bg-surface-inset px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/35"><option value="">انتخاب کنید</option>{orderedColumns.filter(column => column.id !== columnDialog.column.id).map(column => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>}{columnDialog.error && <p className="mt-2 text-[10px] text-red-500">{columnDialog.error}</p>}<div className="mt-5 flex gap-2"><button onClick={deleteColumn} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/15">حذف ستون</button><button onClick={() => setColumnDialog(null)} className="flex-1 rounded-xl border border-border py-2.5 text-xs text-muted-foreground hover:bg-secondary">انصراف</button></div></>}
    </div></div>}
    {transitionChooser && <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-sm" onMouseDown={() => setTransitionChooser(null)}><div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()} role="dialog" aria-label="انتخاب انتقال">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-foreground">انتخاب انتقال</h2><p className="mt-1 text-[10px] text-muted-foreground">برای ادامه، انتقال موردنظر را انتخاب کنید.</p></div><button type="button" onClick={() => setTransitionChooser(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="بستن"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 space-y-2">{transitionChooser.transitions.map((transition) => {
        const from = statuses.find((status) => status.id === transition.from)?.name ?? transition.from
        const to = statuses.find((status) => status.id === transition.to)?.name ?? transition.to
        const task = boardTasks.find((candidate) => candidate.id === transitionChooser.taskId)
        const pending = task ? !canStartBoardTaskTransition(pendingTransitionTaskIds, task.id) : true
        return <button key={transition.id} type="button" disabled={pending} onClick={async () => { if (!task) return setTransitionChooser(null); if (await executeTransition(task, transition.id)) setTransitionChooser(null) }} className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-inset px-3 py-2.5 text-start text-xs text-foreground hover:border-primary/35 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"><span>{transition.name ?? `${from} ← ${to}`}</span><span className="text-[10px] text-muted-foreground">{from} ← {to}</span></button>
      })}</div>
      <button type="button" onClick={() => setTransitionChooser(null)} className="mt-4 w-full rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">انصراف</button>
    </div></div>}
  </div>
}
