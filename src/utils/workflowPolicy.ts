import type { WorkflowTransition } from '@/types/workflow'
import type {
  ApprovalPolicy,
  ApprovalPolicyCatalog,
  ApprovalPolicyValidationResult,
  ConditionEvaluationResult,
  TransitionPolicyEvaluationResult,
  TransitionValidator,
  TransitionValidatorField,
  TransitionValidatorResult,
  WorkflowConditionField,
  WorkflowConditionGroup,
  WorkflowConditionNode,
  WorkflowRuleEvaluationContext,
  WorkflowRuleLiteral,
  WorkflowRuleOperator,
  WorkflowRuleValue,
} from '@/types/workflowPolicy'

type FieldKind = 'scalar' | 'number' | 'array'

const fieldKinds: Record<WorkflowConditionField, FieldKind> = {
  'task.type': 'scalar',
  'task.priority': 'scalar',
  'task.assignee': 'scalar',
  'task.reporter': 'scalar',
  'task.sprintId': 'scalar',
  'task.storyPoints': 'number',
  'task.estimatedSeconds': 'number',
  'task.labels': 'array',
  'task.acceptanceCriteria': 'scalar',
  'actor.id': 'scalar',
  'actor.roleIds': 'array',
}

const fieldLabels: Record<TransitionValidatorField, string> = {
  'task.type': 'نوع وظیفه',
  'task.priority': 'اولویت',
  'task.assignee': 'مسئول وظیفه',
  'task.reporter': 'گزارش‌دهنده',
  'task.sprintId': 'اسپرینت',
  'task.storyPoints': 'امتیاز داستان',
  'task.estimatedSeconds': 'زمان تخمینی',
  'task.labels': 'برچسب‌ها',
  'task.acceptanceCriteria': 'معیارهای پذیرش',
}

const noApproval: ApprovalPolicy = { mode: 'none' }

export function isWorkflowConditionGroup(node: WorkflowConditionNode): node is WorkflowConditionGroup {
  return node.kind === 'group'
}

export function isWorkflowRuleOperatorCompatible(field: WorkflowConditionField, operator: WorkflowRuleOperator) {
  const kind = fieldKinds[field]
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return true
  if (kind === 'number') {
    return ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'].includes(operator)
  }
  if (kind === 'array') return operator === 'contains' || operator === 'notContains'
  return operator === 'equals' || operator === 'notEquals'
}

function fieldValue(field: WorkflowConditionField, context: WorkflowRuleEvaluationContext): unknown {
  const { task, actor } = context
  switch (field) {
    case 'task.type': return task.type
    case 'task.priority': return task.priority
    case 'task.assignee': return task.assignee
    case 'task.reporter': return task.reporter
    case 'task.sprintId': return task.sprintId
    case 'task.storyPoints': return task.storyPoints
    case 'task.estimatedSeconds': return task.estimatedSeconds
    case 'task.labels': return task.labels
    // This is deliberately derived from the Task authority, not a Board-local
    // checklist copy. An empty checklist does not satisfy a completion gate.
    case 'task.acceptanceCriteria': {
      const criteria = task.acceptanceCriteria ?? []
      return criteria.length > 0 && criteria.every((item) => item.completed)
    }
    case 'actor.id': return actor.id ?? context.currentMember?.id
    case 'actor.roleIds': return actor.roleIds
  }
}

function resolveValue(value: WorkflowRuleValue | undefined, context: WorkflowRuleEvaluationContext) {
  if (!value) return { resolved: undefined, available: false }
  if (value.source === 'CURRENT_USER_ID') {
    const currentUserId = context.currentMember?.id
    return { resolved: currentUserId, available: Boolean(currentUserId) }
  }
  return { resolved: value.value, available: true }
}

function isEmpty(value: unknown) {
  return value == null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
}

function hasConfiguredValue(value: WorkflowRuleValue | undefined) {
  return Boolean(value && (value.source === 'CURRENT_USER_ID' || (value.source === 'LITERAL' && value.value !== '' && value.value !== null)))
}

