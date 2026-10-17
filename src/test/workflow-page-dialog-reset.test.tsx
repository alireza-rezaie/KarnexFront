import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import WorkflowPage from '@/pages/WorkflowPage'
import { CurrentUserProvider } from '@/contexts/CurrentUserContext'
import { MembersProvider } from '@/contexts/MembersContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectStatusProvider } from '@/contexts/ProjectStatusContext'
import { ProjectTaskProvider } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider } from '@/contexts/ProjectWorkflowContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { SprintsProvider } from '@/contexts/SprintsContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { AuthProvider } from '@/contexts/AuthContext'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
vi.stubGlobal('SVGPathElement', SVGElement)
vi.stubGlobal('SVGTextElement', SVGElement)

function WorkflowProviders({ children }: { children: ReactNode }) {
  return <AuthProvider><MembersProvider><RolesProvider><ProjectsProvider><SprintsProvider><TasksProvider><MemoryRouter initialEntries={['/projects/p1/workflow']}><Routes><Route path="/projects/:projectId/workflow" element={<CurrentUserProvider><ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider>{children}</ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider></CurrentUserProvider>} /></Routes></MemoryRouter></TasksProvider></SprintsProvider></ProjectsProvider></RolesProvider></MembersProvider></AuthProvider>
}

afterEach(cleanup)
afterAll(() => vi.unstubAllGlobals())

describe('WorkflowPage dialog drafts', () => {
  it('clears an abandoned status draft when the dialog is closed and reopened', () => {
    render(<WorkflowProviders><WorkflowPage /></WorkflowProviders>)

    fireEvent.click(screen.getByRole('button', { name: 'افزودن وضعیت' }))
    const input = screen.getByPlaceholderText('مثلاً آماده انتشار')
    fireEvent.change(input, { target: { value: 'وضعیت موقت' } })
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'افزودن وضعیت' }))
    expect((screen.getByPlaceholderText('مثلاً آماده انتشار') as HTMLInputElement).value).toBe('')
  })
})
