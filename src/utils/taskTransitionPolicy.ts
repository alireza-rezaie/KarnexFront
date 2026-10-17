import type { Member } from '@/types/member'
import type { Role } from '@/types/role'
import type { Task } from '@/types/task'
import type { ApprovalPolicy } from '@/types/workflowPolicy'
import type { WorkflowTransition } from '@/types/workflow'
import { evaluateTransitionPolicy } from '@/utils/workflowPolicy'

export type TaskTransitionAttemptReason =
  | 'allowed'
  | 'transition-not-found'
  | 'condition-failed'
  | 'validation-failed'
  | 'approval-required'

export type TaskTransitionAttemptResult = {
  allowed: boolean
  reason: TaskTransitionAttemptReason
  transition?: WorkflowTransition
  validationErrors?: string[]
  failedConditionRuleIds?: string[]
  approvalPolicy?: ApprovalPolicy
}

type TaskTransitionAttemptInput = {
  task: Task
  targetStatusId: string
  transitions: WorkflowTransition[]
  currentMember?: Member | null
  actorRoleIds: Role['id'][]
}

/**
 * Shared runtime status-transition guard. Execution order is fixed: locate transition,
 * conditions, validators, then approval boundary. This function never mutates a Task.
 */
export function evaluateTaskTransitionAttempt({ task, targetStatusId, transitions, currentMember, actorRoleIds }: TaskTransitionAttemptInput): TaskTransitionAttemptResult {
  const transition = transitions.find((item) => item.from === task.status && item.to === targetStatusId)
  if (!transition) return { allowed: false, reason: 'transition-not-found' }

  const policy = evaluateTransitionPolicy(transition, {
    task,
    currentMember,
    actor: { id: currentMember?.id, roleIds: actorRoleIds },
  })
  if (!policy.conditionPassed) {
    return { allowed: false, reason: 'condition-failed', transition, failedConditionRuleIds: policy.failedConditionRuleIds }
  }
  if (!policy.validatorResult.valid) {
    return {
      allowed: false,
      reason: 'validation-failed',
      transition,
      validationErrors: policy.validatorResult.errors.map((error) => error.message),
    }
  }
  if (policy.approvalPolicy.mode === 'required') {
    return { allowed: false, reason: 'approval-required', transition, approvalPolicy: policy.approvalPolicy }
  }
  return { allowed: true, reason: 'allowed', transition, approvalPolicy: policy.approvalPolicy }
}

export function taskTransitionFeedback(result: TaskTransitionAttemptResult) {
  if (result.reason === 'condition-failed') return 'شرایط لازم برای این انتقال برقرار نیست.'
  if (result.reason === 'validation-failed') return result.validationErrors?.join(' ') || 'اطلاعات وظیفه برای این انتقال معتبر نیست.'
  if (result.reason === 'approval-required') return 'این انتقال نیازمند تأیید است.'
  if (result.reason === 'transition-not-found') return 'این انتقال در گردش‌کار پروژه مجاز نیست.'
  return ''
}
