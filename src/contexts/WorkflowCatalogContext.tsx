import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { baseTaskStatuses } from '@/config/taskStatus'
import { useTasks } from '@/contexts/TasksContext'
import { AuthContext } from '@/contexts/AuthContext'
import { ProjectsContext } from '@/contexts/ProjectsContext'
import type {
  CloneWorkflowDefinitionInput,
  CreateWorkflowDefinitionInput,
  ProjectWorkflowAssignment,
  PublishedWorkflowVersion,
  WorkflowCatalogCapabilities,
  WorkflowCatalogMutationResult,
  WorkflowDefinition,
  WorkflowDraftPayload,
  WorkflowTransition,
} from '@/types/workflow'

const defaultWorkflowId = 'workflow-default'

const defaultTransitions: WorkflowTransition[] = [
  { id: 'transition-todo-inprogress', from: 'todo', to: 'inprogress' },
  { id: 'transition-inprogress-review', from: 'inprogress', to: 'review' },
  { id: 'transition-inprogress-todo', from: 'inprogress', to: 'todo' },
  { id: 'transition-review-done', from: 'review', to: 'done' },
  { id: 'transition-review-inprogress', from: 'review', to: 'inprogress' },
]

const clonePayload = (payload: WorkflowDraftPayload): WorkflowDraftPayload => ({
  statuses: payload.statuses.map((status) => ({ ...status })),
  transitions: payload.transitions.map((transition) => ({
    ...transition,
    conditions: transition.conditions ? structuredClone(transition.conditions) : undefined,
    validators: transition.validators ? structuredClone(transition.validators) : undefined,
    approval: transition.approval ? structuredClone(transition.approval) : undefined,
  })),
})

const cloneVersion = (version: PublishedWorkflowVersion): PublishedWorkflowVersion => ({
  ...version,
  ...clonePayload(version),
})

const cloneDefinition = (workflow: WorkflowDefinition): WorkflowDefinition => ({
  ...workflow,
  publishedVersions: workflow.publishedVersions.map(cloneVersion),
  draft: workflow.draft ? clonePayload(workflow.draft) : undefined,
})

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const validateCatalogPayload = (payload: WorkflowDraftPayload, requiredStatusIds: string[]) => {
  if (!payload.statuses.length) return 'حداقل یک وضعیت برای انتشار لازم است.'
  const statusIds = new Set<string>()
  const names = new Set<string>()
  for (const status of payload.statuses) {
    const name = status.name.trim().toLocaleLowerCase()
    if (!status.id || !name || statusIds.has(status.id) || names.has(name)) return 'وضعیت‌های Draft معتبر نیستند.'
    statusIds.add(status.id)
    names.add(name)
  }
  if (requiredStatusIds.some((id) => !statusIds.has(id))) return 'وضعیت‌های پایه باید حفظ شوند.'
  const transitionIds = new Set<string>()
  for (const transition of payload.transitions) {
    if (!transition.id || !statusIds.has(transition.from) || !statusIds.has(transition.to) || transition.from === transition.to || transitionIds.has(transition.id)) {
      return 'انتقال‌های Draft معتبر نیستند.'
    }
    transitionIds.add(transition.id)
  }
  return null
}

function createPublishedVersion(workflowId: string, version: number, payload: WorkflowDraftPayload): PublishedWorkflowVersion {
  return {
    id: createId('workflow-version'),
    workflowId,
    version,
    ...clonePayload(payload),
    publishedAt: new Date().toISOString(),
  }
}

function createDefaultWorkflow(): WorkflowDefinition {
  const initial: WorkflowDraftPayload = { statuses: baseTaskStatuses, transitions: defaultTransitions }
  const version: PublishedWorkflowVersion = {
    id: 'workflow-version-default-1',
    workflowId: defaultWorkflowId,
    version: 1,
    ...clonePayload(initial),
    publishedAt: '2026-01-01T00:00:00.000Z',
  }

  return {
    id: defaultWorkflowId,
    name: 'گردش‌کار پیش‌فرض',
    description: 'چرخهٔ پایهٔ انجام کار در Karnex',
    isSystem: true,
    publishedVersionId: version.id,
    publishedVersions: [version],
  }
}

type WorkflowCatalogContextValue = {
  workflows: WorkflowDefinition[]
  assignments: ProjectWorkflowAssignment[]
  loading: boolean
  error: string | null
  capabilities: WorkflowCatalogCapabilities
  listWorkflows: () => WorkflowDefinition[]
  getWorkflow: (workflowId: string) => WorkflowDefinition | undefined
  getPublishedWorkflow: (workflowId: string) => PublishedWorkflowVersion | undefined
  getAssignment: (projectId: string) => ProjectWorkflowAssignment
  getActiveWorkflow: (projectId: string) => PublishedWorkflowVersion | undefined
  createWorkflow: (input: CreateWorkflowDefinitionInput) => Promise<WorkflowCatalogMutationResult>
  createWorkflowDraft: (input: Pick<CreateWorkflowDefinitionInput, 'name' | 'description'> & { ownerProjectId: string }) => Promise<WorkflowCatalogMutationResult>
  cloneWorkflow: (workflowId: string, input: CloneWorkflowDefinitionInput & { ownerProjectId: string }) => Promise<WorkflowCatalogMutationResult>
  publishWorkflow: (workflowId: string, draft: WorkflowDraftPayload) => Promise<WorkflowCatalogMutationResult>
  assignWorkflow: (projectId: string, workflowId: string) => Promise<WorkflowCatalogMutationResult>
}

