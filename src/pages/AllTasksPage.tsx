import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ClipboardList, FolderKanban, ArrowUpLeft } from 'lucide-react'
import { useTasks } from '@/contexts/TasksContext'
import { useProjects } from '@/contexts/ProjectsContext'
import { toPersianDigits } from '@/lib/persian-numbers'
import { priorityConfig, typeConfig } from '@/config/taskMetadata'

const statusLabels: Record<string, string> = {
  todo: 'برای انجام',
  inprogress: 'در حال انجام',
  review: 'در حال بررسی',
  done: 'تکمیل‌شده',
}

export default function AllTasksPage() {
  const navigate = useNavigate()
  const { tasks, loading, refreshTasks } = useTasks()
  const { projects } = useProjects()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa')
    return tasks.filter((task) => {
      const matchesSearch = !query
        || task.title.toLocaleLowerCase('fa').includes(query)
        || task.key.toLocaleLowerCase('fa').includes(query)
      return matchesSearch
        && (projectFilter === 'all' || task.projectId === projectFilter)
        && (statusFilter === 'all' || task.status === statusFilter)
    })
  }, [tasks, search, projectFilter, statusFilter])

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">همه وظایف</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {toPersianDigits(filteredTasks.length)} وظیفه در تمام پروژه‌ها
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshTasks().catch(() => undefined)}
          className="app-action"
        >
          بروزرسانی
        </button>
      </header>

      <section className="karnex-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو بر اساس عنوان یا کد وظیفه..."
              className="surface-inset h-10 w-full rounded-xl pr-9 pl-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="surface-inset h-10 min-w-[170px] rounded-xl px-3 text-xs text-foreground outline-none"
          >
            <option value="all">همه پروژه‌ها</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="surface-inset h-10 min-w-[150px] rounded-xl px-3 text-xs text-foreground outline-none"
          >
            <option value="all">همه وضعیت‌ها</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">در حال دریافت وظایف…</p>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="size-9 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">وظیفه‌ای پیدا نشد</p>
            <p className="text-xs text-muted-foreground">عبارت جستجو یا فیلترها را تغییر دهید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-right">
              <thead className="border-b border-border/70 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">کد / عنوان</th>
                  <th className="px-3 py-3 font-medium">پروژه</th>
                  <th className="px-3 py-3 font-medium">نوع</th>
                  <th className="px-3 py-3 font-medium">وضعیت</th>
                  <th className="px-3 py-3 font-medium">اولویت</th>
                  <th className="px-3 py-3 font-medium">سررسید</th>
                  <th className="px-3 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const project = projects.find((item) => item.id === task.projectId)
                  const priority = priorityConfig[task.priority]
                  const type = typeConfig[task.type]
                  return (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/projects/${task.projectId}/tasks/${task.id}`)}
                      className="cursor-pointer border-b border-border/50 text-xs transition-colors hover:bg-accent/50"
                    >
                      <td className="px-3 py-3">
                        <span className="block text-[10px] text-muted-foreground">{toPersianDigits(task.key)}</span>
                        <span className="mt-1 block font-semibold text-foreground">{task.title}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <FolderKanban className="size-3.5" />
                          {project?.name ?? 'پروژه نامشخص'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-lg px-2 py-1 text-[10px]" style={{ backgroundColor: type.bgColor, color: type.color }}>
                          {type.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{statusLabels[task.status] ?? task.status}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full px-2 py-1 text-[10px]" style={{ backgroundColor: priority.bgColor, color: priority.color }}>
                          {priority.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{task.dueDate ? toPersianDigits(task.dueDate) : '—'}</td>
                      <td className="px-3 py-3 text-left">
                        <ArrowUpLeft className="size-4 text-muted-foreground" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
