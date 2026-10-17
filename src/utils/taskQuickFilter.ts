import { toJalaliComparableDate } from '@/utils/jalaliDate'

export const quickTaskFilterValues = ['mine', 'due-today', 'overdue', 'created-by-me', 'completed'] as const
export type QuickTaskFilter = typeof quickTaskFilterValues[number]

type QuickFilterTask = {
  projectId: string
  assignee: string
  reporter: string
  dueDate?: string
  status: string
}

export const parseQuickTaskFilter = (value: string | null): QuickTaskFilter | undefined => (
  quickTaskFilterValues.find((filter) => filter === value)
)

export function filterTasksByQuickFilter<T extends QuickFilterTask>(
  tasks: T[],
  projectId: string | undefined,
  quickFilter: QuickTaskFilter | undefined,
  currentMemberId: string | undefined,
  today: number | undefined,
  terminalStatusIds: readonly string[],
) {
  const projectTasks = projectId
    ? tasks.filter((task) => task.projectId === projectId)
    : []

  if (!quickFilter) return projectTasks
  if (quickFilter === 'mine') {
    return currentMemberId
      ? projectTasks.filter((task) => task.assignee === currentMemberId)
      : []
  }

  if (quickFilter === 'created-by-me') {
    return currentMemberId
      ? projectTasks.filter((task) => task.reporter === currentMemberId)
      : []
  }

  const terminalStatuses = new Set(terminalStatusIds)
  if (quickFilter === 'completed') return projectTasks.filter((task) => terminalStatuses.has(task.status))

  if (today === undefined) return []

  return projectTasks.filter((task) => {
    const dueDate = toJalaliComparableDate(task.dueDate)
    if (dueDate === undefined) return false
    if (quickFilter === 'due-today') return dueDate === today

    return dueDate < today && !terminalStatuses.has(task.status)
  })
}
