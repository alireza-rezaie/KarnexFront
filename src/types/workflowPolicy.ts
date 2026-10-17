import type { Member } from '@/types/member'
import type { Role } from '@/types/role'
import type { Task } from '@/types/task'

/** JSON-safe literals intentionally supported by workflow conditions and validators. */
export type WorkflowRuleLiteral = string | number | boolean | null | string[]

export type WorkflowConditionField =
  | 'task.type'
  | 'task.priority'
  | 'task.assignee'
  | 'task.reporter'
  | 'task.sprintId'
  | 'task.storyPoints'
  | 'task.estimatedSeconds'
  | 'task.labels'
  /** True only when the authoritative task checklist has at least one item and every item is complete. */
  | 'task.acceptanceCriteria'
  | 'actor.id'
  | 'actor.roleIds'

export type TransitionValidatorField = Exclude<WorkflowConditionField, 'actor.id' | 'actor.roleIds'>

export type WorkflowRuleOperator =
  | 'equals'
  | 'notEquals'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'

export type WorkflowRuleValue =
  | { source: 'LITERAL'; value: WorkflowRuleLiteral }
  | { source: 'CURRENT_USER_ID' }

export interface WorkflowConditionRule {
  id: string
  kind: 'rule'
  field: WorkflowConditionField
  operator: WorkflowRuleOperator
  value?: WorkflowRuleValue
}

export interface WorkflowConditionGroup {
  id: string
  kind: 'group'
  operator: 'AND' | 'OR'
  children: WorkflowConditionNode[]
}

export type WorkflowConditionNode = WorkflowConditionRule | WorkflowConditionGroup

export interface TransitionValidator {
  id: string
  field: TransitionValidatorField
  operator: WorkflowRuleOperator
  value?: WorkflowRuleValue
  /** Optional product-authored Persian copy; otherwise the evaluator supplies safe Persian feedback. */
  message?: string
}

export type ApprovalPolicy =
  | { mode: 'none' }
  | {
      mode: 'required'
      approverType: 'role' | 'member'
      approverIds: string[]
      minApprovals: number
      requesterCanApprove: boolean
      rejectionRequiresReason: boolean
    }

export interface WorkflowRuleActor {
  id?: Member['id']
  roleIds: Role['id'][]
}

export interface WorkflowRuleEvaluationContext {
  task: Task
  /** The current authenticated member resolved from AuthContext.currentUserId through MembersContext. */
  currentMember?: Member | null
  /** Role ids resolved from the current member and RolesContext; Member currently has one optional roleId. */
  actor: WorkflowRuleActor
}

export interface ConditionEvaluationResult {
  passed: boolean
  failedRuleIds: string[]
}

export interface TransitionValidatorError {
  validatorId: string
  field: TransitionValidatorField
  message: string
}

export interface TransitionValidatorResult {
  valid: boolean
  errors: TransitionValidatorError[]
}

export interface ApprovalPolicyValidationError {
  code: 'MISSING_APPROVERS' | 'UNKNOWN_APPROVER' | 'INVALID_MIN_APPROVALS' | 'DUPLICATE_APPROVER' | 'INVALID_POLICY'
  message: string
}

export interface ApprovalPolicyValidationResult {
  valid: boolean
  errors: ApprovalPolicyValidationError[]
}

export interface ApprovalPolicyCatalog {
  memberIds: Iterable<Member['id']>
  roleIds: Iterable<Role['id']>
}

/**
 * Policy evaluation timing (foundation only):
 * 1. Find a transition. 2. Evaluate availability conditions. 3. Validate task data on attempt.
 * 4. Determine whether approval is required. 5. Execution and approval requests are deferred.
 */
export interface TransitionPolicyEvaluationResult {
  conditionPassed: boolean
  failedConditionRuleIds: string[]
  validatorResult: TransitionValidatorResult
  approvalPolicy: ApprovalPolicy
  /** Availability only; final execution will later also require validator success and approval completion. */
  canAttemptTransition: boolean
}
