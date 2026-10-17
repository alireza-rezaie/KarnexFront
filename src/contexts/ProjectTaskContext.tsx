import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { useTasks, type CreateTaskInput, type TaskUpdates } from '@/contexts/TasksContext'
import type { Task, TaskCapabilities, TaskCreateMutationResult, TaskDisplayCopy, TaskMutationResult } from '@/types/task'

export type ProjectTaskContextValue = {
  projectTasks: Task[]
  tasks: Task[]
  projectId: string | undefined
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: TaskCapabilities
  displayCopy: TaskDisplayCopy
  refreshTasks: () => Promise<void>
  updateTask: (taskId: Task['id'], updates: TaskUpdates) => Promise<TaskMutationResult>
  applyTaskTransition: (taskId: Task['id'], status: Task['status']) => Promise<TaskMutationResult>
  createTask: (input: CreateTaskInput) => Promise<TaskCreateMutationResult>
}

const ProjectTaskContext = createContext<ProjectTaskContextValue | undefined>(undefined)

export function ProjectTaskProvider({ children }: { children: ReactNode }) {
  const { currentProject } = useProject()
  const {
    tasks: allTasks,
    serviceAvailable,
    loading,
    error,
    capabilities,
    displayCopy,
    refreshTasks,
    createTask: createGlobalTask,
    updateTask: updateGlobalTask,
    applyTaskTransition: applyGlobalTaskTransition,
  } = useTasks()
  const projectId = currentProject?.id
  const projectTasks = useMemo(
    () => allTasks.filter((task) => task.projectId === projectId),
    [allTasks, projectId],
  )

  const updateTask = useCallback(async (taskId: Task['id'], updates: TaskUpdates): Promise<TaskMutationResult> => {
    if (!projectId || !projectTasks.some((task) => task.id === taskId)) {
      return { ok: false, message: 'وظیفه در پروژهٔ جاری پیدا نشد.' }
    }
    if (!updateGlobalTask) {
      return { ok: false, message: displayCopy.updateUnavailable }
    }

    return updateGlobalTask(taskId, updates)
  }, [displayCopy.updateUnavailable, projectId, projectTasks, updateGlobalTask])
  const applyTaskTransition = useCallback(async (taskId: Task['id'], status: Task['status']): Promise<TaskMutationResult> => {
    if (!projectId || !projectTasks.some((task) => task.id === taskId)) return { ok: false, message: 'وظیفه در پروژهٔ جاری پیدا نشد.' }
    return applyGlobalTaskTransition(taskId, status)
  }, [applyGlobalTaskTransition, projectId, projectTasks])

  const createTask = useCallback(async (input: CreateTaskInput): Promise<TaskCreateMutationResult> => {
    if (!projectId) {
      return { ok: false, message: 'پروژهٔ جاری برای ایجاد وظیفه در دسترس نیست.' }
    }
    if (!createGlobalTask) {
      return { ok: false, message: displayCopy.createUnavailable }
    }

    return createGlobalTask(projectId, input)
  }, [createGlobalTask, displayCopy.createUnavailable, projectId])

  const value = useMemo<ProjectTaskContextValue>(
    () => ({
      projectTasks,
      tasks: projectTasks,
      projectId,
      serviceAvailable,
      loading,
      error,
      capabilities,
      displayCopy,
      refreshTasks,
      updateTask,
      applyTaskTransition,
      createTask,
    }),
    [applyTaskTransition, capabilities, createTask, displayCopy, error, loading, projectId, projectTasks, refreshTasks, serviceAvailable, updateTask],
  )

  return <ProjectTaskContext.Provider value={value}>{children}</ProjectTaskContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjectTasks() {
  const context = useContext(ProjectTaskContext)

  if (!context) {
    throw new Error('useProjectTasks must be used within a ProjectTaskProvider.')
  }

  return context
}
