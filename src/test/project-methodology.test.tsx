import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { MembersProvider } from '@/contexts/MembersContext'
import type { CreateProjectInput } from '@/types/project'
import { getProjectMethodologyCapabilities } from '@/utils/projectMethodology'

const projectInput = (type: CreateProjectInput['type']): CreateProjectInput => ({
  key: `METHOD-${type.toUpperCase()}`,
  name: `پروژه ${type}`,
  description: '',
  type,
  status: 'active',
  privacy: 'private',
  icon: 'folder-kanban',
  color: '#3b82f6',
  progress: 0,
  members: [],
  startDate: '',
  endDate: '',
  tasksCount: 0,
  completedTasks: 0,
})

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><ProjectsProvider>{children}</ProjectsProvider></MembersProvider></AuthenticatedTestProvider>
}

describe('project methodologies', () => {
  it('gives Scrum sprint planning and active-sprint board selection', () => {
    expect(getProjectMethodologyCapabilities('scrum')).toMatchObject({
      supportsSprints: true,
      supportsBacklog: true,
      supportsWipLimits: false,
      boardWorkSelectionMode: 'active-sprint',
    })
  })

  it('gives Kanban continuous flow without a sprint requirement and with WIP capability', () => {
    expect(getProjectMethodologyCapabilities('kanban')).toMatchObject({
      supportsSprints: false,
      supportsBacklog: true,
      supportsWipLimits: true,
      boardWorkSelectionMode: 'continuous-flow',
    })
  })

  it('preserves methodology through runtime creation and update without changing workflow-owned data', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: Wrapper })
    let createdId = ''

    await act(async () => {
      const created = await result.current.createProject?.(projectInput('kanban'))
      expect(created).toMatchObject({ ok: true, project: { type: 'kanban' } })
      if (created?.ok) createdId = created.project.id
    })

    await act(async () => {
      const updated = await result.current.updateProject?.(createdId, { type: 'scrum' })
      expect(updated).toMatchObject({ ok: true, project: { id: createdId, type: 'scrum', key: 'METHOD-KANBAN' } })
    })

    expect(result.current.projects.find((project) => project.id === createdId)?.type).toBe('scrum')
    expect(getProjectMethodologyCapabilities('scrum')).not.toHaveProperty('workflow')
  })
})
