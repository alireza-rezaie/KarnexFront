import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/task'
import type { WorkflowTransition } from '@/types/workflow'
import type { Member } from '@/types/member'
import type { ApprovalPolicy, TransitionValidator, WorkflowConditionGroup, WorkflowConditionRule } from '@/types/workflowPolicy'
import { evaluateTransitionConditions, evaluateTransitionPolicy, evaluateTransitionValidators, validateApprovalPolicy, validateTransitionPolicyDefinition } from '@/utils/workflowPolicy'

const task: Task = {
  id: 't1', key: 'KAN-1', title: 'Task', description: '', type: 'bug', status: 'todo', priority: 'high',
  assignee: 'm2', reporter: 'm1', projectId: 'p1', sprintId: 's1', labels: ['frontend', 'urgent'],
  storyPoints: 5, estimatedSeconds: 7200, dueDate: '1405/1/1', createdAt: '1404/1/1', updatedAt: '1404/1/2',
  comments: 0, attachments: 0, subtasks: 0, completedSubtasks: 0,
}

const currentMember: Member = {
  id: 'm1', name: 'Current', email: 'current@example.com', jobTitle: 'Developer', roleId: 'r-dev',
  avatar: '', status: 'online', projects: ['p1'], lastActivity: 'اکنون',
}

const context = { task, currentMember, actor: { id: 'm1', roleIds: ['r-dev', 'r-reviewer'] } }
const rule = (id: string, field: WorkflowConditionRule['field'], operator: WorkflowConditionRule['operator'], value?: WorkflowConditionRule['value']): WorkflowConditionRule => ({ id, kind: 'rule', field, operator, value })
const group = (id: string, operator: 'AND' | 'OR', children: WorkflowConditionGroup['children']): WorkflowConditionGroup => ({ id, kind: 'group', operator, children })
const literal = (value: string | number | string[]) => ({ source: 'LITERAL' as const, value })

describe('workflow condition evaluation', () => {
  it('passes empty condition trees for legacy unrestricted transitions', () => expect(evaluateTransitionConditions(undefined, context)).toEqual({ passed: true, failedRuleIds: [] }))
  it('supports scalar equals and notEquals', () => {
    expect(evaluateTransitionConditions(group('g', 'AND', [rule('a', 'task.type', 'equals', literal('bug')), rule('b', 'task.priority', 'notEquals', literal('low'))]), context).passed).toBe(true)
  })
  it('reports the exact failing scalar rule', () => expect(evaluateTransitionConditions(group('g', 'AND', [rule('bad', 'task.type', 'equals', literal('story'))]), context)).toEqual({ passed: false, failedRuleIds: ['bad'] }))
  it.each([
    ['greaterThan', 4, true], ['greaterThanOrEqual', 5, true], ['lessThan', 6, true], ['lessThanOrEqual', 5, true], ['greaterThan', 5, false],
  ] as const)('evaluates numeric %s', (operator, expected, passed) => {
    expect(evaluateTransitionConditions(group('g', 'AND', [rule('points', 'task.storyPoints', operator, literal(expected))]), context).passed).toBe(passed)
  })
  it('supports array contains and notContains', () => {
    expect(evaluateTransitionConditions(group('g', 'AND', [rule('contains', 'task.labels', 'contains', literal('frontend')), rule('not', 'task.labels', 'notContains', literal('backend'))]), context).passed).toBe(true)
  })
  it('supports isEmpty and isNotEmpty without a value', () => {
    expect(evaluateTransitionConditions(group('g', 'AND', [rule('empty', 'task.sprintId', 'isEmpty')]), { ...context, task: { ...task, sprintId: undefined } }).passed).toBe(true)
    expect(evaluateTransitionConditions(group('g', 'AND', [rule('not-empty', 'task.assignee', 'isNotEmpty')]), context).passed).toBe(true)
  })
  it('evaluates AND groups', () => expect(evaluateTransitionConditions(group('g', 'AND', [rule('one', 'task.type', 'equals', literal('bug')), rule('two', 'task.priority', 'equals', literal('low'))]), context).passed).toBe(false))
  it('evaluates OR groups', () => expect(evaluateTransitionConditions(group('g', 'OR', [rule('one', 'task.type', 'equals', literal('story')), rule('two', 'task.priority', 'equals', literal('high'))]), context).passed).toBe(true))
  it('evaluates nested AND/OR groups', () => {
    const tree = group('root', 'AND', [rule('type', 'task.type', 'equals', literal('bug')), group('either', 'OR', [rule('priority', 'task.priority', 'equals', literal('low')), rule('assignee', 'task.assignee', 'equals', literal('m2'))])])
    expect(evaluateTransitionConditions(tree, context).passed).toBe(true)
  })
  it('resolves CURRENT_USER_ID against the actual current member', () => expect(evaluateTransitionConditions(group('g', 'AND', [rule('reporter', 'task.reporter', 'equals', { source: 'CURRENT_USER_ID' })]), context).passed).toBe(true))
  it('fails CURRENT_USER_ID safely without a current member', () => expect(evaluateTransitionConditions(group('g', 'AND', [rule('reporter', 'task.reporter', 'equals', { source: 'CURRENT_USER_ID' })]), { ...context, currentMember: undefined, actor: { id: undefined, roleIds: [] } }).passed).toBe(false))
  it('evaluates actor role ids as an array', () => expect(evaluateTransitionConditions(group('g', 'AND', [rule('role', 'actor.roleIds', 'contains', literal('r-reviewer'))]), context).passed).toBe(true))
  it('fails incompatible field/operator combinations safely', () => expect(evaluateTransitionConditions(group('g', 'AND', [rule('bad', 'task.labels', 'greaterThan', literal(1))]), context)).toEqual({ passed: false, failedRuleIds: ['bad'] }))
})

