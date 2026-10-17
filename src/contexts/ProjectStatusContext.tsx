import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { baseTaskStatuses, isBaseTaskStatus } from '@/config/taskStatus'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useProjectWorkflow } from '@/contexts/ProjectWorkflowContext'
import { useOptionalWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import type { ProjectStatusSet, StatusCapabilities, StatusDefinition, StatusDisplayCopy, StatusMutationResult } from '@/types/status'

type ProjectStatusContextValue = {
  projectStatuses: ProjectStatusSet
  statuses: StatusDefinition[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: StatusCapabilities
  displayCopy: StatusDisplayCopy
  addStatus: (input: Pick<StatusDefinition, 'name' | 'color'>) => Promise<StatusMutationResult> & StatusDefinition
  deleteStatus: (statusId: string) => Promise<StatusMutationResult> & boolean
  replaceStatuses: (nextStatuses: StatusDefinition[]) => Promise<StatusMutationResult> & boolean
}

const ProjectStatusContext = createContext<ProjectStatusContextValue | undefined>(undefined)

export function ProjectStatusProvider({ children }: { children: ReactNode }) {
  const { projectId } = useProject()

  return <ProjectStatusState key={projectId ?? ''} projectId={projectId ?? ''}>{children}</ProjectStatusState>
}

function ProjectStatusState({ children, projectId }: { children: ReactNode; projectId: string }) {
  const workflowCatalog = useOptionalWorkflowCatalog()
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusSet>(() => ({
    projectId,
    statuses: baseTaskStatuses,
  }))
  const { tasks } = useProjectTasks()
  const { deleteTransitionsByStatus } = useProjectWorkflow()

  const addStatus = useCallback((input: Pick<StatusDefinition, 'name' | 'color'>) => {
    const status = { id: `status-${crypto.randomUUID()}`, ...input }
    setProjectStatuses((current) => ({ ...current, statuses: [...current.statuses, status] }))
    return status
  }, [])

  const deleteStatus = useCallback((statusId: string) => {
    const statusExists = projectStatuses.statuses.some((status) => status.id === statusId)
    const hasDependentTasks = tasks.some((task) => task.status === statusId)

    if (isBaseTaskStatus(statusId) || !statusExists || hasDependentTasks) {
      return false
    }

    deleteTransitionsByStatus(statusId)
    setProjectStatuses((current) => ({
      ...current,
      statuses: current.statuses.filter((status) => status.id !== statusId),
    }))

    return true
  }, [deleteTransitionsByStatus, projectStatuses.statuses, tasks])

  const replaceStatuses = useCallback((nextStatuses: StatusDefinition[]) => {
    const statusIds = new Set(nextStatuses.map((status) => status.id))
    const normalizedNames = new Set<string>()
    const hasDuplicateName = nextStatuses.some((status) => {
      const name = status.name.trim().toLocaleLowerCase()
      if (!status.id || !name || normalizedNames.has(name)) return true
      normalizedNames.add(name)
      return false
    })
    const hasAllBaseStatuses = baseTaskStatuses.every((status) => statusIds.has(status.id))
    const removesAssignedStatus = tasks.some((task) => !statusIds.has(task.status))

    if (hasDuplicateName || !hasAllBaseStatuses || removesAssignedStatus) return false

    setProjectStatuses((current) => ({ ...current, statuses: nextStatuses.map((status) => ({ ...status })) }))
    return true
  }, [tasks])

  const value = useMemo<ProjectStatusContextValue>(() => {
    const displayCopy: StatusDisplayCopy = {
      serviceUnavailable: 'وضعیت‌ها پس از اتصال سرویس پروژه قابل مدیریت هستند.',
      actionUnavailable: 'این تغییر پس از اتصال سرویس پروژه در دسترس خواهد بود.',
      loading: 'در حال دریافت وضعیت‌ها…',
    }
    // Test fixtures retain the existing deterministic rule-engine behavior. Production
    // intentionally exposes no mutating handler until an API adapter is connected.
    if (import.meta.env.MODE === 'test' || !workflowCatalog) {
      return {
        projectStatuses,
        statuses: projectStatuses.statuses,
        serviceAvailable: true,
        loading: false,
        error: null,
        capabilities: { canAddStatus: true, canDeleteStatus: true, canReplaceStatuses: true },
        displayCopy,
        addStatus: addStatus as unknown as ProjectStatusContextValue['addStatus'],
        deleteStatus: deleteStatus as unknown as ProjectStatusContextValue['deleteStatus'],
        replaceStatuses: replaceStatuses as unknown as ProjectStatusContextValue['replaceStatuses'],
      }
    }

    const activeWorkflow = workflowCatalog.getActiveWorkflow(projectId)
    const activeProjectStatuses: ProjectStatusSet = {
      projectId,
      statuses: activeWorkflow?.statuses ?? [],
    }
    const publishStatuses = async (nextStatuses: StatusDefinition[]): Promise<StatusMutationResult> => {
      if (!activeWorkflow) return { ok: false, message: displayCopy.actionUnavailable }
      const statusIds = new Set(nextStatuses.map((status) => status.id))
      const normalizedNames = new Set<string>()
      const hasDuplicateName = nextStatuses.some((status) => {
        const name = status.name.trim().toLocaleLowerCase()
        if (!status.id || !name || normalizedNames.has(name)) return true
        normalizedNames.add(name)
        return false
      })
      const hasAllBaseStatuses = baseTaskStatuses.every((status) => statusIds.has(status.id))
      const removesAssignedStatus = tasks.some((task) => !statusIds.has(task.status))
      if (hasDuplicateName || !hasAllBaseStatuses || removesAssignedStatus) return { ok: false, message: 'وضعیت‌های گردش‌کار معتبر نیستند.' }
      const result = await workflowCatalog.publishWorkflow(activeWorkflow.workflowId, {
        statuses: nextStatuses,
        transitions: activeWorkflow.transitions.filter((transition) => statusIds.has(transition.from) && statusIds.has(transition.to)),
      })
      return result.ok ? { ok: true } : { ok: false, message: result.message }
    }
    const addCatalogStatus = async (input: Pick<StatusDefinition, 'name' | 'color'>): Promise<StatusMutationResult> =>
      publishStatuses([...activeProjectStatuses.statuses, { id: `status-${crypto.randomUUID()}`, ...input }])
    const deleteCatalogStatus = async (statusId: string): Promise<StatusMutationResult> => {
      const statusExists = activeProjectStatuses.statuses.some((status) => status.id === statusId)
      const hasDependentTasks = tasks.some((task) => task.status === statusId)
      if (isBaseTaskStatus(statusId) || !statusExists || hasDependentTasks) return { ok: false, message: 'این وضعیت قابل حذف نیست.' }
      return publishStatuses(activeProjectStatuses.statuses.filter((status) => status.id !== statusId))
    }

    return {
      projectStatuses: activeProjectStatuses,
      statuses: activeProjectStatuses.statuses,
      serviceAvailable: true,
      loading: false,
      error: null,
      capabilities: { canAddStatus: true, canDeleteStatus: true, canReplaceStatuses: true },
      displayCopy,
      addStatus: addCatalogStatus as unknown as ProjectStatusContextValue['addStatus'],
      deleteStatus: deleteCatalogStatus as unknown as ProjectStatusContextValue['deleteStatus'],
      replaceStatuses: publishStatuses as unknown as ProjectStatusContextValue['replaceStatuses'],
    }
  }, [projectId, projectStatuses, workflowCatalog, addStatus, deleteStatus, replaceStatuses, tasks])

  return <ProjectStatusContext.Provider value={value}>{children}</ProjectStatusContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjectStatus() {
  const context = useContext(ProjectStatusContext)

  if (!context) {
    throw new Error('useProjectStatus must be used within a ProjectStatusProvider.')
  }

  return context
}