function evaluateRule(field: WorkflowConditionField, operator: WorkflowRuleOperator, value: WorkflowRuleValue | undefined, context: WorkflowRuleEvaluationContext) {
  if (!isWorkflowRuleOperatorCompatible(field, operator)) return false
  const actual = fieldValue(field, context)
  if (operator === 'isEmpty') return isEmpty(actual)
  if (operator === 'isNotEmpty') return !isEmpty(actual)

  const expected = resolveValue(value, context)
  if (!expected.available) return false

  if (operator === 'equals') return actual === expected.resolved
  if (operator === 'notEquals') return actual !== expected.resolved
  if (operator === 'contains') return Array.isArray(actual) && typeof expected.resolved === 'string' && actual.includes(expected.resolved)
  if (operator === 'notContains') return Array.isArray(actual) && typeof expected.resolved === 'string' && !actual.includes(expected.resolved)
  if (typeof actual !== 'number' || typeof expected.resolved !== 'number') return false
  if (operator === 'greaterThan') return actual > expected.resolved
  if (operator === 'greaterThanOrEqual') return actual >= expected.resolved
  if (operator === 'lessThan') return actual < expected.resolved
  if (operator === 'lessThanOrEqual') return actual <= expected.resolved
  return false
}

function evaluateConditionNode(node: WorkflowConditionNode, context: WorkflowRuleEvaluationContext): ConditionEvaluationResult {
  if (!isWorkflowConditionGroup(node)) {
    return evaluateRule(node.field, node.operator, node.value, context)
      ? { passed: true, failedRuleIds: [] }
      : { passed: false, failedRuleIds: [node.id] }
  }

  if (node.children.length === 0) return { passed: true, failedRuleIds: [] }
  const results = node.children.map((child) => evaluateConditionNode(child, context))
  const passed = node.operator === 'AND' ? results.every((result) => result.passed) : results.some((result) => result.passed)
  return {
    passed,
    failedRuleIds: passed ? [] : [...new Set(results.flatMap((result) => result.failedRuleIds))],
  }
}

/** An omitted or empty condition tree deliberately keeps legacy transitions unrestricted. */
export function evaluateTransitionConditions(conditions: WorkflowConditionGroup | undefined, context: WorkflowRuleEvaluationContext): ConditionEvaluationResult {
  if (!conditions || conditions.children.length === 0) return { passed: true, failedRuleIds: [] }
  return evaluateConditionNode(conditions, context)
}

function validatorMessage(validator: TransitionValidator, value: WorkflowRuleLiteral | undefined) {
  if (validator.message?.trim()) return validator.message.trim()
  const label = fieldLabels[validator.field]
  switch (validator.operator) {
    case 'isNotEmpty': return `برای این انتقال، ${label} باید مشخص باشد.`
    case 'isEmpty': return `برای این انتقال، ${label} باید خالی باشد.`
    case 'greaterThan': return `برای این انتقال، ${label} باید بیشتر از ${String(value)} باشد.`
    case 'greaterThanOrEqual': return `برای این انتقال، ${label} باید حداقل ${String(value)} باشد.`
    case 'lessThan': return `برای این انتقال، ${label} باید کمتر از ${String(value)} باشد.`
    case 'lessThanOrEqual': return `برای این انتقال، ${label} باید حداکثر ${String(value)} باشد.`
    case 'contains': return `برای این انتقال، ${label} باید مقدار موردنیاز را داشته باشد.`
    case 'notContains': return `برای این انتقال، ${label} نباید مقدار نامعتبر را داشته باشد.`
    default: return `مقدار ${label} برای این انتقال معتبر نیست.`
  }
}

/** Validators are a flat AND list and execute only on a transition attempt. */
export function evaluateTransitionValidators(validators: TransitionValidator[] | undefined, context: WorkflowRuleEvaluationContext): TransitionValidatorResult {
  const errors = (validators ?? []).flatMap((validator) => {
    const passed = evaluateRule(validator.field, validator.operator, validator.value, context)
    if (passed) return []
    const resolved = resolveValue(validator.value, context)
    return [{ validatorId: validator.id, field: validator.field, message: validatorMessage(validator, resolved.resolved as WorkflowRuleLiteral | undefined) }]
  })
  return { valid: errors.length === 0, errors }
}

/**
 * Validates a JSON-safe approval policy against ids supplied by MembersContext/RolesContext callers.
 * It does not create approval requests or mutate workflow state.
 */
