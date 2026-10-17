import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ProjectBoardProvider, useProjectBoard } from '@/contexts/ProjectBoardContext'
import { WorkflowCatalogProvider, useWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { resolveTaskBoardColumn } from '@/types/board'
import type { StatusDefinition } from '@/types/status'

function Wrapper({ children }: { children: ReactNode }) {
  return <ProjectBoardProvider>{children}</ProjectBoardProvider>
}

function CatalogWrapper({ children }: { children: ReactNode }) {
  return <TasksProvider><WorkflowCatalogProvider><ProjectBoardProvider>{children}</ProjectBoardProvider></WorkflowCatalogProvider></TasksProvider>
}

const workflowV1: StatusDefinition[] = [
  { id: 'todo', name: 'برای انجام', color: '#64748b' },
  { id: 'inprogress', name: 'در حال انجام', color: '#3b82f6' },
  { id: 'review', name: 'بازبینی', color: '#8b5cf6' },
  { id: 'done', name: 'انجام شد', color: '#22c55e' },
]

describe('project board workflow mappings', () => {
  it('derives an uncustomized board from the active published workflow in workflow order', () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    const columns = result.current.resolveColumns('project-a', workflowV1)

    expect(columns.map((column) => [column.name, column.statusIds])).toEqual(workflowV1.map((status) => [status.name, [status.id]]))
    expect(result.current.getBoardConfiguration('project-a', workflowV1).isCustomized).toBe(false)
  })

  it('supports grouped statuses while preserving the task exact workflow status', async () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    const grouped = [
      { id: 'todo-column', name: 'برای انجام', order: 0, statusIds: ['todo'] },
      { id: 'active-column', name: 'در جریان', order: 1, statusIds: ['inprogress', 'review'] },
      { id: 'done-column', name: 'انجام شد', order: 2, statusIds: ['done'] },
    ]

    await act(async () => {
      await result.current.updateBoardConfiguration('project-a', grouped, workflowV1)
    })

    const activeColumn = resolveTaskBoardColumn(result.current.resolveColumns('project-a', workflowV1), 'review')
    expect(activeColumn?.id).toBe('active-column')
    expect(activeColumn?.statusIds).toContain('review')
    expect('review').toBe('review')
  })

  it('rejects duplicate status mappings and never assigns an unmapped status to another column', async () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    const duplicate = [
      { id: 'one', name: 'یک', order: 0, statusIds: ['todo', 'review'] },
      { id: 'two', name: 'دو', order: 1, statusIds: ['review'] },
    ]
    let response
    await act(async () => {
      response = await result.current.updateBoardConfiguration('project-a', duplicate, workflowV1)
    })

    expect(response).toMatchObject({ ok: false })
    expect(resolveTaskBoardColumn(result.current.resolveColumns('project-a', workflowV1), 'unknown')).toBeUndefined()
  })

  it('regenerates a default mapping after publish, while a custom mapping preserves its valid statuses', async () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    const workflowV2 = [...workflowV1, { id: 'ready', name: 'آماده', color: '#0ea5e9' }]
    expect(result.current.resolveColumns('default-project', workflowV2).map((column) => column.statusIds[0])).toContain('ready')

    await act(async () => {
      await result.current.updateBoardConfiguration('custom-project', [
        { id: 'active', name: 'فعال', order: 0, statusIds: ['inprogress', 'review'] },
        { id: 'finished', name: 'اتمام', order: 1, statusIds: ['done'] },
      ], workflowV1)
    })

    const customColumns = result.current.resolveColumns('custom-project', workflowV2)
    expect(customColumns.flatMap((column) => column.statusIds)).not.toContain('ready')
    expect(customColumns.find((column) => column.id === 'active')?.statusIds).toEqual(['inprogress', 'review'])
  })

  it('does not expose an editor draft to the board until that workflow version is published', async () => {
    const { result } = renderHook(() => ({ board: useProjectBoard(), catalog: useWorkflowCatalog() }), { wrapper: CatalogWrapper })
    const active = result.current.catalog.getActiveWorkflow('project-published')!
    const draft = {
      statuses: [...active.statuses, { id: 'ready', name: 'آماده', color: '#0ea5e9' }],
      transitions: active.transitions,
    }

    expect(result.current.board.resolveColumns('project-published', active.statuses).flatMap((column) => column.statusIds)).not.toContain('ready')

    await act(async () => {
      await result.current.catalog.publishWorkflow(active.workflowId, draft)
    })

    const published = result.current.catalog.getActiveWorkflow('project-published')!
    expect(result.current.board.resolveColumns('project-published', published.statuses).flatMap((column) => column.statusIds)).toContain('ready')
  })

  it('keeps board configurations project-scoped even for a shared workflow', async () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.updateBoardConfiguration('project-a', [
        { id: 'a-flow', name: 'جریان A', order: 0, statusIds: ['todo', 'inprogress', 'review'] },
      ], workflowV1)
      await result.current.updateBoardConfiguration('project-b', [
        { id: 'b-flow', name: 'جریان B', order: 0, statusIds: ['todo'] },
        { id: 'b-done', name: 'اتمام B', order: 1, statusIds: ['done'] },
      ], workflowV1)
    })

    expect(result.current.resolveColumns('project-a', workflowV1).map((column) => column.id)).toEqual(['a-flow'])
    expect(result.current.resolveColumns('project-b', workflowV1).map((column) => column.id)).toEqual(['b-flow', 'b-done'])
  })

  it('stores only status ids and accepts arbitrary published workflow statuses without a hardcoded column authority', async () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    const customWorkflow = [{ id: 'triage', name: 'تریاژ', color: '#f59e0b' }]
    const defaultColumn = result.current.resolveColumns('project-custom', customWorkflow)[0]

    await act(async () => {
      await result.current.updateBoardConfiguration('project-custom', [defaultColumn], customWorkflow)
    })

    const stored = result.current.configurations.find((configuration) => configuration.projectId === 'project-custom')!
    expect(stored.columns[0]).toMatchObject({ statusIds: ['triage'] })
    expect('statuses' in stored.columns[0]).toBe(false)
    expect('statusColor' in stored.columns[0]).toBe(false)
  })
})
