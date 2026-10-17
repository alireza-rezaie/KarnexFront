import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/task'
import type { WorkflowTransition } from '@/types/workflow'
import { evaluateTaskTransitionAttempt } from '@/utils/taskTransitionPolicy'

const task: Task = { id: 't1', key: 'KAN-1', title: 'Task', description: '', type: 'task', status: 'todo', priority: 'high', assignee: 'm2', reporter: 'm1', projectId: 'p1', labels: ['frontend'], storyPoints: 3, estimatedSeconds: 3600, createdAt: '1404/1/1', updatedAt: '1404/1/1', comments: 0, attachments: 0, subtasks: 0, completedSubtasks: 0 }
const member = { id: 'm1', name: 'امیر', email: 'amir@example.com', jobTitle: 'توسعه‌دهنده', roleId: 'r-dev', avatar: '', status: 'online' as const, projects: ['p1'], lastActivity: 'اکنون' }
const attempt = (transitions: WorkflowTransition[], overrides: Partial<Parameters<typeof evaluateTaskTransitionAttempt>[0]> = {}) => evaluateTaskTransitionAttempt({ task, targetStatusId: 'done', transitions, currentMember: member, actorRoleIds: ['r-dev'], ...overrides })

describe('task transition runtime policy guard', () => {
  it('allows a legacy transition with no rules', () => expect(attempt([{ id: 'legacy', from: 'todo', to: 'done' }])).toMatchObject({ allowed: true, reason: 'allowed' }))
  it('allows a passing condition', () => expect(attempt([{ id: 'condition', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'type', kind: 'rule', field: 'task.type', operator: 'equals', value: { source: 'LITERAL', value: 'task' } }] } }])).toMatchObject({ allowed: true }))
  it('blocks a failing condition without status mutation', () => expect(attempt([{ id: 'condition', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'type', kind: 'rule', field: 'task.type', operator: 'equals', value: { source: 'LITERAL', value: 'bug' } }] } }])).toMatchObject({ allowed: false, reason: 'condition-failed', failedConditionRuleIds: ['type'] }))
  it('allows passing validators', () => expect(attempt([{ id: 'validator', from: 'todo', to: 'done', validators: [{ id: 'assignee', field: 'task.assignee', operator: 'isNotEmpty' }] }])).toMatchObject({ allowed: true }))
  it('returns all validator messages and honors custom messages', () => {
    const result = attempt([{ id: 'validator', from: 'todo', to: 'done', validators: [{ id: 'custom', field: 'task.estimatedSeconds', operator: 'greaterThan', value: { source: 'LITERAL', value: 7200 }, message: 'زمان کافی نیست.' }, { id: 'points', field: 'task.storyPoints', operator: 'greaterThan', value: { source: 'LITERAL', value: 5 } }] }])
    expect(result).toMatchObject({ allowed: false, reason: 'validation-failed' })
    expect(result.validationErrors).toEqual(expect.arrayContaining(['زمان کافی نیست.']))
    expect(result.validationErrors).toHaveLength(2)
  })
  it('resolves CURRENT_USER_ID and actor roles from runtime context', () => {
    const transitions: WorkflowTransition[] = [{ id: 'actor', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'member', kind: 'rule', field: 'task.reporter', operator: 'equals', value: { source: 'CURRENT_USER_ID' } }, { id: 'role', kind: 'rule', field: 'actor.roleIds', operator: 'contains', value: { source: 'LITERAL', value: 'r-dev' } }] } }]
    expect(attempt(transitions)).toMatchObject({ allowed: true })
  })
  it('fails safely when the current user is absent', () => {
    const transitions: WorkflowTransition[] = [{ id: 'actor', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'member', kind: 'rule', field: 'task.reporter', operator: 'equals', value: { source: 'CURRENT_USER_ID' } }] } }]
    expect(attempt(transitions, { currentMember: undefined, actorRoleIds: [] })).toMatchObject({ allowed: false, reason: 'condition-failed' })
  })
  it('blocks required approval without creating an approval request', () => expect(attempt([{ id: 'approval', from: 'todo', to: 'done', approval: { mode: 'required', approverType: 'role', approverIds: ['r-reviewer'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true } }])).toMatchObject({ allowed: false, reason: 'approval-required', approvalPolicy: { mode: 'required' } }))
  it('keeps target/status project isolation explicit through its caller-supplied project transitions', () => expect(attempt([], { targetStatusId: 'other-project-status' })).toMatchObject({ allowed: false, reason: 'transition-not-found' }))
  it('enforces an assignee-only condition against the authenticated actor without a Board-specific shortcut', () => {
    const transitions: WorkflowTransition[] = [{ id: 'assignee-only', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'assignee', kind: 'rule', field: 'task.assignee', operator: 'equals', value: { source: 'CURRENT_USER_ID' } }] } }]
    expect(attempt(transitions)).toMatchObject({ allowed: false, reason: 'condition-failed' })
    expect(attempt(transitions, { task: { ...task, assignee: 'm1' } })).toMatchObject({ allowed: true, reason: 'allowed' })
  })
  it('enforces matching and non-matching actor roles from MembersContext/RolesContext inputs', () => {
    const transitions: WorkflowTransition[] = [{ id: 'role-only', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'role', kind: 'rule', field: 'actor.roleIds', operator: 'contains', value: { source: 'LITERAL', value: 'r-dev' } }] } }]
    expect(attempt(transitions)).toMatchObject({ allowed: true, reason: 'allowed' })
    expect(attempt(transitions, { actorRoleIds: ['r-reviewer'] })).toMatchObject({ allowed: false, reason: 'condition-failed' })
  })
  it('supports nested combined conditions during an execution attempt', () => {
    const transitions: WorkflowTransition[] = [{ id: 'nested', from: 'todo', to: 'done', conditions: { id: 'root', kind: 'group', operator: 'OR', children: [{ id: 'and', kind: 'group', operator: 'AND', children: [{ id: 'type', kind: 'rule', field: 'task.type', operator: 'equals', value: { source: 'LITERAL', value: 'task' } }, { id: 'role', kind: 'rule', field: 'actor.roleIds', operator: 'contains', value: { source: 'LITERAL', value: 'r-dev' } }] }, { id: 'priority', kind: 'rule', field: 'task.priority', operator: 'equals', value: { source: 'LITERAL', value: 'lowest' } }] } }]
    expect(attempt(transitions)).toMatchObject({ allowed: true, reason: 'allowed' })
    expect(attempt(transitions, { actorRoleIds: [], task: { ...task, priority: 'high' } })).toMatchObject({ allowed: false, reason: 'condition-failed' })
  })
  it('uses the authoritative acceptance-criteria checklist for generic validator enforcement', () => {
    const transitions: WorkflowTransition[] = [{ id: 'acceptance', from: 'todo', to: 'done', validators: [{ id: 'criteria-complete', field: 'task.acceptanceCriteria', operator: 'equals', value: { source: 'LITERAL', value: true }, message: 'همهٔ معیارهای پذیرش باید تکمیل شوند.' }] }]
    expect(attempt(transitions, { task: { ...task, acceptanceCriteria: [{ id: 'ac-1', title: 'بازبینی', completed: false }] } })).toMatchObject({ allowed: false, reason: 'validation-failed', validationErrors: ['همهٔ معیارهای پذیرش باید تکمیل شوند.'] })
    expect(attempt(transitions, { task: { ...task, acceptanceCriteria: [{ id: 'ac-1', title: 'بازبینی', completed: true }] } })).toMatchObject({ allowed: true, reason: 'allowed' })
  })
})
