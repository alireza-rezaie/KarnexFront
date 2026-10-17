import { useParams } from 'react-router-dom'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import type { ReactNode } from 'react'

export function TaskRouteGuard({ children }: { children: ReactNode }) {
  const { taskId } = useParams()
  const { projectId } = useProject()
  const { tasks } = useProjectTasks()
  const taskExists = tasks.some((task) => task.id === taskId && task.projectId === projectId)

  if (!taskExists) {
    return <div>وظیفه پیدا نشد</div>
  }

  return children
}
