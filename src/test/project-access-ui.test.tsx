import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProjectSettingsPage from '@/pages/ProjectSettingsPage'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectWorkflowProvider } from '@/contexts/ProjectWorkflowContext'
import { WorkflowCatalogProvider } from '@/contexts/WorkflowCatalogContext'

const projectId = 'p1'

function AccessProbe() {
  const { projects } = useProjects()
  const { members } = useMembers()
  const project = projects.find((item) => item.id === projectId)
  return <output data-testid="access-probe">{JSON.stringify({ members: project?.members, roles: project?.memberRoles, globalMember: members.find((member) => member.id === 'm8')?.roleId })}</output>
}

function Wrapper({ children, userId = 'm1' }: { children?: ReactNode; userId?: string }) {
  return <AuthenticatedTestProvider userId={userId}><MembersProvider><ProjectsProvider><RolesProvider><TasksProvider><WorkflowCatalogProvider><MemoryRouter initialEntries={[`/projects/${projectId}/settings`]}><Routes><Route path="/projects/:projectId/*" element={<ProjectProvider><ProjectWorkflowProvider><AccessProbe />{children ?? <ProjectSettingsPage />}</ProjectWorkflowProvider></ProjectProvider>} /></Routes></MemoryRouter></WorkflowCatalogProvider></TasksProvider></RolesProvider></ProjectsProvider></MembersProvider></AuthenticatedTestProvider>
}

afterEach(cleanup)

describe('project access UI', () => {
  it('adds an existing global member with a project-only role and removes only project access', async () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByRole('button', { name: 'دسترسی' }))

    const memberSelect = screen.getByLabelText('افزودن عضو به پروژه') as HTMLSelectElement
    expect(Array.from(memberSelect.options, (option) => option.value)).not.toContain('m1')
    expect(Array.from(memberSelect.options, (option) => option.value)).toContain('m8')
    fireEvent.change(memberSelect, { target: { value: 'm8' } })
    fireEvent.change(screen.getByLabelText('نقش عضو جدید'), { target: { value: 'sm' } })
    fireEvent.click(screen.getByRole('button', { name: 'افزودن عضو' }))

    await waitFor(() => expect((screen.getByLabelText('نقش فاطمه نوری') as HTMLSelectElement).value).toBe('sm'))
    expect(screen.getByTestId('access-probe').textContent).toContain('"m8":"sm"')
    expect(screen.getByTestId('access-probe').textContent).not.toContain('"globalMember":"sm"')

    fireEvent.click(screen.getByRole('button', { name: 'حذف دسترسی فاطمه نوری' }))
    await waitFor(() => expect(screen.queryByLabelText('نقش فاطمه نوری')).toBeNull())
    expect(screen.getByTestId('access-probe').textContent).not.toContain('"globalMember":"sm"')
  })

  it('keeps access controls read-only for a non-manager project member', () => {
    render(<Wrapper userId="m2" />)
    fireEvent.click(screen.getByRole('button', { name: 'دسترسی' }))

    expect(screen.queryByLabelText('افزودن عضو به پروژه')).toBeNull()
    expect((screen.getByLabelText('نقش سارا محمدی') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'حذف دسترسی سارا محمدی' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
