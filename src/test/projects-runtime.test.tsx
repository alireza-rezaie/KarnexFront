import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInitialProjects, ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { MembersProvider } from '@/contexts/MembersContext'
import type { CreateProjectInput, Project } from '@/types/project'

const input: CreateProjectInput = {
  key: 'RUNTIME', name: 'پروژهٔ نشست', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0,
}

type TestFixtures = { projects: Project[] }
const fixtures = (globalThis as { __karnexTestFixtures?: TestFixtures }).__karnexTestFixtures
let previousProjects: Project[] | undefined

function ProviderWrapper({ children }: { children: ReactNode }) {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><ProjectsProvider>{children}</ProjectsProvider></MembersProvider></AuthenticatedTestProvider>
}

function NavigationProbe() {
  const { projects, createProject } = useProjects()
  const navigate = useNavigate()
  const location = useLocation()
  return <><button onClick={() => void createProject?.(input)}>create</button><button onClick={() => navigate('/other')}>navigate</button><output>{location.pathname}:{projects.map((project) => project.id).join(',')}</output></>
}

beforeEach(() => {
  previousProjects = fixtures?.projects
  if (fixtures) fixtures.projects = []
})

afterEach(() => {
  if (fixtures && previousProjects) fixtures.projects = previousProjects
  vi.restoreAllMocks()
})

describe('frontend project runtime', () => {
  it('starts production with no projects and never seeds demo projects', () => {
    expect(getInitialProjects('production', { projects: [input as Project] })).toEqual([])
  })

  it('returns the authority-created project, keeps it in context, and does not persist it to localStorage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useProjects(), { wrapper: ProviderWrapper })

    expect(result.current.projects).toEqual([])
    let created: Awaited<ReturnType<NonNullable<typeof result.current.createProject>>> | undefined
    await act(async () => { created = await result.current.createProject?.(input) })

    expect(created).toMatchObject({ ok: true, project: expect.objectContaining({ name: input.name, key: input.key }) })
    expect(created?.ok && created.project.id).toMatch(/^runtime-/)
    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects[0]).toBe(created?.ok ? created.project : undefined)
    expect(storage).not.toHaveBeenCalled()
  })

  it('enables project settings updates in the session runtime', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: ProviderWrapper })
    let projectId = ''
    await act(async () => {
      const created = await result.current.createProject?.(input)
      projectId = created?.ok ? created.project.id : ''
    })
    expect(result.current.settingsServiceAvailable).toBe(true)
    expect(result.current.settingsCapabilities.canUpdateProject).toBe(true)
    await act(async () => { await result.current.updateProject?.(projectId, { name: 'پروژهٔ ویرایش‌شده' }) })
    expect(result.current.projects.find((project) => project.id === projectId)?.name).toBe('پروژهٔ ویرایش‌شده')
  })

  it('keeps a created project available while the user navigates in the same runtime', async () => {
    render(<MemoryRouter initialEntries={['/projects']}><ProjectsProvider><NavigationProbe /></ProjectsProvider></MemoryRouter>)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'create' })) })
    const createdId = screen.getByRole('status').textContent?.split(':')[1]
    fireEvent.click(screen.getByRole('button', { name: 'navigate' }))

    expect(screen.getByRole('status').textContent).toBe(`/other:${createdId}`)
  })
})
