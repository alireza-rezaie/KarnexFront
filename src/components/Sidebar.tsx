import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Archive,
  AlertTriangle,
  BarChart3,
  Bookmark,
  Building2,
  CalendarDays,
  CalendarCheck,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Shapes,
  Timer,
  Trash2,
  Users,
  UserCog,
  UserPlus,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import BrandLogo from '@/components/BrandLogo'
import ProjectSelectionDialog from '@/components/ProjectSelectionDialog'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useAuth } from '@/contexts/AuthContext'
import { useMembers } from '@/contexts/MembersContext'
import { useOptionalProject } from '@/contexts/ProjectContext'
import { useProjects } from '@/contexts/ProjectsContext'
import { useTasks } from '@/contexts/TasksContext'
import { useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { useRoles } from '@/contexts/RolesContext'
import { useSprints } from '@/contexts/SprintsContext'
import { getApprovalActionState } from '@/utils/approvalRequestView'
import type { Project } from '@/types/project'
import type { Task } from '@/types/task'
import { parseProjectView, type ProjectView } from '@/utils/projectView'
import { projectSelectionDestination, type ProjectSelectionIntent } from '@/lib/project-creation-navigation'
import { getCurrentJalaliComparableDate } from '@/utils/jalaliDate'
import { filterTasksByQuickFilter } from '@/utils/taskQuickFilter'
import { useOptionalTerminalStatusPolicy } from '@/contexts/TerminalStatusPolicyContext'

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

const modules = [
  { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'projects', label: 'پروژه‌ها', icon: FolderKanban, path: '/projects' },
  { id: 'tasks', label: 'همهٔ وظایف', icon: ListTodo, path: '/tasks' },
  { id: 'backlog', label: 'بک‌لاگ', icon: ClipboardList, path: '/projects' },
  { id: 'sprint', label: 'اسپرینت فعال', icon: Timer, path: '/projects' },
  { id: 'calendar', label: 'تقویم', icon: CalendarDays, path: '/calendar' },
  { id: 'reports', label: 'گزارش‌ها', icon: BarChart3, path: '/projects/:projectId/reports' },
  { id: 'members', label: 'اعضا', icon: Users, path: '/members' },
  { id: 'users', label: 'مدیریت کاربران', icon: UserCog, path: '/admin/users' },
  { id: 'files', label: 'فایل‌ها', icon: FileText, path: '/files' },
  { id: 'settings', label: 'تنظیمات', icon: Settings, path: '/settings' },
]

const badgeColors = ['bg-amber-300 text-amber-950', 'bg-orange-300 text-orange-950', 'bg-fuchsia-300 text-fuchsia-950', 'bg-emerald-300 text-emerald-950']

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const projectContext = useOptionalProject()
  const { projects } = useProjects()
  const { members } = useMembers()
  const { currentMember } = useCurrentUser()
  const { isSystemAdmin } = useAuth()
  const { roles } = useRoles()
  const { requests } = useApprovalRequests()
  const { sprints } = useSprints()
  const { tasks } = useTasks()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [projectScope, setProjectScope] = useState<'team' | 'personal'>('team')
  const [search, setSearch] = useState('')
  const [recentExpanded, setRecentExpanded] = useState(true)
  const [categoriesExpanded, setCategoriesExpanded] = useState(true)
  const [reportSelectionSlug, setReportSelectionSlug] = useState<string | null>(null)
  const [projectSelectionIntent, setProjectSelectionIntent] = useState<ProjectSelectionIntent | null>(null)

  const visibleModules = isSystemAdmin ? modules : modules.filter((module) => module.id !== 'users')
  const activeModule = resolveActiveModule(location.pathname)
  const projectView = parseProjectView(new URLSearchParams(location.search).get('view'))
  const selectedModule = visibleModules.find((module) => module.id === selectedModuleId) ?? activeModule
  const panelVisible = panelOpen || mobileOpen
  const filteredProjects = useMemo(
    () => {
      const scopedProjects = projectScope === 'personal'
        ? currentMember
          ? projects.filter((project) => currentMember.projects.includes(project.id))
          : []
        : projects

      const normalizedSearch = search.trim().toLocaleLowerCase('fa')
      return scopedProjects.filter((project) => !normalizedSearch || project.name.toLocaleLowerCase('fa').includes(normalizedSearch))
    },
    [projects, projectScope, currentMember, search],
  )
  const currentProjectId = projectContext?.currentProject?.id
  const pendingApprovalCount = useMemo(
    () => requests.filter((request) => request.projectId === currentProjectId && getApprovalActionState(request, currentMember, members, roles).eligible).length,
    [requests, currentProjectId, currentMember, members, roles],
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanelOpen(false)
        setSelectedModuleId(null)
        onMobileClose()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [onMobileClose])

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      setPanelOpen(false)
      setSelectedModuleId(null)
    }, 500)
  }

  const supportsHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const previewModule = (moduleId: string) => {
    if (!supportsHover()) return
    cancelClose()
    setSelectedModuleId(moduleId)
    setPanelOpen(true)
  }

  const selectModule = (moduleId: string, path: string) => {
    cancelClose()
    setSelectedModuleId(moduleId)
    setPanelOpen(true)
    if (moduleId === 'tasks') { navigate('/tasks'); return }
    navigate(resolveModulePath(moduleId, path, projectContext?.currentProject?.id))
  }

  const go = (path: string) => {
    navigate(path)
    setPanelOpen(false)
    setSelectedModuleId(null)
    onMobileClose()
  }

  const selectProject = (projectId: string, intent: ProjectSelectionIntent) => {
    if (intent === 'createTask' || intent === 'createSprint') return

    if (intent === 'viewReports' && reportSelectionSlug) {
      go(`/projects/${projectId}/reports/${reportSelectionSlug}`)
    } else {
      go(projectSelectionDestination(projectId, intent))
    }

    setReportSelectionSlug(null)
    setProjectSelectionIntent(null)
  }

  return (
    <>
      <button
        type="button"
        aria-label="بستن منوی کناری"
        className={cn(
          'fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity lg:hidden',
          panelVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => {
          setPanelOpen(false)
          setSelectedModuleId(null)
          onMobileClose()
        }}
      />

      <aside
        data-sidebar-panel-open={panelVisible}
        onMouseEnter={cancelClose}
        onMouseLeave={() => supportsHover() && scheduleClose()}
        onFocusCapture={cancelClose}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose()
        }}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex max-w-full flex-row border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_1px_0_0_hsl(var(--depth-highlight)/0.025),-12px_0_28px_hsl(var(--depth-shadow)/0.3)] transition-[width,transform] duration-300 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
          panelVisible ? 'w-[min(392px,100vw)] md:w-[392px]' : 'w-[min(392px,100vw)] md:w-[72px]',
        )}
      >
        <div className="surface-inset flex h-full w-[72px] shrink-0 flex-col items-center border-y-0 border-r-0 px-2 py-4">
          <button
            type="button"
            title="داشبورد"
            aria-label="داشبورد"
            onClick={() => selectModule('dashboard', '/dashboard')}
            onMouseEnter={() => previewModule('dashboard')}
            onFocus={() => {
              setSelectedModuleId('dashboard')
              setPanelOpen(true)
            }}
            className="mb-6 flex size-11 items-center justify-center rounded-2xl"
          >
            <BrandLogo variant="mark" />
          </button>

          <nav className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto py-1">
            {visibleModules.map((module, index) => {
              const active = module.id === activeModule.id
              return (
                <div key={module.id} className={cn(index === 6 && 'mt-3 border-t border-sidebar-border pt-4')}>
                  <button
                    type="button"
                    title={module.label}
                    aria-label={module.label}
                    onClick={() => selectModule(module.id, module.path)}
                    onMouseEnter={() => previewModule(module.id)}
                    onFocus={() => {
                      setSelectedModuleId(module.id)
                      setPanelOpen(true)
                    }}
                    className={cn(
                      'group relative flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      active && (module.id === 'reports' ? 'surface-interactive text-sidebar-foreground' : 'surface-interactive text-sidebar-primary'),
                    )}
                  >
                    <module.icon className="size-[19px]" />
                    {active && <span className={cn('absolute -right-2 h-5 w-0.5 rounded-full', module.id === 'reports' ? 'bg-sidebar-foreground/45' : 'bg-sidebar-primary')} />}
                  </button>
                </div>
              )
            })}
          </nav>

        </div>

        {panelVisible && (
          <section className="h-full min-w-0 flex-1 overflow-y-auto bg-surface-raised">
            <div className="flex h-[68px] items-center justify-between border-b border-sidebar-border px-4">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">فضای کاری کارنکس</p>
                <h2 className="mt-1 text-xl font-bold text-foreground">{selectedModule.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPanelOpen(false)
                  setSelectedModuleId(null)
                  onMobileClose()
                }}
                aria-label="بستن"
                className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
              >
                <X className="size-4" />
              </button>
            </div>

            {selectedModule.id === 'projects' ? (
              <ProjectsContext
                categoriesExpanded={categoriesExpanded}
                filteredProjects={filteredProjects}
                projectScope={projectScope}
                projectView={projectView}
                recentExpanded={recentExpanded}
                search={search}
                onCategoriesToggle={() => setCategoriesExpanded((value) => !value)}
                onNavigate={go}
                onRecentToggle={() => setRecentExpanded((value) => !value)}
                onScopeChange={setProjectScope}
                onSearchChange={setSearch}
              />
            ) : (
              <ModuleContext activeId={selectedModule.id} activeSprints={sprints.filter((sprint) => sprint.status === 'active')} tasks={tasks} onNavigate={go} onProjectSelection={(intent, reportSlug) => { setProjectSelectionIntent(intent); setReportSelectionSlug(reportSlug ?? null) }} currentProjectName={projectContext?.currentProject?.name} currentProjectId={currentProjectId} currentMemberId={currentMember?.id} memberCount={members.length} pendingApprovalCount={pendingApprovalCount} />
            )}
          </section>
        )}
      </aside>
      <ProjectSelectionDialog intent={projectSelectionIntent} onClose={() => { setProjectSelectionIntent(null); setReportSelectionSlug(null) }} onSelect={selectProject} />
    </>
  )
}

