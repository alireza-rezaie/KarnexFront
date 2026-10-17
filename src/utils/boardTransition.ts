import type { TaskTransitionExecutionResult, TaskTransitionResolutionResult } from '@/types/taskTransition'
import type { WorkflowTransition } from '@/types/workflow'

export type SimpleBoardDropResult =
  | { kind: 'ready'; transitionId: string }
  | { kind: 'multi-status-destination' }
  | { kind: 'no-matching-transition' }
  | { kind: 'multiple-matching-transitions' }
  | { kind: 'resolution-failed'; resolution: Extract<TaskTransitionResolutionResult, { ok: false }> }
  | { kind: 'executed'; result: TaskTransitionExecutionResult }

export type BoardStatusTargetResult =
  | { kind: 'same-status-noop' }
  | { kind: 'ready'; transitionId: string }
  | { kind: 'no-matching-transition' }
  | { kind: 'multiple-matching-transitions'; transitionIds: string[] }

export interface BoardStatusTarget {
  statusId: string
  reachable: boolean
  current: boolean
}

export const canStartBoardTaskTransition = (pendingTaskIds: string[], taskId: string) => !pendingTaskIds.includes(taskId)

export function resolveSimpleBoardDrop(statusIds: string[], transitions: WorkflowTransition[]): SimpleBoardDropResult {
  if (statusIds.length !== 1) return { kind: 'multi-status-destination' }
  const matches = transitions.filter((transition) => transition.to === statusIds[0])
  if (!matches.length) return { kind: 'no-matching-transition' }
  if (matches.length > 1) return { kind: 'multiple-matching-transitions' }
  return { kind: 'ready', transitionId: matches[0]!.id }
}

export function resolveBoardStatusTarget(currentStatusId: string, destinationStatusId: string, transitions: WorkflowTransition[]): BoardStatusTargetResult {
  if (currentStatusId === destinationStatusId) return { kind: 'same-status-noop' }
  const matches = transitions.filter((transition) => transition.to === destinationStatusId)
  if (!matches.length) return { kind: 'no-matching-transition' }
  if (matches.length > 1) return { kind: 'multiple-matching-transitions', transitionIds: matches.map((transition) => transition.id) }
  return { kind: 'ready', transitionId: matches[0]!.id }
}

export const getBoardStatusTargets = (currentStatusId: string, destinationStatusIds: string[], transitions: WorkflowTransition[]): BoardStatusTarget[] =>
  destinationStatusIds.map((statusId) => ({
    statusId,
    current: statusId === currentStatusId,
    reachable: statusId !== currentStatusId && transitions.some((transition) => transition.to === statusId),
  }))

export async function executeBoardTransitionById(input: {
  projectId: string
  taskId: string
  transitionId: string
  transitionTask: (input: { projectId: string; taskId: string; transitionId: string }) => Promise<TaskTransitionExecutionResult>
}): Promise<TaskTransitionExecutionResult> {
  return input.transitionTask({ projectId: input.projectId, taskId: input.taskId, transitionId: input.transitionId })
}

export async function executeSimpleBoardDrop(input: {
  projectId: string
  taskId: string
  statusIds: string[]
  getTaskTransitions: (input: { projectId: string; taskId: string }) => TaskTransitionResolutionResult
  transitionTask: (input: { projectId: string; taskId: string; transitionId: string }) => Promise<TaskTransitionExecutionResult>
}): Promise<SimpleBoardDropResult> {
  const resolution = input.getTaskTransitions({ projectId: input.projectId, taskId: input.taskId })
  if (!resolution.ok) return { kind: 'resolution-failed', resolution }
  const resolved = resolveSimpleBoardDrop(input.statusIds, resolution.transitions)
  if (resolved.kind !== 'ready') return resolved
  return { kind: 'executed', result: await input.transitionTask({ projectId: input.projectId, taskId: input.taskId, transitionId: resolved.transitionId }) }
}
