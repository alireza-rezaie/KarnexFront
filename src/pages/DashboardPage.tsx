import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ListTodo, FolderKanban, Timer, CheckCircle2,
  TrendingUp, ChevronLeft, CalendarDays, Plus, Video, MapPin
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { chartTheme } from '@/lib/chart-theme'
import { formatNumber, toPersianDigits } from '@/lib/persian-numbers'
import { useSprints } from '@/contexts/SprintsContext'
import { useProjects } from '@/contexts/ProjectsContext'
import { useTasks } from '@/contexts/TasksContext'
import { useMembers } from '@/contexts/MembersContext'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useCalendar } from '@/contexts/CalendarContext'
import ProjectSelectionDialog from '@/components/ProjectSelectionDialog'
import { UserAvatar } from '@/components/UserAvatar'
import { projectCreationDestination, projectSelectionDestination, type ProjectSelectionIntent } from '@/lib/project-creation-navigation'
import { formatJalaliDate } from '@/utils/jalaliDate'
import { useOptionalTerminalStatusPolicy } from '@/contexts/TerminalStatusPolicyContext'

const activityData: { day: string; value: number }[] = []
const activities: { id: string; userId: string; target: string; timestamp: string; type: 'task' | 'file' | 'sprint' | 'comment' | 'project' }[] = []

