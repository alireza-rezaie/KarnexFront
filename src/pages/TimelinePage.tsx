import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useSprints } from '@/contexts/SprintsContext'
import { toJalaliDate } from '@/utils/jalaliDate'

type TimelineItem = {
  id: string
  title: string
  kind: 'sprint' | 'task'
  color: string
  start: number
  end: number
}

type TimelineItemWithoutRange = {
  id: string
  title: string
  kind: 'sprint' | 'task'
}

type TimelineScale = 'week' | 'month' | 'quarter'

const scaleConfig: Record<TimelineScale, { label: string; days: number; gridLabels: string[] }> = {
  week: { label: 'هفته', days: 7, gridLabels: ['روز ۱', 'روز ۲', 'روز ۳', 'روز ۴', 'روز ۵', 'روز ۶', 'روز ۷'] },
  month: { label: 'ماه', days: 31, gridLabels: ['هفته ۱', 'هفته ۲', 'هفته ۳', 'هفته ۴'] },
  quarter: { label: 'فصل', days: 93, gridLabels: ['ماه ۱', 'ماه ۲', 'ماه ۳'] },
}

const toTimelineDate = (value: string | undefined) => {
  const date = toJalaliDate(value)
  return date ? date.year * 372 + (date.month - 1) * 31 + date.day : undefined
}

const sprintColor = (status: 'active' | 'planned' | 'completed') => {
  if (status === 'active') return '#3b82f6'
  if (status === 'completed') return '#22c55e'
  return '#f59e0b'
}

export default function TimelinePage() {
  const navigate = useNavigate()
  const { currentProject, projectExists } = useProject()
  const { tasks } = useProjectTasks()
  const { sprints } = useSprints()
  const [scale, setScale] = useState<TimelineScale>('month')
  const { timelineItems, itemsWithoutRange } = useMemo(() => {
    if (!currentProject) return { timelineItems: [] as TimelineItem[], itemsWithoutRange: [] as TimelineItemWithoutRange[] }

    const runtimeItems: TimelineItem[] = []
    const withoutRange: TimelineItemWithoutRange[] = []

    sprints
      .filter((sprint) => sprint.projectId === currentProject.id)
      .forEach((sprint) => {
        const start = toTimelineDate(sprint.startDate)
        const end = toTimelineDate(sprint.endDate)

        if (start === undefined || end === undefined || end < start) {
          withoutRange.push({ id: sprint.id, title: sprint.name, kind: 'sprint' })
          return
        }

        runtimeItems.push({ id: sprint.id, title: sprint.name, kind: 'sprint', color: sprintColor(sprint.status), start, end })
      })

    tasks
      .filter((task) => task.projectId === currentProject.id)
      .forEach((task) => {
        const start = toTimelineDate(task.createdAt)
        const end = toTimelineDate(task.dueDate)

        if (start === undefined || end === undefined || end < start) {
          withoutRange.push({ id: task.id, title: task.title, kind: 'task' })
          return
        }

        runtimeItems.push({ id: task.id, title: task.title, kind: 'task', color: '#8b5cf6', start, end })
      })

    return {
      timelineItems: runtimeItems.sort((first, second) => first.start - second.start || first.end - second.end),
      itemsWithoutRange: withoutRange,
    }
  }, [currentProject, sprints, tasks])

  const scaleWindow = useMemo(() => {
    const config = scaleConfig[scale]
    const end = timelineItems.reduce((latest, item) => Math.max(latest, item.end), 0)
    const start = end ? end - config.days + 1 : 0

    return { ...config, start, end }
  }, [scale, timelineItems])
  const visibleTimelineItems = timelineItems.filter(
    (item) => item.end >= scaleWindow.start && item.start <= scaleWindow.end,
  )

  if (!projectExists || !currentProject) return <div>پروژه پیدا نشد</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate(`/projects/${currentProject.id}/overview`)} className="hover:text-foreground">پروژه</button>
        <ChevronLeft className="w-3 h-3" />
        <span className="text-foreground">تایم‌لاین</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">تایم‌لاین پروژه</h1>
        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
          {(Object.keys(scaleConfig) as TimelineScale[]).map((value) => (
            <button key={value} type="button" onClick={() => setScale(value)} aria-pressed={scale === value} className={`px-3 py-1.5 rounded-lg text-xs transition ${scale === value ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{scaleConfig[value].label}</button>
          ))}
        </div>
      </div>

      <div className="karnex-card p-5 overflow-x-auto">
        {timelineItems.length ? <div className="min-w-[600px]">
          <div className="flex justify-between border-b border-border mb-4 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{currentProject.name}</span>
            <span>نمای {scaleWindow.label} بر اساس آخرین پایان معتبر</span>
          </div>
          <div className="grid border-b border-border/60 text-center text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${scaleWindow.gridLabels.length}, minmax(0, 1fr))` }}>
            {scaleWindow.gridLabels.map((label) => <span key={label} className="border-s border-border/40 px-2 py-2 first:border-s-0">{label}</span>)}
          </div>
          <div className="space-y-3">
            {visibleTimelineItems.map(item => {
              const clippedStart = Math.max(item.start, scaleWindow.start)
              const clippedEnd = Math.min(item.end, scaleWindow.end)
              const left = ((clippedStart - scaleWindow.start) / scaleWindow.days) * 100
              const width = ((clippedEnd - clippedStart + 1) / scaleWindow.days) * 100
              return <div key={`${item.kind}-${item.id}`} className="flex items-center">
                <div className="w-32 flex-shrink-0"><p className="text-xs text-foreground truncate">{item.title}</p><span className="text-[9px] text-muted-foreground">{item.kind === 'sprint' ? 'اسپرینت' : 'وظیفه'}</span></div>
                <div className="flex-1 relative h-8 bg-secondary/30 rounded-lg overflow-hidden">
                  <div className="absolute top-1 h-6 min-w-2 rounded-md flex items-center px-2" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: item.color + '30', borderLeft: `3px solid ${item.color}` }}>
                    <span className="text-[9px] text-foreground truncate">{item.title}</span>
                  </div>
                </div>
              </div>
            })}
          </div>
          {!visibleTimelineItems.length && <div className="grid min-h-32 place-items-center text-center text-xs text-muted-foreground">آیتمی در بازه {scaleWindow.label} انتخاب‌شده وجود ندارد.</div>}
        </div> : <div className="grid min-h-40 place-items-center text-center text-xs text-muted-foreground">آیتمی با بازه زمانی معتبر برای نمایش وجود ندارد.</div>}
      </div>

      {!!itemsWithoutRange.length && <div className="karnex-card p-5">
        <h2 className="text-sm font-semibold text-foreground">آیتم‌های بدون بازه زمانی معتبر</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {itemsWithoutRange.map(item => <span key={`${item.kind}-${item.id}`} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{item.kind === 'sprint' ? 'اسپرینت' : 'وظیفه'}: {item.title}</span>)}
        </div>
      </div>}
    </div>
  )
}
