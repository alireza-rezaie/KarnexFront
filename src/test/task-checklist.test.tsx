import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Checklist } from '@/pages/TaskDetailPage'
import { TasksProvider, useTasks } from '@/contexts/TasksContext'
import type { TaskChecklistItem } from '@/types/task'

function Harness({ kind, initialCompleted = false, fail = false }: { kind: 'subtask' | 'acceptance'; initialCompleted?: boolean; fail?: boolean }) {
  const [items, setItems] = useState<TaskChecklistItem[]>([{ id: 'item-1', title: `${kind}-item`, completed: initialCompleted }])
  const toggle = async (_kind: 'subtask' | 'acceptance', itemId: string) => {
    if (fail) return
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, completed: !item.completed } : item))
  }
  return <Checklist items={items} kind={kind} disabled={false} pendingItem={null} onToggle={toggle} />
}

describe('Task detail checklists', () => {
  afterEach(cleanup)
  it('checks and unchecks a subtask through the controlled checkbox', async () => {
    render(<Harness kind="subtask" />)
    const checkbox = screen.getByRole('checkbox', { name: /subtask-item/ })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    fireEvent.keyDown(checkbox, { key: ' ' })
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('true'))
    fireEvent.keyDown(checkbox, { key: ' ' })
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('false'))
  })

  it('checks and unchecks an acceptance criterion through the controlled checkbox', async () => {
    render(<Harness kind="acceptance" initialCompleted />)
    const checkbox = screen.getByRole('checkbox', { name: /acceptance-item/ })
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('false'))
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('true'))
  })

  it('does not show a changed checkbox when the authoritative mutation fails', async () => {
    render(<Harness kind="subtask" fail />)
    const checkbox = screen.getByRole('checkbox', { name: /subtask-item/ })
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('false'))
  })

  it('does not show a changed acceptance criterion when the authoritative mutation fails', async () => {
    render(<Harness kind="acceptance" fail />)
    const checkbox = screen.getByRole('checkbox', { name: /acceptance-item/ })
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe('false'))
  })

  it('updates only checklist fields through TasksContext without changing workflow status or unrelated task fields', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <TasksProvider>{children}</TasksProvider>
    const { result } = renderHook(() => useTasks(), { wrapper })
    const original = result.current.tasks[0]!
    const subtaskItems: TaskChecklistItem[] = [{ id: 'subtask-0', title: 'پیاده‌سازی سرویس اتصال به درگاه', completed: true }]
    const acceptanceCriteria: TaskChecklistItem[] = [{ id: 'acceptance-0', title: 'اتصال موفق به API درگاه پرداخت', completed: true }]
    await act(async () => {
      expect((await result.current.updateTask(original.id, { subtaskItems, acceptanceCriteria, subtasks: 1, completedSubtasks: 1 })).ok).toBe(true)
    })
    const updated = result.current.tasks.find((task) => task.id === original.id)!
    expect(updated.subtaskItems).toEqual(subtaskItems)
    expect(updated.acceptanceCriteria).toEqual(acceptanceCriteria)
    expect(updated.status).toBe(original.status)
    expect(updated.title).toBe(original.title)
    expect(updated.assignee).toBe(original.assignee)
  })
})