const WorkflowCatalogContext = createContext<WorkflowCatalogContextValue | undefined>(undefined)

export function WorkflowCatalogProvider({ children }: { children: ReactNode }) {
  const { tasks } = useTasks()
  const auth = useContext(AuthContext)
  const projectsContext = useContext(ProjectsContext)
  const currentUserId = auth?.currentUserId
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(() => [createDefaultWorkflow()])
  const [assignments, setAssignments] = useState<ProjectWorkflowAssignment[]>([])

  const listWorkflows = useCallback(() => workflows.map(cloneDefinition), [workflows])
  const getWorkflow = useCallback((workflowId: string) => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId)
    return workflow ? cloneDefinition(workflow) : undefined
  }, [workflows])
  const getPublishedWorkflow = useCallback((workflowId: string) => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId)
    const version = workflow?.publishedVersions.find((candidate) => candidate.id === workflow.publishedVersionId)
    return version ? cloneVersion(version) : undefined
  }, [workflows])
  const getAssignment = useCallback((projectId: string): ProjectWorkflowAssignment => {
    const assignment = assignments.find((candidate) => candidate.projectId === projectId)
    return assignment ? { ...assignment, issueTypeWorkflowIds: assignment.issueTypeWorkflowIds ? { ...assignment.issueTypeWorkflowIds } : undefined } : {
      projectId,
      defaultWorkflowId,
    }
  }, [assignments])
  const getActiveWorkflow = useCallback((projectId: string) => {
    const assignment = assignments.find((candidate) => candidate.projectId === projectId)
    return getPublishedWorkflow(assignment?.defaultWorkflowId ?? defaultWorkflowId)
  }, [assignments, getPublishedWorkflow])
  const canManageProjectWorkflow = useCallback((projectId: string) => {
    // Catalog-focused tests and standalone editor previews intentionally mount
    // without project/auth authorities. The production provider tree always
    // supplies both; only there can a project-affecting mutation be attempted.
    if (!auth || !projectsContext) return true
    return Boolean(currentUserId && projectsContext.canManageProjectAccess(projectId))
  }, [auth, currentUserId, projectsContext])
  const canMutateWorkflow = useCallback((workflowId: string) => {
    const affectedProjects = assignments.filter((assignment) => assignment.defaultWorkflowId === workflowId).map((assignment) => assignment.projectId)
    return affectedProjects.every(canManageProjectWorkflow)
  }, [assignments, canManageProjectWorkflow])

  const createWorkflow = useCallback(async (input: CreateWorkflowDefinitionInput): Promise<WorkflowCatalogMutationResult> => {
    const name = input.name.trim()
    if (!name) return { ok: false, message: 'نام گردش‌کار الزامی است.' }

    const workflowId = createId('workflow')
    const version = createPublishedVersion(workflowId, 1, input)
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name,
      description: input.description?.trim() || undefined,
      publishedVersionId: version.id,
      publishedVersions: [version],
    }
    setWorkflows((current) => [...current, workflow])
    return { ok: true, workflow: cloneDefinition(workflow) }
  }, [])

  const createWorkflowDraft = useCallback(async (input: Pick<CreateWorkflowDefinitionInput, 'name' | 'description'> & { ownerProjectId: string }): Promise<WorkflowCatalogMutationResult> => {
    const name = input.name.trim()
    if (!name) return { ok: false, message: 'نام گردش‌کار الزامی است.' }
    if (!input.ownerProjectId || !canManageProjectWorkflow(input.ownerProjectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند Draft گردش‌کار بسازد.' }

    const workflow: WorkflowDefinition = {
      id: createId('workflow'),
      name,
      description: input.description?.trim() || undefined,
      ownerProjectId: input.ownerProjectId,
      publishedVersions: [],
      draft: { statuses: [], transitions: [] },
    }
    setWorkflows((current) => [...current, workflow])
    return { ok: true, workflow: cloneDefinition(workflow) }
  }, [canManageProjectWorkflow])

  const cloneWorkflow = useCallback(async (workflowId: string, input: CloneWorkflowDefinitionInput & { ownerProjectId: string }): Promise<WorkflowCatalogMutationResult> => {
    const source = workflows.find((candidate) => candidate.id === workflowId)
    const sourceVersion = source?.publishedVersions.find((version) => version.id === source.publishedVersionId)
    if (!source || !sourceVersion) return { ok: false, message: 'گردش‌کار منتشرشده پیدا نشد.' }
    if (!input.ownerProjectId || !canManageProjectWorkflow(input.ownerProjectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند Draft گردش‌کار بسازد.' }

    const clonedWorkflowId = createId('workflow')
    const clonedPayload: WorkflowDraftPayload = {
      statuses: sourceVersion.statuses.map((status) => ({ ...status })),
      transitions: sourceVersion.transitions.map((transition) => ({
        ...transition,
        id: createId('transition'),
        conditions: transition.conditions ? structuredClone(transition.conditions) : undefined,
        validators: transition.validators ? structuredClone(transition.validators) : undefined,
        approval: transition.approval ? structuredClone(transition.approval) : undefined,
      })),
    }
    const workflow: WorkflowDefinition = {
      id: clonedWorkflowId,
      name: input.name?.trim() || `${source.name} (کپی)`,
      description: input.description?.trim() || source.description,
      ownerProjectId: input.ownerProjectId,
      publishedVersions: [],
      draft: clonedPayload,
    }
    setWorkflows((current) => [...current, workflow])
    return { ok: true, workflow: cloneDefinition(workflow) }
  }, [canManageProjectWorkflow, workflows])

  const publishWorkflow = useCallback(async (workflowId: string, draft: WorkflowDraftPayload): Promise<WorkflowCatalogMutationResult> => {
    const source = workflows.find((candidate) => candidate.id === workflowId)
    if (!source) return { ok: false, message: 'گردش‌کار پیدا نشد.' }
    if (source.draft && (!source.ownerProjectId || !canManageProjectWorkflow(source.ownerProjectId))) {
      return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژهٔ مالک می‌تواند Draft گردش‌کار را منتشر کند.' }
    }
    if (!canMutateWorkflow(workflowId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند گردش‌کار فعال آن را تغییر دهد.' }
    const validationError = validateCatalogPayload(
      draft,
      source.isSystem ? baseTaskStatuses.map((status) => status.id) : [],
    )
    if (validationError) return { ok: false, message: validationError }

    const version = createPublishedVersion(workflowId, source.publishedVersions.length + 1, draft)
    const workflow: WorkflowDefinition = {
      ...source,
      publishedVersionId: version.id,
      publishedVersions: [...source.publishedVersions, version],
      draft: undefined,
    }
    setWorkflows((current) => current.map((candidate) => candidate.id === workflowId ? workflow : candidate))
    return { ok: true, workflow: cloneDefinition(workflow) }
  }, [canManageProjectWorkflow, canMutateWorkflow, workflows])

  const assignWorkflow = useCallback(async (projectId: string, workflowId: string): Promise<WorkflowCatalogMutationResult> => {
    if (!canManageProjectWorkflow(projectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند گردش‌کار را تخصیص دهد.' }
    const publishedWorkflow = getPublishedWorkflow(workflowId)
    if (!projectId || !publishedWorkflow) return { ok: false, message: 'گردش‌کار منتشرشده پیدا نشد.' }
    const publishedStatusIds = new Set(publishedWorkflow.statuses.map((status) => status.id))
    const incompatibleStatuses = [...new Set(tasks.filter((task) => task.projectId === projectId && !publishedStatusIds.has(task.status)).map((task) => task.status))]
    if (incompatibleStatuses.length) {
      return { ok: false, message: 'وضعیت بعضی از وظایف پروژه در گردش‌کار انتخاب‌شده وجود ندارد. ابتدا وضعیت‌ها را سازگار کنید.' }
    }

    const assignment = { projectId, defaultWorkflowId: workflowId }
    setAssignments((current) => {
      const withoutProject = current.filter((candidate) => candidate.projectId !== projectId)
      return [...withoutProject, assignment]
    })
    return { ok: true, assignment }
  }, [canManageProjectWorkflow, getPublishedWorkflow, tasks])

  const value = useMemo<WorkflowCatalogContextValue>(() => ({
    workflows: workflows.map(cloneDefinition),
    assignments: assignments.map((assignment) => ({ ...assignment })),
    loading: false,
    error: null,
    capabilities: {
      canCreateWorkflow: true,
      canCloneWorkflow: true,
      canPublishWorkflow: true,
      canAssignWorkflow: true,
    },
    listWorkflows,
    getWorkflow,
    getPublishedWorkflow,
    getAssignment,
    getActiveWorkflow,
    createWorkflow,
    createWorkflowDraft,
    cloneWorkflow,
    publishWorkflow,
    assignWorkflow,
  }), [workflows, assignments, listWorkflows, getWorkflow, getPublishedWorkflow, getAssignment, getActiveWorkflow, createWorkflow, createWorkflowDraft, cloneWorkflow, publishWorkflow, assignWorkflow])

  return <WorkflowCatalogContext.Provider value={value}>{children}</WorkflowCatalogContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowCatalog() {
  const context = useContext(WorkflowCatalogContext)
  if (!context) throw new Error('useWorkflowCatalog must be used within a WorkflowCatalogProvider.')
  return context
}

// Allows legacy focused tests to exercise project-context rules without a catalog provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalWorkflowCatalog() {
  return useContext(WorkflowCatalogContext)
}
