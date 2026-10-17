import type { ProjectBoardConfiguration } from '@/types/board'
import type { PublishedWorkflowVersion } from '@/types/workflow'

type TaskCompletionCandidate = { projectId: string; status: string }

/**
 * Resolves terminal statuses from the rightmost effective Board column of one
 * project. Workflow status IDs are the only source of truth; labels and legacy
 * status IDs are deliberately not considered.
 */
export function getTerminalStatusIds(
  projectId: string,
  boardConfiguration: ProjectBoardConfiguration | undefined,
  activeWorkflow: PublishedWorkflowVersion | undefined,
): string[] {
  if (!projectId || boardConfiguration?.projectId !== projectId || !activeWorkflow) return []

  const finalOrder = boardConfiguration.columns.reduce<number | undefined>((latest, column) => (
    latest === undefined || column.order > latest ? column.order : latest
  ), undefined)
  if (finalOrder === undefined) return []

  const activeStatusIds = new Set(activeWorkflow.statuses.map((status) => status.id))
  return [...new Set(boardConfiguration.columns
    .filter((column) => column.order === finalOrder)
    .flatMap((column) => column.statusIds)
    .filter((statusId) => activeStatusIds.has(statusId)))]
}

export function isTaskCompleted(
  projectId: string,
  task: TaskCompletionCandidate,
  boardConfiguration: ProjectBoardConfiguration | undefined,
  activeWorkflow: PublishedWorkflowVersion | undefined,
): boolean {
  return task.projectId === projectId
    && getTerminalStatusIds(projectId, boardConfiguration, activeWorkflow).includes(task.status)
}