describe('workflow transition validators', () => {
  const validators: TransitionValidator[] = [
    { id: 'assignee', field: 'task.assignee', operator: 'isNotEmpty' },
    { id: 'points', field: 'task.storyPoints', operator: 'greaterThanOrEqual', value: literal(3) },
  ]
  it('passes a flat AND validator list when every validator passes', () => expect(evaluateTransitionValidators(validators, context)).toEqual({ valid: true, errors: [] }))
  it('returns Persian default feedback for required fields', () => {
    const result = evaluateTransitionValidators(validators, { ...context, task: { ...task, assignee: '' } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.objectContaining({ validatorId: 'assignee', field: 'task.assignee', message: expect.stringContaining('مسئول وظیفه') }))
  })
  it('returns a custom validation message verbatim', () => expect(evaluateTransitionValidators([{ id: 'custom', field: 'task.storyPoints', operator: 'greaterThan', value: literal(10), message: 'امتیاز کافی نیست.' }], context).errors[0]?.message).toBe('امتیاز کافی نیست.'))
  it('treats missing optional numeric data as invalid for numeric rules', () => expect(evaluateTransitionValidators([{ id: 'estimate', field: 'task.estimatedSeconds', operator: 'greaterThan', value: literal(0) }], { ...context, task: { ...task, estimatedSeconds: undefined } }).valid).toBe(false))
  it('rejects incompatible validator operator configurations safely', () => expect(evaluateTransitionValidators([{ id: 'invalid', field: 'task.labels', operator: 'equals', value: literal('frontend') }], context).valid).toBe(false))
})

describe('workflow approval policy validation', () => {
  const catalog = { memberIds: ['m1', 'm2'], roleIds: ['r-dev', 'r-reviewer'] }
  const required = (overrides: Partial<Extract<ApprovalPolicy, { mode: 'required' }>> = {}): ApprovalPolicy => ({ mode: 'required', approverType: 'role', approverIds: ['r-reviewer'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true, ...overrides })
  it('accepts the no-approval policy and an existing role approver', () => {
    expect(validateApprovalPolicy({ mode: 'none' }, catalog).valid).toBe(true)
    expect(validateApprovalPolicy(required(), catalog).valid).toBe(true)
  })
  it('accepts existing member approvers', () => expect(validateApprovalPolicy(required({ approverType: 'member', approverIds: ['m2'] }), catalog).valid).toBe(true))
  it('rejects missing approvers', () => expect(validateApprovalPolicy(required({ approverIds: [] }), catalog).errors.map((error) => error.code)).toContain('MISSING_APPROVERS'))
  it('rejects unknown member or role approvers', () => {
    expect(validateApprovalPolicy(required({ approverIds: ['missing'] }), catalog).errors.map((error) => error.code)).toContain('UNKNOWN_APPROVER')
  })
  it.each([0, -1, 2, 1.5])('rejects invalid minimum approvals: %s', (minApprovals) => expect(validateApprovalPolicy(required({ minApprovals }), catalog).errors.map((error) => error.code)).toContain('INVALID_MIN_APPROVALS'))
  it('rejects duplicate approvers', () => expect(validateApprovalPolicy(required({ approverIds: ['r-reviewer', 'r-reviewer'], minApprovals: 1 }), catalog).errors.map((error) => error.code)).toContain('DUPLICATE_APPROVER'))
  it('preserves requester and rejection-reason policy flags', () => expect(validateApprovalPolicy(required({ requesterCanApprove: true, rejectionRequiresReason: false }), catalog).valid).toBe(true))
})

describe('transition policy sequencing', () => {
  const transition: WorkflowTransition = { id: 'tr', from: 'todo', to: 'done', conditions: group('g', 'AND', [rule('available', 'task.type', 'equals', literal('bug'))]), validators: [{ id: 'required-assignee', field: 'task.assignee', operator: 'isNotEmpty' }], approval: { mode: 'required', approverType: 'role', approverIds: ['r-reviewer'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true } }
  it('allows an attempt when conditions pass and reports required approval', () => {
    expect(evaluateTransitionPolicy(transition, context)).toMatchObject({ conditionPassed: true, validatorResult: { valid: true }, approvalPolicy: { mode: 'required' }, canAttemptTransition: true })
  })
  it('blocks availability before validators when conditions fail', () => {
    const result = evaluateTransitionPolicy({ ...transition, conditions: group('g', 'AND', [rule('blocked', 'task.type', 'equals', literal('story'))]) }, { ...context, task: { ...task, assignee: '' } })
    expect(result).toMatchObject({ conditionPassed: false, validatorResult: { valid: true }, canAttemptTransition: false })
  })
  it('allows an attempt but blocks final execution data when validators fail', () => expect(evaluateTransitionPolicy(transition, { ...context, task: { ...task, assignee: '' } })).toMatchObject({ conditionPassed: true, validatorResult: { valid: false }, canAttemptTransition: true }))
  it('keeps legacy transitions unrestricted and approval-free', () => expect(evaluateTransitionPolicy({ id: 'legacy', from: 'todo', to: 'done' }, context)).toEqual({ conditionPassed: true, failedConditionRuleIds: [], validatorResult: { valid: true, errors: [] }, approvalPolicy: { mode: 'none' }, canAttemptTransition: true }))
})

describe('workflow policy draft validation', () => {
  const catalog = { memberIds: ['m1', 'm2'], roleIds: ['r-dev', 'r-reviewer'] }
  it('allows legacy transition drafts without a policy', () => expect(validateTransitionPolicyDefinition({ id: 'legacy', from: 'todo', to: 'done' }, catalog)).toEqual([]))
  it('blocks incomplete condition values before publish', () => expect(validateTransitionPolicyDefinition({ id: 'incomplete-condition', from: 'todo', to: 'done', conditions: group('root', 'AND', [rule('missing', 'task.priority', 'equals')]) }, catalog)).not.toEqual([]))
  it('blocks incomplete validator values before publish', () => expect(validateTransitionPolicyDefinition({ id: 'incomplete-validator', from: 'todo', to: 'done', validators: [{ id: 'missing', field: 'task.storyPoints', operator: 'greaterThan' }] }, catalog)).not.toEqual([]))
  it('blocks unknown approval identities before publish', () => expect(validateTransitionPolicyDefinition({ id: 'unknown-approval', from: 'todo', to: 'done', approval: { mode: 'required', approverType: 'member', approverIds: ['unknown'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true } }, catalog)).not.toEqual([]))
  it('accepts a complete nested condition, validator, and approval draft', () => expect(validateTransitionPolicyDefinition({ id: 'complete', from: 'todo', to: 'done', conditions: group('root', 'AND', [group('nested', 'OR', [rule('priority', 'task.priority', 'equals', literal('high'))])]), validators: [{ id: 'assignee', field: 'task.assignee', operator: 'isNotEmpty' }], approval: { mode: 'required', approverType: 'role', approverIds: ['r-reviewer'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true } }, catalog)).toEqual([]))
})