export function validateApprovalPolicy(policy: ApprovalPolicy | undefined, catalog: ApprovalPolicyCatalog): ApprovalPolicyValidationResult {
  const current = policy ?? noApproval
  if (current.mode === 'none') return { valid: true, errors: [] }
  const errors: ApprovalPolicyValidationResult['errors'] = []
  const availableIds = new Set(current.approverType === 'member' ? catalog.memberIds : catalog.roleIds)
  if (!Array.isArray(current.approverIds) || current.approverIds.length === 0) {
    errors.push({ code: 'MISSING_APPROVERS', message: 'حداقل یک تأییدکننده باید مشخص شود.' })
  }
  if (new Set(current.approverIds).size !== current.approverIds.length) {
    errors.push({ code: 'DUPLICATE_APPROVER', message: 'تأییدکننده‌ها نباید تکراری باشند.' })
  }
  if (current.approverIds.some((id) => !availableIds.has(id))) {
    errors.push({ code: 'UNKNOWN_APPROVER', message: 'یکی از تأییدکننده‌های انتخاب‌شده معتبر نیست.' })
  }
  if (!Number.isInteger(current.minApprovals) || current.minApprovals < 1 || current.minApprovals > current.approverIds.length) {
    errors.push({ code: 'INVALID_MIN_APPROVALS', message: 'حداقل تعداد تأییدها معتبر نیست.' })
  }
  if (typeof current.requesterCanApprove !== 'boolean' || typeof current.rejectionRequiresReason !== 'boolean') {
    errors.push({ code: 'INVALID_POLICY', message: 'تنظیمات تأیید انتقال معتبر نیست.' })
  }
  return { valid: errors.length === 0, errors }
}

/** Validates draft policy configuration before publish; it never evaluates a Task or mutates Context. */
export function validateTransitionPolicyDefinition(transition: WorkflowTransition, catalog: ApprovalPolicyCatalog) {
  const errors: string[] = []
  const validateGroup = (group: WorkflowConditionGroup) => {
    group.children.forEach((node) => {
      if (isWorkflowConditionGroup(node)) return validateGroup(node)
      if (!isWorkflowRuleOperatorCompatible(node.field, node.operator)) errors.push('عملگر یکی از شرط‌های انتقال با فیلد انتخاب‌شده سازگار نیست.')
      if (node.operator !== 'isEmpty' && node.operator !== 'isNotEmpty' && !hasConfiguredValue(node.value)) errors.push('مقدار یکی از شرط‌های انتقال کامل نیست.')
    })
  }
  if (transition.conditions) validateGroup(transition.conditions)
  transition.validators?.forEach((validator) => {
    if (!isWorkflowRuleOperatorCompatible(validator.field, validator.operator)) errors.push('عملگر یکی از اعتبارسنجی‌های انتقال با فیلد انتخاب‌شده سازگار نیست.')
    if (validator.operator !== 'isEmpty' && validator.operator !== 'isNotEmpty' && !hasConfiguredValue(validator.value)) errors.push('مقدار یکی از اعتبارسنجی‌های انتقال کامل نیست.')
  })
  errors.push(...validateApprovalPolicy(transition.approval, catalog).errors.map((error) => error.message))
  return [...new Set(errors)]
}

/**
 * Foundation-only policy sequence: availability conditions, attempt-time validators, then approval requirement.
 * A false condition hides/blocks the attempt; validator failure blocks execution after an attempt is made.
 * Approval execution itself is deliberately deferred to a later phase.
 */
export function evaluateTransitionPolicy(transition: WorkflowTransition, context: WorkflowRuleEvaluationContext): TransitionPolicyEvaluationResult {
  const conditionResult = evaluateTransitionConditions(transition.conditions, context)
  const validatorResult = conditionResult.passed
    ? evaluateTransitionValidators(transition.validators, context)
    : { valid: true, errors: [] }
  return {
    conditionPassed: conditionResult.passed,
    failedConditionRuleIds: conditionResult.failedRuleIds,
    validatorResult,
    approvalPolicy: transition.approval ?? noApproval,
    canAttemptTransition: conditionResult.passed,
  }
}
