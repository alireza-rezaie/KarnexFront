import { describe, expect, it } from 'vitest'
import { baseTaskStatuses } from '@/config/taskStatus'
import {
  cloneWorkflowDraft,
  createWorkflowDraft,
  loadWorkflowTemplates,
  pushWorkflowHistory,
  redoWorkflowHistory,
  saveWorkflowTemplate,
  undoWorkflowHistory,
  validateWorkflowDraft,
  workflowDraftEquals,
  WORKFLOW_TEMPLATES_STORAGE_KEY,
} from '@/utils/workflowEditor'

const positions = {
  todo: { x: 120, y: 180 },
  inprogress: { x: 360, y: 180 },
  review: { x: 600, y: 180 },
  done: { x: 840, y: 180 },
}

const transitions = [
  { id: 'todo-progress', from: 'todo', to: 'inprogress' },
  { id: 'progress-review', from: 'inprogress', to: 'review' },
]

const publishedDraft = () => createWorkflowDraft(baseTaskStatuses, transitions, positions)

describe('workflow editor draft lifecycle', () => {
  it('accepts a publishable draft and clears dirty state once it becomes published', () => {
    const draft = publishedDraft()

    expect(validateWorkflowDraft(draft, baseTaskStatuses.map((status) => status.id))).toBeNull()
    expect(workflowDraftEquals(draft, cloneWorkflowDraft(draft))).toBe(true)
  })

  it('restores the published draft on cancel', () => {
    const published = publishedDraft()
    const changed = createWorkflowDraft(published.statuses, published.transitions, {
      ...published.nodePositions,
      todo: { x: 211, y: 317 },
    })

    expect(workflowDraftEquals(changed, published)).toBe(false)
    expect(cloneWorkflowDraft(published)).toEqual(published)
  })

  it('undoes and redoes a node move', () => {
    const original = publishedDraft()
    const moved = createWorkflowDraft(original.statuses, original.transitions, {
      ...original.nodePositions,
      todo: { x: 222, y: 318 },
    })
    const history = pushWorkflowHistory({ undo: [], redo: [] }, original)
    const undone = undoWorkflowHistory(history, moved)

    expect(undone.draft).toEqual(original)
    const redone = redoWorkflowHistory(undone.history, undone.draft!)
    expect(redone.draft).toEqual(moved)
  })

  it('clears redo history after a new draft action', () => {
    const original = publishedDraft()
    const moved = createWorkflowDraft(original.statuses, original.transitions, {
      ...original.nodePositions,
      todo: { x: 222, y: 318 },
    })
    const undone = undoWorkflowHistory(pushWorkflowHistory({ undo: [], redo: [] }, original), moved)
    const changedAgain = createWorkflowDraft(original.statuses, original.transitions, {
      ...original.nodePositions,
      review: { x: 488, y: 312 },
    })

    expect(pushWorkflowHistory(undone.history, changedAgain).redo).toEqual([])
  })

  it('saves, loads, and rejects duplicate template names', () => {
    localStorage.clear()
    const draft = publishedDraft()
    const saved = saveWorkflowTemplate([], 'انتشار استاندارد', draft, () => 'template-1')

    expect(saved.error).toBeNull()
    expect(loadWorkflowTemplates()).toHaveLength(1)
    expect(saveWorkflowTemplate([saved.template!], ' انتشار استاندارد ', draft, () => 'template-2').error).toBe('الگویی با این نام وجود دارد.')
  })

  it('keeps template application as a dirty draft until publish', () => {
    const published = publishedDraft()
    const templateDraft = createWorkflowDraft(
      [...baseTaskStatuses, { id: 'custom-ready', name: 'آماده انتشار', color: '#f97316' }],
      [...transitions, { id: 'review-ready', from: 'review', to: 'custom-ready' }],
      { ...positions, 'custom-ready': { x: 720, y: 340 } },
    )

    expect(workflowDraftEquals(templateDraft, published)).toBe(false)
    expect(validateWorkflowDraft(templateDraft, baseTaskStatuses.map((status) => status.id))).toBeNull()
  })

  it('preserves transition conditions, validators, and approval policies in draft history and templates', () => {
    localStorage.clear()
    const published = publishedDraft()
    const policyDraft = createWorkflowDraft(published.statuses, [{
      ...published.transitions[0]!,
      conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'condition', kind: 'rule', field: 'task.assignee', operator: 'isNotEmpty' }] },
      validators: [{ id: 'validator', field: 'task.estimatedSeconds', operator: 'greaterThan', value: { source: 'LITERAL', value: 0 } }],
      approval: { mode: 'required', approverType: 'role', approverIds: ['r-reviewer'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true },
    }, ...published.transitions.slice(1)], published.nodePositions)
    const saved = saveWorkflowTemplate([], 'الگوی قانون‌دار', policyDraft, () => 'policy-template')
    const undone = undoWorkflowHistory(pushWorkflowHistory({ undo: [], redo: [] }, published), policyDraft)

    expect(undone.draft).toEqual(published)
    expect(loadWorkflowTemplates()).toEqual([expect.objectContaining({ transitions: [expect.objectContaining({ conditions: expect.any(Object), validators: expect.any(Array), approval: expect.objectContaining({ mode: 'required' }) }), expect.any(Object)] })])
    expect(saved.error).toBeNull()
  })

  it('creates an empty draft without changing the published draft and can cancel it', () => {
    const published = publishedDraft()
    const emptyDraft = createWorkflowDraft(baseTaskStatuses, [], positions)

    expect(published.transitions).toHaveLength(2)
    expect(emptyDraft.transitions).toEqual([])
    expect(cloneWorkflowDraft(published)).toEqual(published)
  })

  it('rejects an invalid draft before publish', () => {
    const invalid = createWorkflowDraft(baseTaskStatuses, [{ id: 'bad', from: 'todo', to: 'missing' }], positions)

    expect(validateWorkflowDraft(invalid, baseTaskStatuses.map((status) => status.id))).toBe('انتقال‌های Draft معتبر نیستند.')
  })

  it('ignores malformed persisted template data safely', () => {
    localStorage.setItem(WORKFLOW_TEMPLATES_STORAGE_KEY, '{not-json')

    expect(loadWorkflowTemplates(localStorage)).toEqual([])
  })
})
