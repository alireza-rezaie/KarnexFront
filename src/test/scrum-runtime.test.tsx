import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { MembersProvider } from '@/contexts/MembersContext'
import { SprintsProvider, useSprints } from '@/contexts/SprintsContext'
import { TasksProvider, useTasks } from '@/contexts/TasksContext'
import { WorkflowCatalogProvider, useWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import { ProjectBoardProvider, useProjectBoard } from '@/contexts/ProjectBoardContext'
import { TerminalStatusPolicyProvider } from '@/contexts/TerminalStatusPolicyContext'
import { getProjectMethodologyCapabilities, selectBoardWork } from '@/utils/projectMethodology'

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><ProjectsProvider><SprintsProvider><TasksProvider><WorkflowCatalogProvider><ProjectBoardProvider><TerminalStatusPolicyProvider>{children}</TerminalStatusPolicyProvider></ProjectBoardProvider></WorkflowCatalogProvider></TasksProvider></SprintsProvider></ProjectsProvider></MembersProvider></AuthenticatedTestProvider>
}

function useScrumRuntime() {
  return { projects: useProjects(), sprints: useSprints(), tasks: useTasks(), workflows: useWorkflowCatalog(), board: useProjectBoard() }
}

describe('Scrum runtime lifecycle', () => {
  it('creates, starts, and completes a Scrum sprint in session memory', async () => {
    const { result } = renderHook(() => useScrumRuntime(), { wrapper: Wrapper })
    let projectId = ''
    await act(async () => {
      const created = await result.current.projects.createProject?.({ key: 'SPRINTAUTH', name: 'پروژه اسپرینت', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0 })
      projectId = created?.ok ? created.project.id : ''
    })
    expect(projectId).toBeTruthy()

    await act(async () => {
      expect(await result.current.sprints.createSprint?.(projectId, {
        name: 'اسپرینت واقعی', goal: '', status: 'planned', startDate: '1404/01/01', endDate: '1404/01/14', duration: 2,
      })).toEqual({ ok: true })
    })
    const createdSprint = result.current.sprints.sprints.find((item) => item.name === 'اسپرینت واقعی')
    expect(createdSprint?.status).toBe('planned')

    await act(async () => {
      expect(await result.current.sprints.startSprint?.(projectId, createdSprint!.id)).toEqual({ ok: true })
    })
    expect(result.current.sprints.sprints.find((item) => item.id === createdSprint!.id)?.status).toBe('active')

    await act(async () => {
      expect(await result.current.sprints.completeSprint?.(projectId, createdSprint!.id, { kind: 'backlog' })).toEqual({ ok: true })
    })
    expect(result.current.sprints.sprints.find((item) => item.id === createdSprint!.id)?.status).toBe('completed')
  })

  it('never gives Kanban projects a sprint lifecycle', async () => {
    const { result } = renderHook(() => useScrumRuntime(), { wrapper: Wrapper })
    expect(getProjectMethodologyCapabilities('kanban').supportsSprints).toBe(false)
    await act(async () => {
      expect(await result.current.sprints.createSprint?.('p3', {
        name: 'اسپرینت کانبان', goal: '', status: 'planned', startDate: '1404/01/01', endDate: '1404/01/14', duration: 2,
      })).toMatchObject({ ok: false })
    })
  })

  it('moves only unfinished work to the explicit completion destination', async () => {
    const { result } = renderHook(() => useScrumRuntime(), { wrapper: Wrapper })
    let projectId = ''
    let activeId = ''
    let futureId = ''
    await act(async () => {
      const project = await result.current.projects.createProject?.({ key: 'SPRINTMOVE', name: 'جابجایی اسپرینت', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0 })
      projectId = project?.ok ? project.project.id : ''
    })
    await act(async () => {
      const active = await result.current.sprints.createSprint?.(projectId, { name: 'فعال', goal: '', status: 'planned', startDate: '1404/01/01', endDate: '1404/01/14', duration: 2 })
      activeId = active?.ok ? active.sprint?.id ?? '' : ''
    })
    await act(async () => {
      const future = await result.current.sprints.createSprint?.(projectId, { name: 'آینده', goal: '', status: 'planned', startDate: '1404/01/15', endDate: '1404/01/28', duration: 2 })
      futureId = future?.ok ? future.sprint?.id ?? '' : ''
    })
    await act(async () => {
      await result.current.sprints.startSprint?.(projectId, activeId)
    })
    await act(async () => {
      const base = { key: 'MOVE-1', title: 'تمام‌شده', description: '', type: 'task' as const, priority: 'medium' as const, assignee: '', reporter: '', labels: [], createdAt: '', updatedAt: '', comments: 0, attachments: 0, subtasks: 0, completedSubtasks: 0, sprintId: activeId }
      await result.current.tasks.createTask(projectId, { ...base, status: 'done' })
      await result.current.tasks.createTask(projectId, { ...base, key: 'MOVE-2', title: 'ناتمام', status: 'todo' })
    })
    await act(async () => {
      expect(await result.current.sprints.completeSprint?.(projectId, activeId, { kind: 'future-sprint', sprintId: futureId })).toEqual({ ok: true })
    })
    const completed = result.current.tasks.tasks.find((task) => task.key === 'MOVE-1')!
    const unfinished = result.current.tasks.tasks.find((task) => task.key === 'MOVE-2')!
    expect(completed).toMatchObject({ sprintId: activeId, status: 'done' })
    expect(unfinished).toMatchObject({ sprintId: futureId, status: 'todo' })
    expect(result.current.sprints.sprints.find((sprint) => sprint.id === activeId)?.status).toBe('completed')
  })

  it('rejects an invalid destination atomically and can resolve unfinished work to backlog', async () => {
    const { result } = renderHook(() => useScrumRuntime(), { wrapper: Wrapper })
    let projectId = ''
    let activeId = ''
    await act(async () => {
      const project = await result.current.projects.createProject?.({ key: 'SPRINTBACKLOG', name: 'بازگشت به بک‌لاگ', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0 })
      projectId = project?.ok ? project.project.id : ''
    })
    await act(async () => {
      const active = await result.current.sprints.createSprint?.(projectId, { name: 'فعال', goal: '', status: 'planned', startDate: '1404/02/01', endDate: '1404/02/14', duration: 2 })
      activeId = active?.ok ? active.sprint?.id ?? '' : ''
    })
    await act(async () => {
      await result.current.sprints.startSprint?.(projectId, activeId)
    })
    await act(async () => {
      await result.current.tasks.createTask(projectId, { key: 'BACKLOG-1', title: 'کار ناتمام', description: '', status: 'todo', type: 'task', priority: 'medium', assignee: '', reporter: '', labels: [], createdAt: '', updatedAt: '', comments: 0, attachments: 0, subtasks: 0, completedSubtasks: 0, sprintId: activeId })
    })
    await act(async () => {
      expect(await result.current.sprints.completeSprint?.(projectId, activeId, { kind: 'future-sprint', sprintId: 'unknown-sprint' })).toMatchObject({ ok: false })
    })
    expect(result.current.sprints.sprints.find((sprint) => sprint.id === activeId)?.status).toBe('active')
    expect(result.current.tasks.tasks.find((task) => task.key === 'BACKLOG-1')?.sprintId).toBe(activeId)
    await act(async () => {
      expect(await result.current.sprints.completeSprint?.(projectId, activeId, { kind: 'backlog' })).toEqual({ ok: true })
    })
    expect(result.current.tasks.tasks.find((task) => task.key === 'BACKLOG-1')?.sprintId).toBeUndefined()
    expect(result.current.sprints.sprints.find((sprint) => sprint.id === activeId)?.status).toBe('completed')
  })

  it('uses the custom workflow final Board mapping instead of the literal done ID when completing a Sprint', async () => {
    const { result } = renderHook(() => useScrumRuntime(), { wrapper: Wrapper })
    let projectId = ''
    let activeId = ''
    let futureId = ''
    await act(async () => {
      const project = await result.current.projects.createProject?.({ key: 'CUSTOMTERM', name: 'ترمینال سفارشی', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0 })
      projectId = project?.ok ? project.project.id : ''
    })
    let workflowId = ''
    const statuses = [{ id: 'todo-x', name: 'آماده', color: '#64748b' }, { id: 'done', name: 'قدیمی', color: '#f59e0b' }, { id: 'release-x', name: 'انتشار', color: '#22c55e' }]
    await act(async () => {
      const workflow = await result.current.workflows.createWorkflow({ name: 'انتشار سفارشی', statuses, transitions: [] })
      workflowId = workflow.ok && workflow.workflow ? workflow.workflow.id : ''
    })
    await act(async () => {
      expect(await result.current.workflows.assignWorkflow(projectId, workflowId)).toMatchObject({ ok: true })
      expect(await result.current.board.updateBoardConfiguration(projectId, [
        { id: 'todo-column', name: 'آماده', order: 0, statusIds: ['todo-x', 'done'] },
        { id: 'release-column', name: 'انتشار', order: 1, statusIds: ['release-x'] },
      ], statuses)).toMatchObject({ ok: true })
    })
    await act(async () => {
      const active = await result.current.sprints.createSprint?.(projectId, { name: 'فعال', goal: '', status: 'planned', startDate: '1405/01/01', endDate: '1405/01/14', duration: 2 })
      activeId = active?.ok ? active.sprint?.id ?? '' : ''
    })
    await act(async () => {
      const future = await result.current.sprints.createSprint?.(projectId, { name: 'آینده', goal: '', status: 'planned', startDate: '1405/01/15', endDate: '1405/01/28', duration: 2 })
      futureId = future?.ok ? future.sprint?.id ?? '' : ''
      await result.current.sprints.startSprint?.(projectId, activeId)
    })
    await act(async () => {
      const base = { description: '', type: 'task' as const, priority: 'medium' as const, assignee: '', reporter: '', labels: [], createdAt: '', updatedAt: '', comments: 0, attachments: 0, subtasks: 0, completedSubtasks: 0, sprintId: activeId }
      await result.current.tasks.createTask(projectId, { ...base, key: 'TERM-1', title: 'انتشار شده', status: 'release-x' })
      await result.current.tasks.createTask(projectId, { ...base, key: 'TERM-2', title: 'done غیرنهایی', status: 'done' })
    })
    await act(async () => {
      expect(await result.current.sprints.completeSprint?.(projectId, activeId, { kind: 'future-sprint', sprintId: futureId })).toEqual({ ok: true })
    })
    expect(result.current.tasks.tasks.find((task) => task.key === 'TERM-1')).toMatchObject({ sprintId: activeId, status: 'release-x' })
    expect(result.current.tasks.tasks.find((task) => task.key === 'TERM-2')).toMatchObject({ sprintId: futureId, status: 'done' })
  })

  it('selects only active-sprint work for a Scrum board and keeps future/backlog work out', () => {
    const { result } = renderHook(() => useScrumRuntime(), { wrapper: Wrapper })
    const projectTasks = result.current.tasks.tasks.filter((item) => item.projectId === 'p1')
    const activeSprintId = result.current.sprints.sprints.find((item) => item.projectId === 'p1' && item.status === 'active')?.id
    const visible = selectBoardWork('active-sprint', projectTasks, activeSprintId)

    expect(visible.every((task) => task.sprintId === activeSprintId)).toBe(true)
    expect(selectBoardWork('active-sprint', projectTasks, undefined)).toEqual([])
  })
})
