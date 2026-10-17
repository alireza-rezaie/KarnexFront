import type { Project } from '@/types/project'

export const projectViewValues = ['all', 'archived'] as const
export type ProjectView = typeof projectViewValues[number]
export type ProjectListFilter = 'all' | 'active' | 'mine' | 'team'

export const parseProjectView = (value: string | null): ProjectView => (
  projectViewValues.find((view) => view === value) ?? 'all'
)

export function filterProjectsForView(
  projects: Project[],
  view: ProjectView,
  filter: ProjectListFilter,
  currentMemberProjectIds: string[] | undefined,
) {
  return projects.filter((project) => {
    if (view === 'archived' && project.status !== 'archived') return false
    if (filter === 'active' && project.status !== 'active') return false
    if (filter === 'mine') return currentMemberProjectIds?.includes(project.id) ?? false
    return true
  })
}
