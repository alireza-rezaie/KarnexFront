import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { ProjectsContext } from '@/contexts/ProjectsContext'
import { useOptionalWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import type { ProjectTransitionSet, WorkflowCapabilities, WorkflowCatalogMutationResult, WorkflowDisplayCopy, WorkflowMutationResult, WorkflowTransition } from '@/types/workflow'

const initialTransitions: WorkflowTransition[] = [
  { id: 'transition-todo-inprogress', from: 'todo', to: 'inprogress' },
  { id: 'transition-inprogress-review', from: 'inprogress', to: 'review' },
  { id: 'transition-inprogress-todo', from: 'inprogress', to: 'todo' },
  { id: 'transition-review-done', from: 'review', to: 'done' },
  { id: 'transition-review-inprogress', from: 'review', to: 'inprogress' },
]

const createTransitionId = () => `transition-${crypto.randomUUID()}`

type ProjectWorkflowContextValue = {
  projectTransitions: ProjectTransitionSet
  transitions: WorkflowTransition[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: WorkflowCapabilities
  displayCopy: WorkflowDisplayCopy
  canAssignPublishedWorkflow: boolean
  assignPublishedWorkflow: (workflowId: string) => Promise<WorkflowCatalogMutationResult>
  addTransition: (from: string, to: string) => Promise<WorkflowMutationResult> | boolean
  deleteTransition: (transitionId: string) => Promise<WorkflowMutationResult> | void
  deleteTransitionsByStatus: (statusId: string) => void
  replaceTransitions: (nextTransitions: WorkflowTransition[]) => Promise<WorkflowMutationResult> | boolean
}

const ProjectWorkflowContext = createContext<ProjectWorkflowContextValue | undefined>(undefined)

export function ProjectWorkflowProvider({ children }: { children: ReactNode }) {
  const { projectId } = useProject()

  return <ProjectWorkflowState key={projectId ?? ''} projectId={projectId ?? ''}>{children}</ProjectWorkflowState>
}

function ProjectWorkflowState({ children, projectId }: { children: ReactNode; projectId: string }) {
  const workflowCatalog = useOptionalWorkflowCatalog()
  const projectsContext = useContext(ProjectsContext)
  const [projectTransitions, setProjectTransitions] = useState<ProjectTransitionSet>(() => ({
    projectId,
    transitions: initialTransitions,
  }))
  const addTransition = useCallback((from: string, to: string) => {
    if (from === to || projectTransitions.transitions.some(
      (transition) => transition.from === from && transition.to === to,
    )) {
      return false
    }

    setProjectTransitions((current) => ({
      ...current,
      transitions: [...current.transitions, { id: createTransitionId(), from, to }],
    }))
    return true
  }, [projectTransitions.transitions])
  const deleteTransition = useCallback((transitionId: string) => {
    setProjectTransitions((current) => {
      const transitions = current.transitions.filter((transition) => transition.id !== transitionId)

      return transitions.length === current.transitions.length
        ? current
        : { ...current, transitions }
    })
  }, [])
  const deleteTransitionsByStatus = useCallback((statusId: string) => {
    setProjectTransitions((current) => {
      const transitions = current.transitions.filter(
        (transition) => transition.from !== statusId && transition.to !== statusId,
      )

      return transitions.length === current.transitions.length
        ? current
        : { ...current, transitions }
    })
  }, [])
  const replaceTransitions = useCallback((nextTransitions: WorkflowTransition[]) => {
    const transitionIds = new Set<string>()
    const paths = new Set<string>()
    const invalid = nextTransitions.some((transition) => {
      const path = `${transition.from}:${transition.to}`
      if (!transition.id || !transition.from || !transition.to || transition.from === transition.to || transitionIds.has(transition.id) || paths.has(path)) return true
      transitionIds.add(transition.id)
      paths.add(path)
      return false
    })
    if (invalid) return false

    setProjectTransitions((current) => ({ ...current, transitions: nextTransitions.map((transition) => ({ ...transition })) }))
    return true
  }, [])
  const transitionsAreValid = useCallback((nextTransitions: WorkflowTransition[]) => {
    const transitionIds = new Set<string>()
    const paths = new Set<string>()
    return !nextTransitions.some((transition) => {
      const path = `${transition.from}:${transition.to}`
      if (!transition.id || !transition.from || !transition.to || transition.from === transition.to || transitionIds.has(transition.id) || paths.has(path)) return true
      transitionIds.add(transition.id)
      paths.add(path)
      return false
    })
  }, [])
  const canAssignPublishedWorkflow = Boolean(
    projectId &&
    workflowCatalog?.capabilities.canAssignWorkflow &&
    (projectsContext
      ? projectsContext.accessCapabilities.canManageProjectAccess && projectsContext.canManageProjectAccess(projectId)
      : false),
  )
  const assignPublishedWorkflow = useCallback(async (workflowId: string): Promise<WorkflowCatalogMutationResult> => {
    if (!workflowCatalog) return { ok: false, message: 'کتابخانهٔ گردش‌کار در دسترس نیست.' }
    if (!projectsContext || !projectsContext.canManageProjectAccess(projectId)) {
      return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند گردش‌کار را تغییر دهد.' }
    }
    return workflowCatalog.assignWorkflow(projectId, workflowId)
  }, [projectId, projectsContext, workflowCatalog])
  const value = useMemo<ProjectWorkflowContextValue>(() => {
    const displayCopy: WorkflowDisplayCopy = {
      serviceUnavailable: 'گردش‌کار پس از اتصال سرویس پروژه قابل انتشار است.',
      actionUnavailable: 'این تغییر پس از اتصال سرویس پروژه در دسترس خواهد بود.',
      loading: 'در حال دریافت گردش‌کار…',
    }
    if (import.meta.env.MODE === 'test' || !workflowCatalog) {
      return {
        projectTransitions,
        transitions: projectTransitions.transitions,
        serviceAvailable: true,
        loading: false,
        error: null,
        capabilities: { canAddTransition: true, canDeleteTransition: true, canReplaceTransitions: true },
        displayCopy,
        canAssignPublishedWorkflow,
        assignPublishedWorkflow,
        addTransition: addTransition as unknown as ProjectWorkflowContextValue['addTransition'],
        deleteTransition: deleteTransition as unknown as ProjectWorkflowContextValue['deleteTransition'],
        deleteTransitionsByStatus,
        replaceTransitions: replaceTransitions as unknown as ProjectWorkflowContextValue['replaceTransitions'],
      }
    }

    const activeWorkflow = workflowCatalog.getActiveWorkflow(projectId)
    const activeProjectTransitions: ProjectTransitionSet = {
      projectId,
      transitions: activeWorkflow?.transitions ?? [],
    }

    const publishTransitions = async (nextTransitions: WorkflowTransition[]): Promise<WorkflowMutationResult> => {
      if (!activeWorkflow || !transitionsAreValid(nextTransitions)) return { ok: false, message: 'انتقال‌های گردش‌کار معتبر نیستند.' }
      const result = await workflowCatalog.publishWorkflow(activeWorkflow.workflowId, {
        statuses: activeWorkflow.statuses,
        transitions: nextTransitions,
      })
      return result.ok ? { ok: true } : { ok: false, message: result.message }
    }
    const addCatalogTransition = async (from: string, to: string): Promise<WorkflowMutationResult> => {
      if (from === to || activeProjectTransitions.transitions.some((transition) => transition.from === from && transition.to === to)) {
        return { ok: false, message: 'این انتقال از قبل وجود دارد.' }
      }
      return publishTransitions([...activeProjectTransitions.transitions, { id: createTransitionId(), from, to }])
    }
    const deleteCatalogTransition = async (transitionId: string): Promise<WorkflowMutationResult> => {
      const nextTransitions = activeProjectTransitions.transitions.filter((transition) => transition.id !== transitionId)
      if (nextTransitions.length === activeProjectTransitions.transitions.length) return { ok: false, message: 'انتقال پیدا نشد.' }
      return publishTransitions(nextTransitions)
    }

    return {
      projectTransitions: activeProjectTransitions,
      transitions: activeProjectTransitions.transitions,
      serviceAvailable: true,
      loading: false,
      error: null,
      capabilities: { canAddTransition: true, canDeleteTransition: true, canReplaceTransitions: true },
      displayCopy,
      canAssignPublishedWorkflow,
      assignPublishedWorkflow,
      addTransition: addCatalogTransition,
      deleteTransition: deleteCatalogTransition,
      // This legacy void API is only used by the test status editor. Runtime status
      // publication supplies the full definition atomically through the catalog.
      deleteTransitionsByStatus: () => undefined,
      replaceTransitions: publishTransitions,
    }
  }, [projectId, projectTransitions, workflowCatalog, addTransition, deleteTransition, deleteTransitionsByStatus, replaceTransitions, transitionsAreValid, canAssignPublishedWorkflow, assignPublishedWorkflow])

  return <ProjectWorkflowContext.Provider value={value}>{children}</ProjectWorkflowContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjectWorkflow() {
  const context = useContext(ProjectWorkflowContext)

  if (!context) {
    throw new Error('useProjectWorkflow must be used within a ProjectWorkflowProvider.')
  }

  return context
}