interface ProjectsContextProps {
  categoriesExpanded: boolean
  filteredProjects: Project[]
  projectScope: 'team' | 'personal'
  projectView: ProjectView
  recentExpanded: boolean
  search: string
  onCategoriesToggle: () => void
  onNavigate: (path: string) => void
  onRecentToggle: () => void
  onScopeChange: (scope: 'team' | 'personal') => void
  onSearchChange: (value: string) => void
}

function ProjectsContext(props: ProjectsContextProps) {
  const { tasks } = useTasks()

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-2 rounded-xl bg-background/65 p-1 shadow-inner">
        {(['team', 'personal'] as const).map((scope) => (
          <button key={scope} type="button" onClick={() => props.onScopeChange(scope)} className={cn('rounded-lg py-2 text-xs font-medium text-muted-foreground transition-all', props.projectScope === scope && 'bg-secondary text-foreground shadow-sm')}>
            {scope === 'team' ? 'تیمی' : 'شخصی'}
          </button>
        ))}
      </div>

      <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-sidebar-border bg-background/70 px-3 text-muted-foreground transition-colors focus-within:border-primary/50 focus-within:text-foreground">
        <Search className="size-4 shrink-0" />
        <input value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="جستجو در پروژه‌ها..." className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
        <kbd className="rounded-md border border-sidebar-border bg-secondary px-1.5 py-0.5 text-[10px]">⌘ S</kbd>
      </label>

      <SidebarSection icon={Clock3} title="اخیر" expanded={props.recentExpanded} onToggle={props.onRecentToggle}>
        <div className="relative mr-2 border-r border-sidebar-border pr-3">
          {props.filteredProjects.map((project, index) => (
            <button key={project.id} type="button" onClick={() => props.onNavigate(`/projects/${project.id}/overview`)} className={cn('relative mb-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-right text-xs text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground', index === 0 && 'surface-interactive font-semibold text-foreground')}>
              <span className="absolute -right-[13px] h-px w-3 bg-sidebar-border" />
              <span className="min-w-0 flex-1 truncate"># {project.name}</span>
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', badgeColors[index % badgeColors.length])}>{tasks.filter((task) => task.projectId === project.id).length}</span>
            </button>
          ))}
          {!props.filteredProjects.length && <p className="rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-center text-xs text-muted-foreground">{props.projectScope === 'personal' ? 'پروژه شخصی برای نمایش وجود ندارد.' : 'پروژه‌ای برای نمایش وجود ندارد.'}</p>}
        </div>
        <button type="button" onClick={() => props.onNavigate('/projects')} className={cn('mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground', props.projectView === 'all' && 'surface-interactive text-sidebar-primary')}>
          <Copy className="size-4" /> همه پروژه‌ها
        </button>
      </SidebarSection>

      <SidebarSection icon={Shapes} title="دسته‌بندی‌ها" expanded={props.categoriesExpanded} onToggle={props.onCategoriesToggle}>
        <p className="mx-2 rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-center text-xs text-muted-foreground">دسته‌بندی پروژه پس از اتصال منبع داده نمایش داده می‌شود.</p>
      </SidebarSection>

      <div className="mt-3 space-y-0.5 border-t border-sidebar-border pt-3">
        <button type="button" onClick={() => props.onNavigate('/projects?view=archived')} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground', props.projectView === 'archived' && 'surface-interactive text-sidebar-primary')}><Archive className="size-4" /> پروژه‌های آرشیو شده</button>
        <button type="button" disabled title="حذف پروژه نیازمند سرویس Backend است." className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-muted-foreground opacity-50"><Trash2 className="size-4" /> پروژه‌های حذف شده</button>
      </div>
    </div>
  )
}

