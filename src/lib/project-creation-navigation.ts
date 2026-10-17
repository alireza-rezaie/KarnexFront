export type ProjectSelectionIntent =
  | 'viewProjectOverview'
  | 'viewTasks'
  | 'viewBacklog'
  | 'viewBoard'
  | 'viewTimeline'
  | 'viewReports'
  | 'viewProjectSettings'
  | 'viewApprovals'
  | 'createTask'
  | 'createSprint'

export function projectSelectionDestination(
  projectId: string,
  intent: Exclude<ProjectSelectionIntent, 'createTask' | 'createSprint'>,
) {
  const segmentByIntent = {
    viewProjectOverview: 'overview',
    viewTasks: 'tasks',
    viewBacklog: 'backlog',
    viewBoard: 'board',
    viewTimeline: 'timeline',
    viewReports: 'reports',
    viewProjectSettings: 'settings',
    viewApprovals: 'approvals',
  } as const

  return `/projects/${projectId}/${segmentByIntent[intent]}`
}

export function projectCreationDestination(
  projectId: string,
  intent: Extract<ProjectSelectionIntent, 'createTask' | 'createSprint'>,
) {
  return intent === 'createTask'
    ? { pathname: `/projects/${projectId}/tasks`, state: { openCreateTask: true } }
    : { pathname: `/projects/${projectId}/backlog`, state: { openCreateSprint: true } }
}
