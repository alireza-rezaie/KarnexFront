import { describe, expect, it } from 'vitest'
import { filterProjectsForView, parseProjectView } from '@/utils/projectView'
import type { Project } from '@/types/project'

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-a',
  key: 'A',
  name: 'Project A',
  description: '',
  type: 'scrum',
  status: 'active',
  privacy: 'private',
  icon: 'folder-kanban',
  color: '#000',
  progress: 0,
  members: [],
  startDate: '',
  endDate: '',
  tasksCount: 0,
  completedTasks: 0,
  ...overrides,
})

describe('project list views', () => {
  it('shows only archived projects in archived view', () => {
    const projects = [project(), project({ id: 'project-archived', status: 'archived' })]

    expect(filterProjectsForView(projects, 'archived', 'all', undefined).map((item) => item.id)).toEqual(['project-archived'])
  })

  it('keeps normal projects visible in the all view', () => {
    const projects = [project(), project({ id: 'project-archived', status: 'archived' })]

    expect(filterProjectsForView(projects, 'all', 'all', undefined).map((item) => item.id)).toEqual(['project-a', 'project-archived'])
  })

  it('falls back to the normal view for an invalid query value', () => {
    expect(parseProjectView('garbage')).toBe('all')
  })

  it('intersects My Projects membership with the archived view', () => {
    const projects = [project({ id: 'mine-archived', status: 'archived' }), project({ id: 'other-archived', status: 'archived' }), project({ id: 'mine-active' })]

    expect(filterProjectsForView(projects, 'archived', 'mine', ['mine-archived', 'mine-active']).map((item) => item.id)).toEqual(['mine-archived'])
  })
})