function SidebarSection({ children, expanded, icon: Icon, onToggle, title }: { children: React.ReactNode; expanded: boolean; icon: typeof Clock3; onToggle: () => void; title: string }) {
  return (
    <section className="mt-3.5">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <Icon className="size-4" />
        <span className="flex-1 text-right">{title}</span>
        <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && <div className="mt-1">{children}</div>}
    </section>
  )
}

interface ContextItem {
  label: string
  path: string
  icon: typeof Clock3
  badge?: string
  disabled?: boolean
  requiresProject?: boolean
}

interface ContextGroup {
  title: string
  items: ContextItem[]
}

const moduleContexts: Record<string, { searchable?: boolean; placeholder?: string; groups: ContextGroup[] }> = {
  dashboard: {
    groups: [{ title: 'نمای امروز', items: [
      { label: 'خلاصه عملکرد', path: '/dashboard', icon: LayoutDashboard },
      { label: 'فعالیت‌های اخیر', path: '/dashboard', icon: Clock3 },
    ] }],
  },
  tasks: {
    searchable: true,
    placeholder: 'جستجو در وظایف...',
    groups: [{ title: 'فیلترهای سریع', items: [
      { label: 'محول‌شده به من', path: '__PROJECT_TASKS_MINE__', icon: UserRoundCheck, badge: '__QUICK_MINE__', requiresProject: true },
      { label: 'ایجادشده توسط من', path: '__PROJECT_TASKS_CREATED_BY_ME__', icon: UserPlus, badge: '__QUICK_CREATED_BY_ME__', requiresProject: true },
      { label: 'سررسید امروز', path: '__PROJECT_TASKS_DUE_TODAY__', icon: CalendarCheck, badge: '__QUICK_DUE_TODAY__', requiresProject: true },
      { label: 'عقب‌افتاده', path: '__PROJECT_TASKS_OVERDUE__', icon: AlertTriangle, badge: '__QUICK_OVERDUE__', requiresProject: true },
      { label: 'تکمیل‌شده', path: '__PROJECT_TASKS_COMPLETED__', icon: CheckCircle2, requiresProject: true },
    ] }],
  },
  backlog: {
    groups: [
      { title: 'پروژه جاری', items: [{ label: '__CURRENT_PROJECT__', path: '__PROJECT_OVERVIEW__', icon: FolderKanban }] },
      { title: 'برنامه‌ریزی', items: [
        { label: 'آیتم‌های بک‌لاگ', path: '__PROJECT_BACKLOG__', icon: ClipboardList, badge: '__BACKLOG_COUNT__' },
        { label: 'برد پروژه', path: '__PROJECT_BOARD__', icon: FolderKanban },
        { label: 'تایم‌لاین', path: '__PROJECT_TIMELINE__', icon: CalendarDays },
      ] },
    ],
  },
  sprint: {
    groups: [
      { title: 'اسپرینت جاری', items: [{ label: 'اسپرینت ۴ - بخش کاربری', path: '__PROJECT_BOARD__', icon: Timer }] },
      { title: 'نماها و فیلترها', items: [
        { label: 'برد اسپرینت', path: '__PROJECT_BOARD__', icon: FolderKanban },
        { label: 'وظایف اسپرینت', path: '__PROJECT_TASKS__', icon: ListTodo, badge: '__SPRINT_TASK_COUNT__' },
        { label: 'گزارش اسپرینت', path: '__PROJECT_REPORTS__', icon: BarChart3 },
      ] },
    ],
  },
  calendar: {
    groups: [{ title: 'تقویم کاری', items: [
      { label: 'برنامه امروز', path: '/calendar?view=day&date=today', icon: CalendarCheck },
      { label: 'رویدادهای پیش رو', path: '', icon: CalendarDays, disabled: true },
    ] }],
  },
  reports: {
    groups: [
      { title: 'گزارش‌های چابک', items: [
        { label: 'Burndown', path: '/report/burndown', icon: BarChart3 },
        { label: 'Velocity', path: '/report/velocity', icon: Timer },
        { label: 'جریان تجمعی', path: '/report/cumulative', icon: SlidersHorizontal },
      ] },
      { title: 'تحلیل آیتم‌ها', items: [
        { label: 'نمودار کنترل', path: '/report/control', icon: BarChart3 },
        { label: 'ایجادشده در برابر حل‌شده', path: '/report/created', icon: CheckCircle2 },
        { label: 'گزارش‌های ذخیره‌شده', path: '', icon: Bookmark, disabled: true },
      ] },
    ],
  },
  members: {
    searchable: true,
    placeholder: 'جستجو در اعضا...',
    groups: [
      { title: 'مدیریت تیم', items: [
        { label: 'همه اعضا', path: '/members', icon: Users, badge: '__MEMBER_COUNT__' },
        { label: 'دعوت‌ها', path: '', icon: UserPlus, disabled: true },
        { label: 'نقش‌ها و دسترسی‌ها', path: '__PROJECT_ROLES__', icon: ShieldCheck },
      ] },
    ],
  },
  files: {
    searchable: true,
    placeholder: 'جستجو در فایل‌ها...',
    groups: [{ title: 'کتابخانه فایل', items: [
      { label: 'فایل‌های اخیر', path: '/files', icon: Clock3 },
      { label: 'اشتراک‌گذاری‌شده', path: '', icon: Users, disabled: true },
    ] }],
  },
  settings: {
    groups: [
      { title: 'فضای کاری', items: [
        { label: 'حساب کاربری', path: '/settings?tab=profile', icon: Settings },
        { label: 'سازمان', path: '/settings?tab=org', icon: Building2 },
        { label: 'تنظیمات پروژه', path: '__PROJECT_SETTINGS__', icon: FolderKanban },
        { label: 'تأییدها', path: '__PROJECT_APPROVALS__', icon: CheckCircle2, badge: '__APPROVAL_PENDING__' },
        { label: 'نقش‌ها و دسترسی‌ها', path: '__PROJECT_ROLES__', icon: ShieldCheck },
        { label: 'اشتراک و صورتحساب', path: '/subscription', icon: FileText },
      ] },
    ],
  },
}

