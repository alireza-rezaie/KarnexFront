import { useNavigate } from 'react-router-dom'
import {
  FolderKanban, Lock, Globe, Users, Edit3, ChevronLeft,
  ListTodo, Timer, CheckCircle2, ShieldCheck
} from 'lucide-react'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { chartTheme } from '@/lib/chart-theme'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectStatus } from '@/contexts/ProjectStatusContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useSprints } from '@/contexts/SprintsContext'
import { useMembers } from '@/contexts/MembersContext'
import { UserAvatar } from '@/components/UserAvatar'
import { getProjectMethodologyCapabilities } from '@/utils/projectMethodology'
import { useOptionalTerminalStatusPolicy } from '@/contexts/TerminalStatusPolicyContext'

export default function ProjectOverviewPage() {
  const navigate = useNavigate()
  const { currentProject: project, projectExists } = useProject()
  const { statuses } = useProjectStatus()
  const { tasks: projectTasks } = useProjectTasks()
  const { sprints } = useSprints()
  const { members } = useMembers()
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy()
  if (!projectExists || !project) return <div>پروژه پیدا نشد</div>
  const projectPath = `/projects/${project.id}`
  const methodology = getProjectMethodologyCapabilities(project.type)
  const projectSprints = sprints.filter(s => s.projectId === project.id)
  const getSprintTaskCount = (sprintId: string) => projectTasks.filter(
    (task) => task.projectId === project.id && task.sprintId === sprintId,
  ).length
  const getStatusCount = (statusId: string) => projectTasks.filter(task => task.status === statusId).length
  const inProgressStatus = statuses.find(status => status.id === 'inprogress')
  const completedTasks = projectTasks.filter((task) => terminalStatusPolicy?.isTaskCompleted(project.id, task) ?? false).length
  const statusData = statuses.map((status) => ({ name: status.name, value: getStatusCount(status.id), color: status.color }))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate('/projects')} className="hover:text-foreground transition-colors">پروژه‌ها</button>
        <ChevronLeft className="w-3 h-3" />
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Project Header */}
      <div className="karnex-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: project.color + '20' }}>
              <FolderKanban className="w-7 h-7" style={{ color: project.color }} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                <button onClick={() => navigate(`${projectPath}/settings`)} className="p-1 rounded hover:bg-secondary transition-colors" aria-label="ویرایش پروژه">
                  <Edit3 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{project.key}</span>
                <span className="text-xs text-muted-foreground">|</span>
                {project.privacy === 'private' ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" /> خصوصی
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="w-3 h-3" /> عمومی
                  </span>
                )}
                <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{project.status === 'active' ? 'فعال' : 'متوقف'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(`${projectPath}/roles`)} className="app-action" aria-label="نقش‌ها و دسترسی‌های پروژه">
              <ShieldCheck className="w-4 h-4" />
              نقش‌ها و دسترسی‌ها
            </button>
            <div className="flex -space-x-2">
              {project.members.slice(0, 4).map((memberId, i) => {
                const member = members.find(m => m.id === memberId)
                return (
                  <UserAvatar key={i} avatarId={member?.avatarId} name={member?.name} className="w-8 h-8 border-2 border-background" />
                )
              })}
              {project.members.length > 4 && (
                <span className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground mr-[-6px]">+{project.members.length - 4}</span>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4">{project.description}</p>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">پیشرفت پروژه</span>
            <span className="text-xs font-medium text-foreground">{project.progress}٪</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, backgroundColor: project.color }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="karnex-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ListTodo className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground">کل وظایف</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{projectTasks.length}</span>
        </div>
        <div className="karnex-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Timer className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-xs text-muted-foreground">{inProgressStatus?.name ?? 'در حال انجام'}</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{inProgressStatus ? getStatusCount(inProgressStatus.id) : 0}</span>
        </div>
        <div className="karnex-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground">تکمیل‌شده</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{completedTasks}</span>
        </div>
        <div className="karnex-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground">اعضا</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{project.members.length}</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="karnex-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-4">وضعیت وظایف</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTheme.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {statusData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="karnex-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-4">پیشرفت برنامه‌ریزی‌شده vs واقعی</h3>
          <div className="grid h-48 place-items-center rounded-xl border border-dashed border-border bg-secondary/20 px-4 text-center text-sm text-muted-foreground">
            دادهٔ تاریخیِ برنامه‌ریزی‌شده و واقعی هنوز ثبت نشده است.
          </div>
        </div>
      </div>

      {/* Sprints */}
      {methodology.supportsSprints && <div className="karnex-card p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4">اسپرینت‌ها</h3>
        <div className="space-y-3">
          {projectSprints.map((sprint) => (
            <div key={sprint.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div>
                <h4 className="text-xs font-medium text-foreground">{sprint.name}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sprint.goal}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">{getSprintTaskCount(sprint.id)} وظیفه</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  sprint.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {sprint.status === 'active' ? 'فعال' : 'برنامه‌ریزی‌شده'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* Recent Tasks */}
      <div className="karnex-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground">وظایف اخیر</h3>
          <button onClick={() => navigate(`${projectPath}/tasks`)} className="text-xs text-primary hover:underline">مشاهده همه</button>
        </div>
        <div className="space-y-2">
          {projectTasks.slice(0, 5).map((task) => {
            const assignee = members.find(m => m.id === task.assignee)
            const status = statuses.find((item) => item.id === task.status) ?? { id: task.status, name: 'بدون وضعیت', color: '#6b7280' }
            return (
              <div key={task.id} onClick={() => navigate(`${projectPath}/tasks/${task.id}`)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer">
                <span className="text-[10px] text-muted-foreground">{task.key}</span>
                <p className="flex-1 text-xs text-foreground truncate">{task.title}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}26`, color: status.color }}>{status.name}</span>
                {assignee && <UserAvatar avatarId={assignee.avatarId} name={assignee.name} className="w-5 h-5" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
