import type { ApprovalPolicy } from '@/types/workflowPolicy'
import type { WorkflowTransition } from '@/types/workflow'

export type TaskTransitionFailureCode =
  | 'project-mismatch'
  | 'task-not-found'
  | 'active-workflow-not-found'
  | 'transition-not-found'
  | 'source-mismatch'
  | 'destination-status-not-found'
  | 'condition-failed'
  | 'validation-failed'
  | 'approval-required'
  | 'mutation-failed'

export type TaskTransitionExecutionResult =
  | { ok: true; code: 'transitioned'; transition: WorkflowTransition }
  | {
    ok: false
    code: TaskTransitionFailureCode
    message?: string
    transition?: WorkflowTransition
    validationErrors?: string[]
    failedConditionRuleIds?: string[]
    approvalPolicy?: ApprovalPolicy
  }

export interface GetTaskTransitionsInput {
  projectId: string
  taskId: string
}

export interface TaskTransitionExecutionInput extends GetTaskTransitionsInput {
  transitionId: string
}

export type TaskTransitionResolutionResult =
  | { ok: true; transitions: WorkflowTransition[] }
  | { ok: false; code: Extract<TaskTransitionFailureCode, 'project-mismatch' | 'task-not-found' | 'active-workflow-not-found'>; message?: string }