function projectPath(projectId: string | undefined, segment: string) {
  return projectId ? `/projects/${projectId}/${segment}` : '/projects'
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveModulePath(moduleId: string, fallbackPath: string, currentProjectId: string | undefined) {
  if (moduleId === 'tasks') return projectPath(currentProjectId, 'tasks')
  if (moduleId === 'backlog') return projectPath(currentProjectId, 'backlog')
  if (moduleId === 'sprint') return projectPath(currentProjectId, 'board')
  if (moduleId === 'reports') return projectPath(currentProjectId, 'reports')

  return fallbackPath
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveContextPath(path: string, currentProjectId: string | undefined) {
  const sprintBoardProjectId = path.match(/^__SPRINT_BOARD__:(.+)$/)?.[1]
  if (sprintBoardProjectId) return `/projects/${sprintBoardProjectId}/board`

  const projectSegments: Record<string, string> = {
    __PROJECT_OVERVIEW__: 'overview',
    __PROJECT_BACKLOG__: 'backlog',
    __PROJECT_BOARD__: 'board',
    __PROJECT_TASKS__: 'tasks',
    __PROJECT_TIMELINE__: 'timeline',
    __PROJECT_REPORTS__: 'reports',
    __PROJECT_SETTINGS__: 'settings',
    __PROJECT_APPROVALS__: 'approvals',
    __PROJECT_ROLES__: 'roles',
    __PROJECT_TASKS_MINE__: 'tasks?quick=mine',
    __PROJECT_TASKS_CREATED_BY_ME__: 'tasks?quick=created-by-me',
    __PROJECT_TASKS_DUE_TODAY__: 'tasks?quick=due-today',
    __PROJECT_TASKS_OVERDUE__: 'tasks?quick=overdue',
    __PROJECT_TASKS_COMPLETED__: 'tasks?quick=completed',
  }
  const segment = projectSegments[path]
  if (segment) return projectPath(currentProjectId, segment)
  if (path.startsWith('/report/')) return projectPath(currentProjectId, `reports/${path.split('/').pop()}`)

  return path
}

export function ModuleContext({ activeId, activeSprints, tasks = [], onNavigate, onProjectSelection, currentProjectName, currentProjectId, currentMemberId, memberCount, pendingApprovalCount }: { activeId: string; activeSprints: { id: string; name: string; projectId: string }[]; tasks?: Task[]; onNavigate: (path: string) => void; onProjectSelection: (intent: ProjectSelectionIntent, reportSlug?: string) => void; currentProjectName?: string; currentProjectId?: string; currentMemberId?: string; memberCount: number; pendingApprovalCount: number }) {
  const location = useLocation()
  const currentQuickFilter = new URLSearchParams(location.search).get('quick')
  const [query, setQuery] = useState('')
  const context = moduleContexts[activeId] ?? moduleContexts.dashboard
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy()
  const projectTasks = tasks.filter((task) => task.projectId === currentProjectId)
  const activeSprintIds = activeSprints.filter((sprint) => sprint.projectId === currentProjectId).map((sprint) => sprint.id)
  const quickCount = (filter: 'mine' | 'created-by-me' | 'due-today' | 'overdue') => filterTasksByQuickFilter(tasks, currentProjectId, filter, currentMemberId, getCurrentJalaliComparableDate(), terminalStatusPolicy?.getTerminalStatusIds(currentProjectId ?? '') ?? []).length
  const resolvedBadge = (badge: string | undefined) => {
    if (badge === '__MEMBER_COUNT__') return String(memberCount)
    if (badge === '__APPROVAL_PENDING__') return pendingApprovalCount ? String(pendingApprovalCount) : undefined
    if (badge === '__BACKLOG_COUNT__') return String(projectTasks.filter((task) => !task.sprintId).length)
    if (badge === '__SPRINT_TASK_COUNT__') return String(projectTasks.filter((task) => task.sprintId && activeSprintIds.includes(task.sprintId)).length)
    if (badge === '__QUICK_MINE__') return String(quickCount('mine'))
    if (badge === '__QUICK_CREATED_BY_ME__') return String(quickCount('created-by-me'))
    if (badge === '__QUICK_DUE_TODAY__') return String(quickCount('due-today'))
    if (badge === '__QUICK_OVERDUE__') return String(quickCount('overdue'))
    return badge
  }
  const sourceGroups: ContextGroup[] = activeId === 'sprint' ? [
    {
      title: 'اسپرینت‌های فعال',
      items: activeSprints.map((sprint) => ({ label: sprint.name, path: `__SPRINT_BOARD__:${sprint.projectId}`, icon: Timer })),
    },
    ...context.groups.slice(1),
  ] : context.groups
  const groups = sourceGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, sourcePath: item.path, label: item.label === '__CURRENT_PROJECT__' ? currentProjectName ?? 'پروژه' : item.label, badge: resolvedBadge(item.badge), path: resolveContextPath(item.path, currentProjectId) })).filter((item) => item.label.includes(query.trim())),
  }))

  return (
    <div className="px-4 py-3">
      {context.searchable && (
        <label className="flex h-10 items-center gap-2 rounded-xl border border-sidebar-border bg-background/70 px-3 text-muted-foreground transition-colors focus-within:border-primary/50 focus-within:text-foreground">
          <Search className="size-4 shrink-0" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={context.placeholder} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
      )}
      <div className={cn('space-y-4', context.searchable && 'mt-4')}>
        {groups.map((group) => (
          <section key={group.title}>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const itemQuickFilter = new URLSearchParams(item.path.split('?')[1] ?? '').get('quick')
                const itemParams = new URLSearchParams(item.path.split('?')[1] ?? '')
                const [itemPathname] = item.path.split('?')
                const disabled = item.disabled
                const activeItemClass = activeId === 'reports' ? 'surface-interactive text-foreground' : 'surface-interactive text-sidebar-primary'
                const isQueryItemActive = !itemQuickFilter && !item.disabled && item.path.includes('?') && itemPathname === location.pathname
                  && [...itemParams.entries()].every(([key, value]) => new URLSearchParams(location.search).get(key) === value)
                const isPathItemActive = !item.disabled && !item.path.includes('?') && itemPathname === location.pathname
                const navigateItem = () => {
                  const reportSlug = item.sourcePath.match(/^\/report\/([^/]+)$/)?.[1]
                  const projectIntent = resolveProjectSelectionIntent(item.sourcePath)
                  if (projectIntent && !currentProjectId) {
                    onProjectSelection(projectIntent, reportSlug)
                    return
                  }

                  if (!itemQuickFilter) {
                    onNavigate(item.path)
                    return
                  }

                  const [pathname] = item.path.split('?')
                  const params = new URLSearchParams(location.search)
                  params.set('quick', itemQuickFilter)
                  onNavigate(`${pathname}?${params.toString()}`)
                }

                return <button key={`${group.title}-${item.label}`} type="button" disabled={disabled} title={item.disabled ? 'این قابلیت هنوز داده یا مدل پشتیبان ندارد.' : undefined} onClick={navigateItem} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50', itemQuickFilter !== null && itemQuickFilter === currentQuickFilter && activeItemClass, isQueryItemActive && activeItemClass, isPathItemActive && activeItemClass)}>
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex-1 text-right">{item.label}</span>
                  {item.badge && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">{item.badge}</span>}
                </button>
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function resolveProjectSelectionIntent(path: string): Exclude<ProjectSelectionIntent, 'createTask' | 'createSprint'> | undefined {
  if (path.startsWith('/report/')) return 'viewReports'

  const intentByPath: Record<string, Exclude<ProjectSelectionIntent, 'createTask' | 'createSprint'>> = {
    __PROJECT_OVERVIEW__: 'viewProjectOverview',
    __PROJECT_BACKLOG__: 'viewBacklog',
    __PROJECT_BOARD__: 'viewBoard',
    __PROJECT_TASKS__: 'viewTasks',
    __PROJECT_TIMELINE__: 'viewTimeline',
    __PROJECT_REPORTS__: 'viewReports',
    __PROJECT_SETTINGS__: 'viewProjectSettings',
    __PROJECT_APPROVALS__: 'viewApprovals',
    __PROJECT_ROLES__: 'viewProjectSettings',
    __PROJECT_TASKS_MINE__: 'viewTasks',
    __PROJECT_TASKS_CREATED_BY_ME__: 'viewTasks',
    __PROJECT_TASKS_DUE_TODAY__: 'viewTasks',
    __PROJECT_TASKS_OVERDUE__: 'viewTasks',
    __PROJECT_TASKS_COMPLETED__: 'viewTasks',
  }

  return intentByPath[path]
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveActiveModule(pathname: string) {
  if (pathname === '/tasks') return modules.find((module) => module.id === 'tasks')!
  const projectRoute = pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/)?.[1]
  if (projectRoute === 'overview' || projectRoute === undefined && pathname === '/projects') return modules.find((module) => module.id === 'projects')!
  if (projectRoute === 'tasks') return modules.find((module) => module.id === 'tasks')!
  if (projectRoute === 'backlog' || projectRoute === 'timeline') return modules.find((module) => module.id === 'backlog')!
  if (projectRoute === 'board') return modules.find((module) => module.id === 'sprint')!
  if (projectRoute === 'reports') return modules.find((module) => module.id === 'reports')!
  if (projectRoute === 'settings' || projectRoute === 'roles' || projectRoute === 'workflow' || projectRoute === 'approvals') return modules.find((module) => module.id === 'settings')!
  if (pathname === '/admin/users') return modules.find((module) => module.id === 'users')!
  if (['/roles', '/subscription', '/admin/plans'].includes(pathname) || pathname.endsWith('/settings')) return modules.find((module) => module.id === 'settings')!
  return modules.find((module) => module.path === pathname) ?? modules[0]
}