const taskPriority = {
  medium: { label: 'متوسط', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  high: { label: 'زیاد', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  highest: { label: 'فوری', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
} as const

const reminderPriority = {
  low: { label: 'کم', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  medium: { label: 'متوسط', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  high: { label: 'زیاد', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
} as const

const activityPresentation = {
  task: { action: 'وظیفه را به «در حال انجام» منتقل کرد', color: 'bg-blue-500', ring: 'ring-blue-500/15' },
  file: { action: 'یک پیوست جدید اضافه کرد به', color: 'bg-violet-500', ring: 'ring-violet-500/15' },
  sprint: { action: 'اسپرینت جدید ایجاد کرد', color: 'bg-emerald-500', ring: 'ring-emerald-500/15' },
  comment: { action: 'دیدگاه جدید ثبت کرد در', color: 'bg-amber-500', ring: 'ring-amber-500/15' },
  project: { action: 'پروژه را به‌روزرسانی کرد', color: 'bg-orange-500', ring: 'ring-orange-500/15' },
} as const

const dashboardItemSurface = 'border border-border/60 bg-surface-interactive/75 shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.04),0_4px_12px_hsl(var(--depth-shadow)/0.14)]'
const dashboardCtaClass = 'flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-surface-interactive px-4 py-2.5 text-xs font-semibold text-primary shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.055),0_5px_14px_hsl(var(--depth-shadow)/0.18),0_0_16px_hsl(var(--primary)/0.04)] outline-none transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent hover:shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.07),0_8px_18px_hsl(var(--depth-shadow)/0.22),0_0_18px_hsl(var(--primary)/0.08)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px active:bg-surface-inset active:shadow-[inset_0_2px_5px_hsl(var(--depth-shadow)/0.35)]'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { sprints } = useSprints()
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const { members } = useMembers()
  const { currentMember } = useCurrentUser()
  const { events: calendarEvents } = useCalendar()
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy()
  const isTaskCompleted = (projectId: string, status: string) => terminalStatusPolicy?.isTaskCompleted(projectId, { projectId, status }) ?? false
  const [activityChartMode, setActivityChartMode] = useState<'line' | 'bars'>('line')
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all')
  const [projectSelectionIntent, setProjectSelectionIntent] = useState<Extract<ProjectSelectionIntent, 'viewTasks' | 'viewReports' | 'createTask' | 'createSprint'> | null>(null)
  const reminders = useMemo(() => calendarEvents
    .filter((event) => event.type === 'reminder' && event.status !== 'completed')
    .sort((first, second) => new Date(first.start).getTime() - new Date(second.start).getTime())
    .map((event): { id: string; title: string; time: string; period: string; priority: keyof typeof reminderPriority } => ({
      id: event.id,
      title: event.title,
      time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start)),
      period: new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(new Date(event.start)),
      priority: event.priority === 'low' ? 'low' : event.priority === 'high' || event.priority === 'highest' ? 'high' : 'medium',
    })), [calendarEvents])
  const meetings = useMemo(() => calendarEvents
    .filter((event) => event.type === 'meeting' && event.status !== 'cancelled')
    .sort((first, second) => new Date(first.start).getTime() - new Date(second.start).getTime())
    .map((event) => ({
      id: event.id,
      title: event.title,
      time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start)),
      location: event.location ?? 'بدون مکان',
      memberIds: event.participants.map((participant) => participant.memberId),
      status: event.status === 'completed' ? 'bg-emerald-500' : 'bg-primary',
    })), [calendarEvents])
  const statCards = [
    { title: 'کل وظایف', value: tasks.length, change: '—', icon: ListTodo, color: 'blue', changeType: 'up' as const },
    { title: 'پروژه‌های فعال', value: projects.filter((project) => project.status === 'active').length, change: '—', icon: FolderKanban, color: 'orange', changeType: 'up' as const },
    { title: 'در حال انجام', value: tasks.filter((task) => task.status === 'inprogress').length, change: '—', icon: Timer, color: 'purple', changeType: 'down' as const },
    { title: 'تکمیل‌شده', value: tasks.filter((task) => isTaskCompleted(task.projectId, task.status)).length, change: '—', icon: CheckCircle2, color: 'green', changeType: 'up' as const },
  ]
  const projectPieData = projects.map(project => {
    const projectTaskCount = tasks.filter(task => task.projectId === project.id).length
    const totalTaskCount = tasks.length

    return {
      name: project.name,
      value: totalTaskCount ? Math.round((projectTaskCount / totalTaskCount) * 100) : 0,
      color: project.color,
    }
  })
  const projectDistributionTotal = projectPieData.length
  const todoItems = tasks.slice(0, 5).map(task => ({
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    project: projects.find(project => project.id === task.projectId)?.name ?? '—',
    priority: task.priority === 'highest' || task.priority === 'high' || task.priority === 'medium' ? task.priority : 'medium',
    date: formatJalaliDate(task.dueDate) ?? '—',
    completed: isTaskCompleted(task.projectId, task.status),
  }))
  const visibleTasks = todoItems
    .filter((item) => taskFilter === 'all' || (taskFilter === 'done' ? item.completed : !item.completed))
    .slice(0, 3)
  const averageActivity = activityData.length
    ? Math.round(activityData.reduce((total, item) => total + item.value, 0) / activityData.length)
    : 0

  const selectProject = (projectId: string, intent: Extract<ProjectSelectionIntent, 'viewTasks' | 'viewReports' | 'createTask' | 'createSprint'>) => {
    if (intent === 'viewTasks' || intent === 'viewReports') {
      navigate(projectSelectionDestination(projectId, intent))
    } else {
      const destination = projectCreationDestination(projectId, intent)
      navigate(destination.pathname, { state: destination.state })
    }

    setProjectSelectionIntent(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            سلام {currentMember?.name ?? 'کاربر'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            امروز چه برنامه‌ای داریم؟
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setProjectSelectionIntent('viewTasks')}
            className="app-action"
          >
            <ListTodo className="w-4 h-4" />
            وظایف من
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div 
            key={index}
            className="karnex-card-hover min-h-[84px] cursor-pointer p-3"
            onClick={() => navigate(index === 0 ? '/tasks' : index === 2 ? '/tasks?status=inprogress' : index === 3 ? '/tasks?status=done' : '/projects')}
          >
            <div className="flex h-full min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${stat.color}-500/10`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{stat.title}</p>
                <h3 className="mt-1 text-xl font-bold leading-none text-foreground">
                  {stat.value.toLocaleString('fa-IR')}
                </h3>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  stat.changeType === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {stat.change}
                </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-12">
      {/* Main Content Grid */}
      <div className="contents">
        {/* Activity Chart */}
        <div className="karnex-card order-6 flex h-[320px] min-w-0 flex-col p-4 md:col-span-2 lg:col-span-6 lg:col-start-7 lg:row-start-2">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm">فعالیت هفتگی</h3>
              <p className="text-xs text-muted-foreground mt-0.5">خلاصه فعالیت پروژه‌ها</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="surface-inset flex rounded-lg p-0.5" aria-label="نوع نمودار">
                {([
                  ['line', 'خطی'],
                  ['bars', 'ستونی'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActivityChartMode(mode)}
                    aria-pressed={activityChartMode === mode}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      activityChartMode === mode
                        ? 'surface-interactive text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />
                —
              </div>
            </div>
          </div>
          {activityChartMode === 'line' ? (
            <div className="h-[245px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(value: number) => formatNumber(value)}
                    tick={{ fontSize: 10, fill: chartTheme.axis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={chartTheme.tooltip} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[245px] flex-col pt-1">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{formatNumber(averageActivity)}٪</span>
                <span className="text-[10px] text-muted-foreground">میانگین فعالیت هفته</span>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 sm:gap-2.5">
                {activityData.map((item) => (
                  <div key={item.day} className="flex min-w-0 flex-col items-center gap-1.5">
                    <div className="relative min-h-[130px] w-full flex-1 overflow-hidden rounded-lg bg-secondary/55 ring-1 ring-inset ring-border/60">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-[height] duration-300"
                        style={{ height: `${item.value}%` }}
                      />
                      <span className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-semibold text-white drop-shadow-sm">
                        {formatNumber(item.value)}٪
                      </span>
                    </div>
                    <span className="w-full truncate text-center text-[9px] text-muted-foreground sm:text-[10px]">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's Tasks */}
        <div className="karnex-card order-3 grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] p-4 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:h-[340px]" dir="rtl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">وظایف من</h3>
            <button 
              onClick={() => setProjectSelectionIntent('viewTasks')}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              مشاهده همه
              <ChevronLeft className="size-3.5" />
            </button>
          </div>
          <div className="surface-inset mb-3 grid grid-cols-3 rounded-xl p-1" aria-label="فیلتر وظایف">
            {([['all', 'همه'], ['open', 'باز'], ['done', 'انجام‌شده']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTaskFilter(value)}
                aria-pressed={taskFilter === value}
                className={`rounded-lg px-2 py-1.5 text-[10px] font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/40 ${taskFilter === value ? 'surface-interactive text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pe-1 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
            {visibleTasks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/projects/${item.projectId}/tasks/${item.id}`)}
                className={`${dashboardItemSurface} group flex w-full items-center gap-2.5 rounded-xl p-2.5 text-right outline-none transition-all hover:-translate-y-0.5 hover:border-border focus-visible:ring-2 focus-visible:ring-ring/40`}
              >
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${item.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45 group-hover:border-primary'}`}>
                  {item.completed && <CheckCircle2 className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{item.title}</span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">{item.project} · {item.date}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-medium ${taskPriority[item.priority].className}`}>
                  {taskPriority[item.priority].label}
                </span>
              </button>
            ))}
            {visibleTasks.length === 0 && (
              <div className={`${dashboardItemSurface} rounded-xl px-3 py-6 text-center text-xs text-muted-foreground`}>
                وظیفه‌ای در این بخش نیست
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setProjectSelectionIntent('createTask')}
            className={`mt-3 ${dashboardCtaClass}`}
          >
            <Plus className="size-4" />
            وظیفه جدید
          </button>
        </div>
      </div>

      {/* Second Row */}
      <div className="contents">
        {/* Project Distribution */}
        <div className="karnex-card order-4 h-fit p-4 sm:p-5 lg:col-span-3 lg:col-start-1 lg:row-start-2 lg:h-[320px]">
          <div className="mb-3 flex items-center justify-end gap-3">
            <h3 className="text-right text-sm font-semibold text-foreground">توزیع پروژه‌ها</h3>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-5 lg:h-[245px]">
            <div className="relative h-36 w-36 shrink-0 sm:h-32 sm:w-32">
              <div className="absolute inset-3 rounded-full bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(15,23,42,0.14)] ring-1 ring-border/50" />
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="78%"
                    startAngle={118}
                    endAngle={-242}
                    paddingAngle={9}
                    cornerRadius={14}
                    dataKey="value"
                    stroke="transparent"
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {projectPieData.map((entry, index) => (
                      <Cell
                        key={`project-distribution-cell-${index}`}
                        fill={entry.color}
                        className="drop-shadow-[0_5px_8px_rgba(0,0,0,0.22)]"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTheme.tooltip}
                    formatter={(value: number) => [`${formatNumber(value)}٪`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none text-foreground">
                  {formatNumber(projectDistributionTotal)}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">پروژه</span>
              </div>
            </div>
            <div className="w-full min-w-0 flex-1 space-y-2">
              {projectPieData.map((item, index) => (
                <div key={index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-right text-xs text-muted-foreground">{item.name}</span>
                  <span className="text-left text-xs font-semibold text-foreground">
                    {formatNumber(item.value)}٪
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Sprints */}
        <div className="karnex-card order-7 grid h-fit min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] p-4 sm:p-5 md:col-span-2 lg:col-span-6 lg:col-start-1 lg:row-start-3 lg:h-[320px]" dir="rtl">
          <h3 className="mb-4 text-sm font-semibold text-foreground">اسپرینت‌های فعال</h3>
          <div className="min-h-0 space-y-2.5 overflow-y-auto pe-1 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
            {sprints.filter(s => s.status === 'active').map((sprint, index) => {
              const total = tasks.filter((task) => task.sprintId === sprint.id).length
              const completed = Math.max(1, total - index - 2)
              const inProgress = total - completed
              const progress = Math.round((completed / total) * 100)
              return (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => navigate(`/projects/${sprint.projectId}/backlog`)}
                  className={`${dashboardItemSurface} block w-full rounded-2xl p-3 text-right outline-none transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-[0_8px_18px_hsl(var(--depth-shadow)/0.18)] focus-visible:ring-2 focus-visible:ring-ring/40`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{sprint.name}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {toPersianDigits(formatJalaliDate(sprint.startDate) ?? sprint.startDate)} تا {toPersianDigits(formatJalaliDate(sprint.endDate) ?? sprint.endDate)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-primary">{formatNumber(progress)}٪</span>
                  </span>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </span>
                  <span className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-border/70 text-center">
                    <span>
                      <span className="block text-xs font-bold text-foreground">{formatNumber(total)}</span>
                      <span className="mt-0.5 block text-[9px] text-muted-foreground">کل وظایف</span>
                    </span>
                    <span>
                      <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(completed)}</span>
                      <span className="mt-0.5 block text-[9px] text-muted-foreground">تکمیل‌شده</span>
                    </span>
                    <span>
                      <span className="block text-xs font-bold text-amber-600 dark:text-amber-400">{formatNumber(inProgress)}</span>
                      <span className="mt-0.5 block text-[9px] text-muted-foreground">در حال انجام</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setProjectSelectionIntent('createSprint')}
            className={`mt-4 ${dashboardCtaClass}`}
          >
            <Plus className="size-4" />
            اسپرینت جدید
          </button>
        </div>

        {/* Right Column: Meetings + Reminders */}
        <div className="contents">
          {/* Meetings */}
          <div className="karnex-card order-2 grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] p-4 lg:col-span-4 lg:col-start-5 lg:row-start-1 lg:h-[340px]" dir="rtl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">جلسات امروز</h3>
              <CalendarDays className="size-4 text-muted-foreground" />
            </div>
            <div className="min-h-0 space-y-2.5 overflow-y-auto pe-1 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
              {meetings.map((meeting) => (
                <div key={meeting.id} className={`${dashboardItemSurface} group rounded-2xl p-2 transition-all hover:-translate-y-0.5 hover:border-border`}>
                  <div className="flex items-center gap-3">
                    <div className="relative flex w-14 shrink-0 flex-col items-center justify-center border-l border-border/70 pl-3">
                      <span className="text-lg font-bold leading-none text-foreground tabular-nums" dir="ltr">{meeting.time}</span>
                      <span className="mt-1 text-[9px] text-muted-foreground">امروز</span>
                      <span className={`absolute -left-1 top-0 size-2 rounded-full ring-2 ring-background ${meeting.status}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{meeting.title}</p>
                      <div className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{meeting.location}</span>
                      </div>
                    </div>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Video className="size-4" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
                    <div className="flex -space-x-1.5 space-x-reverse">
                      {meeting.memberIds.map((memberId) => {
                        const member = members.find((item) => item.id === memberId)
                        return <UserAvatar key={memberId} avatarId={member?.avatarId} name={member?.name} className="size-6 border-2 border-background" />
                      })}
                    </div>
                    <span className="text-[9px] text-muted-foreground">{formatNumber(meeting.memberIds.length)} شرکت‌کننده</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reminders */}
          <div className="karnex-card order-1 grid min-w-0 grid-rows-[auto_minmax(0,1fr)] p-4 lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:h-[340px]" dir="rtl">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">یادآوری‌ها</h3>
            </div>
            <div className="min-h-0 space-y-2 overflow-y-auto pe-1 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`${dashboardItemSurface} rounded-2xl px-3.5 py-2.5`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5" dir="ltr">
                        <span className="text-2xl font-bold leading-none text-foreground tabular-nums">
                          {reminder.time}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">{reminder.period}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{reminder.title}</p>
                    </div>
                    <div className={`mt-1 flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${reminderPriority[reminder.priority].text}`}>
                      <span>{reminderPriority[reminder.priority].label}</span>
                      <span className={`size-2 rounded-full shadow-[0_0_0_3px_hsl(var(--background)/0.55)] ${reminderPriority[reminder.priority].dot}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Projects Row */}
      <div className="karnex-card order-8 grid min-w-0 grid-rows-[auto_minmax(0,1fr)] p-4 sm:p-5 md:col-span-2 lg:col-span-6 lg:col-start-7 lg:row-start-3 lg:h-[320px]" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">پروژه‌های فعال</h3>
          <button 
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            مشاهده همه
            <ChevronLeft className="size-3.5" />
          </button>
        </div>
        <div className="flex min-h-0 gap-3 overflow-x-auto pb-1 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
          {projects.filter(p => p.status === 'active').map((project) => (
            <button
              type="button"
              key={project.id} 
              className={`${dashboardItemSurface} group flex min-h-44 min-w-[230px] flex-1 flex-col rounded-2xl p-4 text-right outline-none transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.04),0_9px_20px_hsl(var(--depth-shadow)/0.2)] focus-visible:ring-2 focus-visible:ring-ring/40`}
              onClick={() => navigate(`/projects/${project.id}/overview`)}
            >
              <span className="mb-4 flex w-full items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: project.color + '18' }}>
                  <FolderKanban className="size-5" style={{ color: project.color }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">{project.name}</span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">{project.description}</span>
                </span>
                <span className="shrink-0 rounded-lg border border-border/70 bg-background/55 px-2 py-1 text-[9px] font-semibold text-muted-foreground">{project.key}</span>
              </span>
              <span className="mb-2 flex w-full items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{formatNumber(tasks.filter((task) => task.projectId === project.id).length)} وظیفه</span>
                <span className="font-semibold text-foreground">{formatNumber(project.progress)}٪</span>
              </span>
              <span className="block h-2 w-full overflow-hidden rounded-full bg-secondary shadow-inner">
                <span className="block h-full rounded-full transition-all" style={{ width: `${project.progress}%`, backgroundColor: project.color }} />
              </span>
              <span className="mt-auto flex w-full items-end justify-between pt-4">
                <span className="flex -space-x-1.5 space-x-reverse">
                  {project.members.slice(0, 3).map((memberId) => {
                    const member = members.find(m => m.id === memberId)
                    return (
                      <UserAvatar key={memberId} avatarId={member?.avatarId} name={member?.name} className="size-7 border-2 border-background" />
                    )
                  })}
                  {project.members.length > 3 && (
                    <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-secondary text-[9px] text-muted-foreground">
                      +{formatNumber(project.members.length - 3)}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  فعال
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="karnex-card order-5 grid min-w-0 grid-rows-[auto_minmax(0,1fr)] p-4 sm:p-5 lg:col-span-3 lg:col-start-4 lg:row-start-2 lg:h-[320px]" dir="rtl">
        <h3 className="mb-4 text-sm font-semibold text-foreground">فعالیت‌های اخیر</h3>
        <div className="relative min-h-0 space-y-2.5 overflow-y-auto pe-1 before:absolute before:bottom-5 before:right-[1.125rem] before:top-5 before:w-px before:bg-border/70 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
          {activities.slice(0, 5).map((activity) => {
            const user = members.find(m => m.id === activity.userId)
            const presentation = activityPresentation[activity.type]
            return (
              <div key={activity.id} className={`${dashboardItemSurface} group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:-translate-y-px hover:border-border`}>
                <div className="relative z-10 shrink-0">
                  <UserAvatar avatarId={user?.avatarId} name={user?.name} className="size-9 border-2 border-background" />
                  <span className={`absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border-2 border-background ${presentation.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">
                    <span className="font-semibold">{user?.name}</span>{' '}
                    <span className="text-muted-foreground">{presentation.action}</span>{' '}
                    <span className="font-medium text-primary">{toPersianDigits(activity.target)}</span>
                  </p>
                  <span className="mt-1 block text-[10px] text-muted-foreground">{toPersianDigits(activity.timestamp)}</span>
                </div>
                <span className={`size-2 shrink-0 rounded-full ring-4 ${presentation.color} ${presentation.ring}`} aria-hidden="true" />
              </div>
            )
          })}
        </div>
      </div>
      </div>
      <ProjectSelectionDialog intent={projectSelectionIntent} onClose={() => setProjectSelectionIntent(null)} onSelect={selectProject} />
    </div>
  )
}
