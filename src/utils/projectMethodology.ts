import type { Project } from '@/types/project'
import type { Task } from '@/types/task'

export type BoardWorkSelectionMode = 'active-sprint' | 'continuous-flow' | 'project-work'

export type ProjectMethodologyCapabilities = {
  supportsSprints: boolean
  supportsBacklog: boolean
  supportsWipLimits: boolean
  boardWorkSelectionMode: BoardWorkSelectionMode
}

const methodologyCapabilities: Record<Project['type'], ProjectMethodologyCapabilities> = {
  scrum: {
    supportsSprints: true,
    supportsBacklog: true,
    supportsWipLimits: false,
    boardWorkSelectionMode: 'active-sprint',
  },
  kanban: {
    supportsSprints: false,
    // A Kanban backlog is optional in Jira, but this frontend supports it when
    // teams choose to keep upcoming work outside the continuous-flow board.
    supportsBacklog: true,
    supportsWipLimits: true,
    boardWorkSelectionMode: 'continuous-flow',
  },
  basic: {
    supportsSprints: false,
    supportsBacklog: false,
    supportsWipLimits: false,
    boardWorkSelectionMode: 'project-work',
  },
}

export function getProjectMethodologyCapabilities(
  methodology: Project['type'] | undefined,
): ProjectMethodologyCapabilities {
  return methodologyCapabilities[methodology ?? 'basic']
}

export function selectBoardWork(
  mode: BoardWorkSelectionMode,
  tasks: Task[],
  activeSprintId: string | undefined,
  kanbanBacklogEnabled = false,
): Task[] {
  if (mode === 'active-sprint') return activeSprintId ? tasks.filter((task) => task.sprintId === activeSprintId) : []
  if (mode === 'continuous-flow') return kanbanBacklogEnabled ? tasks.filter((task) => !task.inKanbanBacklog) : tasks
  return tasks
}
