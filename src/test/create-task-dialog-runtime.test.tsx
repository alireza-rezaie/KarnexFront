import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createTask: vi.fn(), onOpenChange: vi.fn(), statuses: [{ id: 'workflow-ready', name: 'آماده', color: '#64748b' }] }))

vi.mock('@/contexts/ProjectContext', () => ({ useProject: () => ({ projectId: 'project-runtime', currentProject: { type: 'scrum' } }) }))
vi.mock('@/contexts/MembersContext', () => ({ useMembers: () => ({ members: [] }) }))
vi.mock('@/contexts/CurrentUserContext', () => ({ useCurrentUser: () => ({ currentMember: null }) }))
vi.mock('@/contexts/ProjectStatusContext', () => ({ useProjectStatus: () => ({ statuses: mocks.statuses }) }))
vi.mock('@/contexts/ProjectTaskContext', () => ({ useProjectTasks: () => ({ serviceAvailable: false, loading: false, error: null, capabilities: { canCreateTask: true }, displayCopy: { loading: '', createUnavailable: '' }, createTask: mocks.createTask }) }))
vi.mock('@/contexts/SprintsContext', () => ({ useSprints: () => ({ sprints: [] }) }))

import { CreateTaskDialog } from '@/components/CreateTaskDialog'

afterEach(() => {
  cleanup()
  mocks.createTask.mockReset()
  mocks.onOpenChange.mockReset()
})

describe('runtime task creation dialog', () => {
  it('uses the active workflow status, permits empty optional relations, and ignores backend availability', async () => {
    mocks.createTask.mockResolvedValue({ ok: true, task: { id: 'runtime-task-created' } })
    render(<CreateTaskDialog open onOpenChange={mocks.onOpenChange} />)

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[0]?.value).toBe('workflow-ready')
    expect(Array.from(selects[2]?.options ?? []).map((option) => option.value)).toEqual([''])
    expect(Array.from(selects[3]?.options ?? []).map((option) => option.value)).toEqual([''])

    fireEvent.change(screen.getByPlaceholderText('عنوان وظیفه'), { target: { value: 'وظیفهٔ واقعی' } })
    fireEvent.change(screen.getByPlaceholderText('توضیحات...'), { target: { value: 'شرح معتبر' } })
    const submit = screen.getByRole('button', { name: 'ایجاد وظیفه' })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'workflow-ready', assignee: '', sprintId: undefined, reporter: '' })))
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false)
  })
})
