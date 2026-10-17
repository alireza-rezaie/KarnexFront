import { describe, expect, it, vi } from 'vitest'
import { canStartBoardTaskTransition, executeBoardTransitionById, executeSimpleBoardDrop, getBoardStatusTargets, resolveBoardStatusTarget, resolveSimpleBoardDrop } from '@/utils/boardTransition'
import type { WorkflowTransition } from '@/types/workflow'

const transitions: WorkflowTransition[] = [
  { id: 'todo-inprogress', from: 'todo', to: 'inprogress' },
  { id: 'todo-done', from: 'todo', to: 'done' },
]

const resolvedTransitions = () => ({ ok: true as const, transitions })

describe('simple board transition binding', () => {
  it('selects the sole transition targeting a single-status destination', () => {
    expect(resolveSimpleBoardDrop(['inprogress'], transitions)).toEqual({ kind: 'ready', transitionId: 'todo-inprogress' })
  })

  it('calls the executor with the real transition identity and never a destination status', async () => {
    const transitionTask = vi.fn(async () => ({ ok: true as const, code: 'transitioned' as const, transition: transitions[0]! }))

    const outcome = await executeSimpleBoardDrop({
      projectId: 'p1', taskId: 't1', statusIds: ['inprogress'], getTaskTransitions: resolvedTransitions, transitionTask,
    })

    expect(transitionTask).toHaveBeenCalledWith({ projectId: 'p1', taskId: 't1', transitionId: 'todo-inprogress' })
    expect(outcome).toMatchObject({ kind: 'executed', result: { ok: true } })
  })

  it('rejects destinations without an outgoing structural transition, including adjacent visual columns', () => {
    expect(resolveSimpleBoardDrop(['review'], transitions)).toEqual({ kind: 'no-matching-transition' })
  })

  it('allows a non-adjacent destination when the workflow graph has a real transition', () => {
    expect(resolveSimpleBoardDrop(['done'], transitions)).toEqual({ kind: 'ready', transitionId: 'todo-done' })
  })

  it('passes executor failures through without a local task-status mutation', async () => {
    const transitionTask = vi.fn(async () => ({ ok: false as const, code: 'mutation-failed' as const, message: 'ذخیره نشد' }))
    const outcome = await executeSimpleBoardDrop({
      projectId: 'p1', taskId: 't1', statusIds: ['inprogress'], getTaskTransitions: resolvedTransitions, transitionTask,
    })

    expect(outcome).toEqual({ kind: 'executed', result: { ok: false, code: 'mutation-failed', message: 'ذخیره نشد' } })
    expect(transitionTask).toHaveBeenCalledTimes(1)
  })

  it('rejects multi-status destinations and multiple transitions without guessing', () => {
    expect(resolveSimpleBoardDrop(['inprogress', 'review'], transitions)).toEqual({ kind: 'multi-status-destination' })
    expect(resolveSimpleBoardDrop(['inprogress'], [...transitions, { id: 'another', from: 'todo', to: 'inprogress' }])).toEqual({ kind: 'multiple-matching-transitions' })
  })

  it('does not use a draft-only transition until it appears in the published resolver result', () => {
    const draftOnly = { id: 'draft-only', from: 'todo', to: 'review' }
    expect(resolveSimpleBoardDrop(['review'], transitions)).toEqual({ kind: 'no-matching-transition' })
    expect(resolveSimpleBoardDrop(['review'], [...transitions, draftOnly])).toEqual({ kind: 'ready', transitionId: 'draft-only' })
  })

  it('returns resolver failures without calling the executor', async () => {
    const transitionTask = vi.fn(async () => ({ ok: true as const, code: 'transitioned' as const, transition: transitions[0]! }))
    const outcome = await executeSimpleBoardDrop({
      projectId: 'p1', taskId: 't1', statusIds: ['inprogress'],
      getTaskTransitions: () => ({ ok: false as const, code: 'project-mismatch', message: 'پروژه نادرست' }), transitionTask,
    })

    expect(outcome).toMatchObject({ kind: 'resolution-failed', resolution: { code: 'project-mismatch' } })
    expect(transitionTask).not.toHaveBeenCalled()
  })

  it('blocks only the task with a pending transition while other cards remain eligible', () => {
    expect(canStartBoardTaskTransition(['task-pending'], 'task-pending')).toBe(false)
    expect(canStartBoardTaskTransition(['task-pending'], 'task-other')).toBe(true)
  })

  it('exposes separate reachable and unreachable targets for a multi-status destination', () => {
    expect(getBoardStatusTargets('todo', ['inprogress', 'review', 'done'], transitions)).toEqual([
      { statusId: 'inprogress', current: false, reachable: true },
      { statusId: 'review', current: false, reachable: false },
      { statusId: 'done', current: false, reachable: true },
    ])
  })

  it('supports a same-column transition but makes an exact same-status drop a no-op', () => {
    expect(resolveBoardStatusTarget('development', 'review', [{ id: 'dev-review', from: 'development', to: 'review' }])).toEqual({ kind: 'ready', transitionId: 'dev-review' })
    expect(resolveBoardStatusTarget('review', 'review', [{ id: 'review-done', from: 'review', to: 'done' }])).toEqual({ kind: 'same-status-noop' })
    expect(resolveBoardStatusTarget('development', 'qa', [{ id: 'dev-review', from: 'development', to: 'review' }])).toEqual({ kind: 'no-matching-transition' })
  })

  it('preserves each transition identity for a chooser and executes the selected option only', async () => {
    const alternatives: WorkflowTransition[] = [
      { id: 'reopen', name: 'بازگشایی', from: 'done', to: 'inprogress' },
      { id: 'reopen-rejected', name: 'بازگشایی پس از رد', from: 'done', to: 'inprogress' },
    ]
    const transitionTask = vi.fn(async ({ transitionId }: { projectId: string; taskId: string; transitionId: string }) => ({ ok: true as const, code: 'transitioned' as const, transition: alternatives.find((item) => item.id === transitionId)! }))

    expect(resolveBoardStatusTarget('done', 'inprogress', alternatives)).toEqual({ kind: 'multiple-matching-transitions', transitionIds: ['reopen', 'reopen-rejected'] })
    await executeBoardTransitionById({ projectId: 'p1', taskId: 't1', transitionId: 'reopen', transitionTask })
    await executeBoardTransitionById({ projectId: 'p1', taskId: 't1', transitionId: 'reopen-rejected', transitionTask })
    expect(transitionTask).toHaveBeenNthCalledWith(1, { projectId: 'p1', taskId: 't1', transitionId: 'reopen' })
    expect(transitionTask).toHaveBeenNthCalledWith(2, { projectId: 'p1', taskId: 't1', transitionId: 'reopen-rejected' })
  })

  it('does not execute a transition when a chooser is cancelled before a selection', () => {
    const transitionTask = vi.fn()
    const alternatives: WorkflowTransition[] = [
      { id: 'reopen', from: 'done', to: 'inprogress' },
      { id: 'reopen-rejected', from: 'done', to: 'inprogress' },
    ]

    expect(resolveBoardStatusTarget('done', 'inprogress', alternatives)).toMatchObject({ kind: 'multiple-matching-transitions' })
    expect(transitionTask).not.toHaveBeenCalled()
  })
})
