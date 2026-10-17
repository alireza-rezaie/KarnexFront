import { jalaliToGregorian, parseJalaliDate, toJalaliComparableDate } from '@/utils/jalaliDate'
import type { Member } from '@/types/member'
import type { Sprint } from '@/types/sprint'
import type { StatusDefinition } from '@/types/status'
import type { Task } from '@/types/task'

export type ReportMetric = { label: string; value: number | string }

const storyPoints = (task: Task) => task.storyPoints ?? 0
const isCompleted = (terminalStatusIds: readonly string[]) => {
  const terminalStatuses = new Set(terminalStatusIds)
  return (task: Task) => terminalStatuses.has(task.status)
}
const percent = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

const jalaliDaysBetween = (start: string, end: string) => {
  const startDate = parseJalaliDate(start)
  const endDate = parseJalaliDate(end)
  if (!startDate || !endDate) return undefined

  const from = jalaliToGregorian(startDate.year, startDate.month, startDate.day)
  const to = jalaliToGregorian(endDate.year, endDate.month, endDate.day)
  return Math.max(1, Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000))
}

export function buildBurndownReport(tasks: Task[], sprints: Sprint[], terminalStatusIds: readonly string[]) {
  const sprint = sprints.find((item) => item.status === 'active') ?? sprints[0]
  const sprintTasks = sprint ? tasks.filter((task) => task.sprintId === sprint.id) : tasks
  const initial = sum(sprintTasks.map(storyPoints))
  const completed = sum(sprintTasks.filter(isCompleted(terminalStatusIds)).map(storyPoints))
  const remaining = Math.max(0, initial - completed)

  return {
    // A burndown needs persisted task-status snapshots. The frontend runtime only
    // knows the current task state, so it must not manufacture a timeline.
    data: [] as { day: string; ideal?: number; actual?: number }[],
    sprintTasks,
    metrics: [
      { label: 'کار اولیه', value: initial },
      { label: 'کار باقی‌مانده', value: remaining },
      { label: 'تکمیل', value: `${percent(completed, initial)}٪` },
      { label: 'نقاط تاریخی', value: 0 },
    ] satisfies ReportMetric[],
  }
}

export function buildVelocityReport(tasks: Task[], sprints: Sprint[], terminalStatusIds: readonly string[]) {
  const rows = sprints
    .filter((sprint) => sprint.status === 'completed')
    .sort((left, right) => (toJalaliComparableDate(left.startDate) ?? 0) - (toJalaliComparableDate(right.startDate) ?? 0))
    .map((sprint) => {
      const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id)
      const committed = sum(sprintTasks.map(storyPoints))
      const completed = sum(sprintTasks.filter(isCompleted(terminalStatusIds)).map(storyPoints))
      return { id: sprint.id, sprint: sprint.name, committed, completed, completion: percent(completed, committed), difference: completed - committed }
    })
  const completedValues = rows.map((row) => row.completed)
  const committed = sum(rows.map((row) => row.committed))
  const completed = sum(completedValues)

  return {
    rows,
    metrics: [
      { label: 'میانگین Velocity', value: rows.length ? Math.round(completed / rows.length) : 0 },
      { label: 'Velocity آخرین اسپرینت', value: rows.at(-1)?.completed ?? 0 },
      { label: 'بیشترین Velocity', value: Math.max(0, ...completedValues) },
      { label: 'تحقق Commitment', value: `${percent(completed, committed)}٪` },
    ] satisfies ReportMetric[],
  }
}

export function buildCumulativeFlowReport(tasks: Task[], statuses: StatusDefinition[], terminalStatusIds: readonly string[]) {
  const areas = statuses.map((status) => ({ key: status.id, label: status.name, color: status.color, count: tasks.filter((task) => task.status === status.id).length }))

  const total = tasks.length
  const terminalStatuses = new Set(terminalStatusIds)
  const done = areas.filter((area) => terminalStatuses.has(area.key)).reduce((totalCount, area) => totalCount + area.count, 0)
  const wip = areas.filter((area) => area.key !== 'todo' && !terminalStatuses.has(area.key)).reduce((totalCount, area) => totalCount + area.count, 0)

  return {
    areas,
    // CFD is historical by definition. Current status totals are useful metrics,
    // but they are not a substitute for status-change snapshots.
    data: [] as Record<string, string | number>[],
    metrics: [
      { label: 'کل آیتم‌ها', value: total },
      { label: 'کار در جریان', value: wip },
      { label: 'انجام‌شده', value: done },
      { label: 'نسبت WIP', value: `${percent(wip, total)}٪` },
    ] satisfies ReportMetric[],
  }
}

export function buildControlChartReport(tasks: Task[], members: Member[], terminalStatusIds: readonly string[]) {
  const rows = tasks.filter(isCompleted(terminalStatusIds)).map((task, index) => {
    const cycleTime = jalaliDaysBetween(task.createdAt, task.updatedAt) ?? 1
    return {
      id: task.id,
      index: index + 1,
      key: task.key,
      title: task.title,
      assignee: members.find((member) => member.id === task.assignee)?.name ?? '—',
      cycleTime,
      completedAt: task.updatedAt,
    }
  })
  const values = rows.map((row) => row.cycleTime).sort((left, right) => left - right)
  const average = values.length ? Number((sum(values) / values.length).toFixed(1)) : 0
  const middle = Math.floor(values.length / 2)
  const median = values.length ? Number((values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2).toFixed(1)) : 0

  return {
    rows,
    average,
    median,
    metrics: [
      { label: 'میانگین Cycle Time', value: `${average} روز` },
      { label: 'میانه', value: `${median} روز` },
      { label: 'کمینه', value: `${values[0] ?? 0} روز` },
      { label: 'بیشینه', value: `${values.at(-1) ?? 0} روز` },
    ] satisfies ReportMetric[],
  }
}

export function buildCreatedResolvedReport(tasks: Task[], terminalStatusIds: readonly string[]) {
  const buckets = new Map<string, { date: string; order: number; created: number; resolved: number }>()
  const add = (date: string, key: 'created' | 'resolved') => {
    const order = toJalaliComparableDate(date)
    if (!order) return
    const bucket = buckets.get(date) ?? { date, order, created: 0, resolved: 0 }
    bucket[key] += 1
    buckets.set(date, bucket)
  }

  tasks.forEach((task) => {
    add(task.createdAt, 'created')
    if (isCompleted(terminalStatusIds)(task)) add(task.updatedAt, 'resolved')
  })
  const data = [...buckets.values()].sort((left, right) => left.order - right.order)
  const created = sum(data.map((item) => item.created))
  const resolved = sum(data.map((item) => item.resolved))

  return {
    data,
    metrics: [
      { label: 'ایجادشده', value: created },
      { label: 'حل‌شده', value: resolved },
      { label: 'تغییر خالص', value: created - resolved },
      { label: 'نسبت حل', value: `${percent(resolved, created)}٪` },
    ] satisfies ReportMetric[],
  }
}
