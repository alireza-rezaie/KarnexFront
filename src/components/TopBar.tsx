import { useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Search,
  Plus,
  Bell,
  Moon,
  Sun,
  HelpCircle,
  ChevronDown,
  FolderKanban,
  ListTodo,
  Timer,
  UserPlus,
  Settings,
  LogOut,
  User,
  Menu,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useMembers } from '@/contexts/MembersContext'
import { useProjects } from '@/contexts/ProjectsContext'
import { useOptionalProject } from '@/contexts/ProjectContext'
import { Toaster } from '@/components/ui/sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ProjectSelectionDialog from '@/components/ProjectSelectionDialog'
import { projectCreationDestination, type ProjectSelectionIntent } from '@/lib/project-creation-navigation'
import { toast } from 'sonner'
import { useNotificationFeed } from '@/contexts/NotificationFeedContext'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'

interface TopBarProps {
  onMenuClick?: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { resolvedTheme, setTheme } = useTheme()
  const { currentMember } = useCurrentUser()
  const { logout, isSystemAdmin, capabilities: authCapabilities, loading: authLoading } = useAuth()
  const { projects } = useProjects()
  const { members } = useMembers()
  const projectContext = useOptionalProject()
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    serviceAvailable: notificationsAvailable,
    canMarkAsRead,
    feedCopy,
    markAsRead,
  } = useNotificationFeed()
  const [notifOpen, setNotifOpen] = useState(false)
  const [creationIntent, setCreationIntent] = useState<Extract<ProjectSelectionIntent, 'createTask' | 'createSprint'> | null>(null)
  const canMarkIndividual = notificationsAvailable && canMarkAsRead && Boolean(markAsRead)
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const projectResults = useMemo(() => {
    if (!normalizedSearchQuery) return []

    return projects.filter((project) => (
      [project.name, project.key, project.description]
        .some((field) => field.toLocaleLowerCase().includes(normalizedSearchQuery))
    )).slice(0, 5)
  }, [normalizedSearchQuery, projects])
  const memberResults = useMemo(() => {
    if (!normalizedSearchQuery) return []

    return members.filter((member) => (
      [member.name, member.email, member.jobTitle]
        .some((field) => field.toLocaleLowerCase().includes(normalizedSearchQuery))
    )).slice(0, 5)
  }, [members, normalizedSearchQuery])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }

  const navigateToCreationFlow = (projectId: string, intent: Extract<ProjectSelectionIntent, 'createTask' | 'createSprint'>) => {

    const destination = projectCreationDestination(projectId, intent)
    navigate(destination.pathname, { state: destination.state })
    setCreationIntent(null)
  }

  const startCreation = (intent: Extract<ProjectSelectionIntent, 'createTask' | 'createSprint'>) => {
    if (projectContext?.currentProject) {
      navigateToCreationFlow(projectContext.currentProject.id, intent)
      return
    }

    setCreationIntent(intent)
  }
  const signOut = async () => {
    if (!logout || authLoading || !authCapabilities.canLogout) return

    const result = await logout()
    if (result.ok) {
      navigate(result.nextPath ?? '/login')
      return
    }
    toast.error(result.message ?? 'خروج از حساب ناموفق بود.')
  }

  return (
    <>
    <header className="flex h-14 min-w-0 items-center gap-1.5 border-b border-border bg-background/80 px-2 backdrop-blur-lg sm:gap-3 sm:px-4">
      {/* Right: Search */}
      <div className="flex items-center gap-2 flex-1">
        {onMenuClick && (
          <button type="button" onClick={onMenuClick} aria-label="باز کردن منوی کناری" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden">
            <Menu className="size-4" />
          </button>
        )}
        <button 
          onClick={() => setSearchOpen(true)}
          className="hidden w-40 items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-muted-foreground transition-all hover:border-border/80 hover:text-foreground sm:flex lg:w-64"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">جستجو...</span>
          <div className="mr-auto flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-background border border-border rounded">⌘</kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-background border border-border rounded">S</kbd>
          </div>
        </button>
      </div>

      {/* Left: Actions */}
      <div className="flex items-center gap-1">
        {/* Create Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="app-action">
              <Plus className="w-4 h-4" />
              <span className="hidden text-xs font-medium sm:inline">ایجاد</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem onClick={() => navigate('/projects', { state: { openCreateProject: true } })} className="flex items-center gap-2 cursor-pointer">
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs">پروژه جدید</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => startCreation('createTask')} className="flex items-center gap-2 cursor-pointer">
              <ListTodo className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs">وظیفه جدید</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => startCreation('createSprint')} className="flex items-center gap-2 cursor-pointer">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs">اسپرینت جدید</span>
            </DropdownMenuItem>
            {isSystemAdmin && <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/admin/users')} className="flex items-center gap-2 cursor-pointer">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs">مدیریت کاربران</span>
              </DropdownMenuItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <button 
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={resolvedTheme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
          title={resolvedTheme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
          className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Help */}
        <button
          onClick={() => toast.info('راهنمای محصول پس از تعیین جریان پشتیبانی در دسترس خواهد بود.')}
          className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:block"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)] bg-card border-border">
            <div dir="rtl" className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-semibold">اعلان‌ها</span>
              <span className="text-[10px] text-muted-foreground">همه‌ی اعلان‌ها</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notificationsLoading ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{feedCopy.loading}</p>
              ) : !notificationsAvailable ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{feedCopy.unavailable}</p>
              ) : notifications.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{feedCopy.empty}</p>
              ) : notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={canMarkIndividual && markAsRead ? () => void markAsRead(notif.id) : undefined}
                  className={cn(
                    "p-3 border-b border-border last:border-0 transition-colors",
                    canMarkIndividual ? "cursor-pointer hover:bg-secondary/50" : "cursor-default",
                    !notif.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">{notif.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <UserAvatar avatarId={currentMember?.avatarId} name={currentMember?.name} className="h-7 w-7 border border-border" />
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">{currentMember?.name ?? 'کاربر'}</p>
              <p className="text-[11px] text-muted-foreground">{currentMember?.email ?? ''}</p>
            </div>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="flex items-center gap-2 cursor-pointer">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs">پروفایل</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="flex items-center gap-2 cursor-pointer">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs">تنظیمات</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!logout || authLoading || !authCapabilities.canLogout}
              onClick={() => void signOut()}
              className="flex items-center gap-2 cursor-pointer text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs">خروج</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <Dialog open={searchOpen} onOpenChange={(open) => { if (open) setSearchOpen(true); else closeSearch() }}>
      <DialogContent dir="rtl" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>جستجوی سراسری</DialogTitle>
          <DialogDescription>پروژه‌ها و اعضای workspace را جستجو کنید.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="نام پروژه، کلید، عضو یا ایمیل..."
            className="h-10 w-full rounded-lg border border-border bg-secondary/30 py-2 pr-10 pl-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="max-h-80 space-y-4 overflow-y-auto">
          {!normalizedSearchQuery && (
            <p className="py-8 text-center text-sm text-muted-foreground">برای شروع، عبارت جستجو را وارد کنید.</p>
          )}
          {normalizedSearchQuery && projectResults.length === 0 && memberResults.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">نتیجه‌ای پیدا نشد.</p>
          )}
          {projectResults.length > 0 && (
            <section className="space-y-1">
              <h3 className="px-2 text-xs font-semibold text-muted-foreground">پروژه‌ها</h3>
              {projectResults.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    navigate(`/projects/${project.id}/overview`)
                    closeSearch()
                  }}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-right transition-colors hover:bg-secondary"
                >
                  <span className="text-sm font-medium">{project.name}</span>
                  <span className="text-xs text-muted-foreground">پروژه · {project.key}</span>
                </button>
              ))}
            </section>
          )}
          {memberResults.length > 0 && (
            <section className="space-y-1">
              <h3 className="px-2 text-xs font-semibold text-muted-foreground">اعضا</h3>
              {memberResults.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <UserAvatar avatarId={member.avatarId} name={member.name} className="size-7 border border-border" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="truncate text-xs text-muted-foreground">عضو · {member.jobTitle}</span>
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <ProjectSelectionDialog intent={creationIntent} onClose={() => setCreationIntent(null)} onSelect={navigateToCreationFlow} />
    <Toaster />
    </>
  )
}
