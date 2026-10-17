import { createContext, useContext, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/contexts/ProjectsContext'
import type { Project } from '@/types/project'

type ProjectContextValue = {
  projectId: string | undefined
  currentProject: Project | undefined
  projectExists: boolean
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams()
  const { projects } = useProjects()
  const currentProject = projects.find((project) => project.id === projectId)
  const projectExists = currentProject !== undefined

  return (
    <ProjectContext.Provider value={{ projectId, currentProject, projectExists }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function ProjectGuard({ children }: { children: ReactNode }) {
  const { currentProject, projectExists } = useProject()
  const { currentUserId } = useAuth()

  if (!projectExists || !currentProject) {
    return <div>پروژه پیدا نشد</div>
  }

  if (currentProject.privacy === 'private' && (!currentUserId || !currentProject.members.includes(currentUserId))) {
    return <div role="alert">دسترسی به این پروژه مجاز نیست.</div>
  }

  return children
}

// This hook is intentionally colocated with its provider for the project-scoped API.
// eslint-disable-next-line react-refresh/only-export-components
export function useProject() {
  const context = useContext(ProjectContext)

  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider.')
  }

  return context
}

// Sidebar is shared by public and project-scoped layouts.
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalProject() {
  return useContext(ProjectContext)
}
