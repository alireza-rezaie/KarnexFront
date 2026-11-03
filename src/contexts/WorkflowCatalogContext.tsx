import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { baseTaskStatuses } from '@/config/taskStatus'
import { useTasks } from '@/contexts/TasksContext'
import { AuthContext } from '@/contexts/AuthContext'
import { ProjectsContext } from '@/contexts/ProjectsContext'
import { requestApi } from '@/services/authApi'
import type {
  CloneWorkflowDefinitionInput, CreateWorkflowDefinitionInput, ProjectWorkflowAssignment,
  PublishedWorkflowVersion, WorkflowCatalogCapabilities, WorkflowCatalogMutationResult,
  WorkflowDefinition, WorkflowDraftPayload, WorkflowTransition,
} from '@/types/workflow'

const defaultWorkflowId = 'workflow-default'
const defaultTransitions: WorkflowTransition[] = [
  { id: 'transition-todo-inprogress', from: 'todo', to: 'inprogress' },
  { id: 'transition-inprogress-review', from: 'inprogress', to: 'review' },
  { id: 'transition-inprogress-todo', from: 'inprogress', to: 'todo' },
  { id: 'transition-review-done', from: 'review', to: 'done' },
  { id: 'transition-review-inprogress', from: 'review', to: 'inprogress' },
]
type StoredWorkflow = WorkflowDefinition & { recordId?: number }
type ApiPayload = { statuses: WorkflowDraftPayload['statuses']; transitions: WorkflowTransition[] }
type ApiWorkflow = {
  id: string; recordId: number; name: string; description?: string; ownerProjectId?: string | null;
  isSystem?: boolean; isDraft?: boolean; version: number; publishedVersionId?: string | null;
  payload: ApiPayload; publishedVersions?: Array<{ id: string; workflowId: string; version: number; publishedAt: string; payload: ApiPayload }>
}
type BoardResponse = { projectId: number; workflowId?: string | null }
const clonePayload = (p: WorkflowDraftPayload): WorkflowDraftPayload => ({
  statuses: p.statuses.map(s => ({ ...s })),
  transitions: p.transitions.map(t => ({ ...t, conditions: t.conditions ? structuredClone(t.conditions) : undefined, validators: t.validators ? structuredClone(t.validators) : undefined, approval: t.approval ? structuredClone(t.approval) : undefined })),
})
const cloneVersion = (v: PublishedWorkflowVersion): PublishedWorkflowVersion => ({ ...v, ...clonePayload(v) })
const cloneDefinition = (w: WorkflowDefinition): WorkflowDefinition => ({ ...w, publishedVersions: w.publishedVersions.map(cloneVersion), draft: w.draft ? clonePayload(w.draft) : undefined })
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const validateCatalogPayload = (payload: WorkflowDraftPayload, required: string[]) => {
  if (!payload.statuses.length) return 'حداقل یک وضعیت برای انتشار لازم است.'
  const ids = new Set<string>(), names = new Set<string>()
  for (const status of payload.statuses) {
    const name = status.name.trim().toLocaleLowerCase()
    if (!status.id || !name || ids.has(status.id) || names.has(name)) return 'وضعیت‌های Draft معتبر نیستند.'
    ids.add(status.id); names.add(name)
  }
  if (required.some(id => !ids.has(id))) return 'وضعیت‌های پایه باید حفظ شوند.'
  const transitions = new Set<string>()
  for (const t of payload.transitions) {
    if (!t.id || !ids.has(t.from) || !ids.has(t.to) || t.from === t.to || transitions.has(t.id)) return 'انتقال‌های Draft معتبر نیستند.'
    transitions.add(t.id)
  }
  return null
}
function localDefault(): WorkflowDefinition {
  const payload = { statuses: baseTaskStatuses, transitions: defaultTransitions }
  const version: PublishedWorkflowVersion = { id: 'workflow-version-default-1', workflowId: defaultWorkflowId, version: 1, ...clonePayload(payload), publishedAt: '2026-01-01T00:00:00.000Z' }
  return { id: defaultWorkflowId, name: 'گردش‌کار پیش‌فرض', description: 'چرخهٔ پایهٔ انجام کار در Karnex', isSystem: true, publishedVersionId: version.id, publishedVersions: [version] }
}
function fromApi(dto: ApiWorkflow): StoredWorkflow {
  const versions = (dto.publishedVersions ?? []).map(v => ({ id: v.id, workflowId: dto.id, version: v.version, publishedAt: v.publishedAt, ...clonePayload(v.payload) }))
  const current = versions.find(v => v.id === dto.publishedVersionId) ?? (dto.version > 0 ? {
    id: dto.publishedVersionId ?? `${dto.id}-version-${dto.version}`, workflowId: dto.id, version: dto.version,
    publishedAt: new Date().toISOString(), ...clonePayload(dto.payload),
  } : undefined)
  if (current && !versions.some(v => v.id === current.id)) versions.push(current)
  return {
    id: dto.id, recordId: dto.recordId, name: dto.name, description: dto.description,
    ownerProjectId: dto.ownerProjectId ?? undefined, isSystem: dto.isSystem,
    publishedVersionId: current?.id, publishedVersions: versions,
    draft: dto.isDraft ? clonePayload(dto.payload) : undefined,
  }
}
const numericId = (value: string) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

type WorkflowCatalogContextValue = {
  workflows: WorkflowDefinition[]; assignments: ProjectWorkflowAssignment[]; loading: boolean; error: string | null;
  capabilities: WorkflowCatalogCapabilities; listWorkflows: () => WorkflowDefinition[];
  getWorkflow: (id: string) => WorkflowDefinition | undefined; getPublishedWorkflow: (id: string) => PublishedWorkflowVersion | undefined;
  getAssignment: (projectId: string) => ProjectWorkflowAssignment; getActiveWorkflow: (projectId: string) => PublishedWorkflowVersion | undefined;
  createWorkflow: (input: CreateWorkflowDefinitionInput) => Promise<WorkflowCatalogMutationResult>;
  createWorkflowDraft: (input: Pick<CreateWorkflowDefinitionInput, 'name' | 'description'> & { ownerProjectId: string }) => Promise<WorkflowCatalogMutationResult>;
  cloneWorkflow: (id: string, input: CloneWorkflowDefinitionInput & { ownerProjectId: string }) => Promise<WorkflowCatalogMutationResult>;
  publishWorkflow: (id: string, draft: WorkflowDraftPayload) => Promise<WorkflowCatalogMutationResult>;
  assignWorkflow: (projectId: string, workflowId: string) => Promise<WorkflowCatalogMutationResult>;
}
const WorkflowCatalogContext = createContext<WorkflowCatalogContextValue | undefined>(undefined)

export function WorkflowCatalogProvider({ children }: { children: ReactNode }) {
  const { tasks } = useTasks()
  const auth = useContext(AuthContext)
  const projectsContext = useContext(ProjectsContext)
  const currentUserId = auth?.currentUserId
  const apiEnabled = Boolean(auth && projectsContext)
  const [workflows, setWorkflows] = useState<StoredWorkflow[]>(() => [localDefault() as StoredWorkflow])
  const [assignments, setAssignments] = useState<ProjectWorkflowAssignment[]>([])
  const [loading, setLoading] = useState(apiEnabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!apiEnabled || !projectsContext) return
    setLoading(true); setError(null)
    try {
      const response = await requestApi<ApiWorkflow[]>('/api/workflows')
      const mapped = response.map(fromApi)
      if (!mapped.some(w => w.id === defaultWorkflowId)) mapped.unshift(localDefault() as StoredWorkflow)
      setWorkflows(mapped)
      const boards = await Promise.all(projectsContext.projects.map(async project => {
        const id = numericId(project.id)
        if (!id) return null
        try { return await requestApi<BoardResponse>(`/api/workflows/projects/${id}/board`) } catch { return null }
      }))
      const next = boards.filter((b): b is BoardResponse => Boolean(b?.workflowId)).map(board => {
        const match = mapped.find(w => w.id === board.workflowId || (w as StoredWorkflow).recordId === Number(board.workflowId?.replace('workflow-', '')))
        return match ? { projectId: String(board.projectId), defaultWorkflowId: match.id } : null
      }).filter((a): a is ProjectWorkflowAssignment => Boolean(a))
      setAssignments(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت گردش‌کارها از سرور انجام نشد.')
    } finally { setLoading(false) }
  }, [apiEnabled, projectsContext])
  useEffect(() => { void refresh() }, [refresh])

  const listWorkflows = useCallback(() => workflows.map(cloneDefinition), [workflows])
  const getWorkflow = useCallback((id: string) => { const w = workflows.find(x => x.id === id); return w ? cloneDefinition(w) : undefined }, [workflows])
  const getPublishedWorkflow = useCallback((id: string) => {
    const w = workflows.find(x => x.id === id)
    const v = w?.publishedVersions.find(x => x.id === w.publishedVersionId)
    return v ? cloneVersion(v) : undefined
  }, [workflows])
  const getAssignment = useCallback((projectId: string): ProjectWorkflowAssignment => assignments.find(x => x.projectId === projectId) ?? { projectId, defaultWorkflowId }, [assignments])
  const getActiveWorkflow = useCallback((projectId: string) => getPublishedWorkflow(getAssignment(projectId).defaultWorkflowId), [getAssignment, getPublishedWorkflow])
  const canManageProjectWorkflow = useCallback((projectId: string) => {
    if (!auth || !projectsContext) return true
    return Boolean(currentUserId && projectsContext.canManageProjectAccess(projectId))
  }, [auth, currentUserId, projectsContext])
  const recordIdFor = useCallback((id: string) => workflows.find(w => w.id === id)?.recordId ?? null, [workflows])

  const createWorkflowDraft = useCallback(async (input: Pick<CreateWorkflowDefinitionInput, 'name' | 'description'> & { ownerProjectId: string }): Promise<WorkflowCatalogMutationResult> => {
    const name = input.name.trim(), ownerProjectId = numericId(input.ownerProjectId)
    if (!name) return { ok: false, message: 'نام گردش‌کار الزامی است.' }
    if (!ownerProjectId || !canManageProjectWorkflow(input.ownerProjectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند Draft گردش‌کار بسازد.' }
    try {
      if (apiEnabled) {
        const dto = await requestApi<ApiWorkflow>('/api/workflows/drafts', { method: 'POST', body: JSON.stringify({ name, description: input.description, ownerProjectId, payload: { statuses: [], transitions: [] } }) })
        const workflow = fromApi(dto); setWorkflows(current => [...current.filter(w => w.id !== workflow.id), workflow])
        return { ok: true, workflow: cloneDefinition(workflow) }
      }
      const workflow: StoredWorkflow = { id: createId('workflow'), name, description: input.description?.trim() || undefined, ownerProjectId: input.ownerProjectId, publishedVersions: [], draft: { statuses: [], transitions: [] } }
      setWorkflows(current => [...current, workflow]); return { ok: true, workflow: cloneDefinition(workflow) }
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'ساخت Draft ناموفق بود.' } }
  }, [apiEnabled, canManageProjectWorkflow])

  const createWorkflow = useCallback(async (input: CreateWorkflowDefinitionInput): Promise<WorkflowCatalogMutationResult> => {
    const owner = projectsContext?.projects.find(p => canManageProjectWorkflow(p.id))
    if (!owner) return { ok: false, message: 'برای ساخت گردش‌کار، پروژهٔ مالک در دسترس نیست.' }
    const draft = await createWorkflowDraft({ name: input.name, description: input.description, ownerProjectId: owner.id })
    if (!draft.ok || !draft.workflow) return draft
    return publishWorkflow(draft.workflow.id, input)
  }, [canManageProjectWorkflow, createWorkflowDraft, projectsContext])

  const cloneWorkflow = useCallback(async (workflowId: string, input: CloneWorkflowDefinitionInput & { ownerProjectId: string }): Promise<WorkflowCatalogMutationResult> => {
    const source = workflows.find(w => w.id === workflowId), recordId = recordIdFor(workflowId), ownerProjectId = numericId(input.ownerProjectId)
    if (!source || !getPublishedWorkflow(workflowId)) return { ok: false, message: 'گردش‌کار منتشرشده پیدا نشد.' }
    if (!ownerProjectId || !canManageProjectWorkflow(input.ownerProjectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند Draft گردش‌کار بسازد.' }
    try {
      if (apiEnabled && recordId) {
        const dto = await requestApi<ApiWorkflow>(`/api/workflows/${recordId}/clone`, { method: 'POST', body: JSON.stringify({ name: input.name, description: input.description, ownerProjectId }) })
        const workflow = fromApi(dto); setWorkflows(current => [...current, workflow]); return { ok: true, workflow: cloneDefinition(workflow) }
      }
      const payload = getPublishedWorkflow(workflowId)!
      const workflow: StoredWorkflow = { id: createId('workflow'), name: input.name?.trim() || `${source.name} (کپی)`, description: input.description?.trim() || source.description, ownerProjectId: input.ownerProjectId, publishedVersions: [], draft: { statuses: payload.statuses.map(s => ({ ...s })), transitions: payload.transitions.map(t => ({ ...t, id: createId('transition') })) } }
      setWorkflows(current => [...current, workflow]); return { ok: true, workflow: cloneDefinition(workflow) }
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'کپی گردش‌کار ناموفق بود.' } }
  }, [apiEnabled, canManageProjectWorkflow, getPublishedWorkflow, recordIdFor, workflows])

  const publishWorkflow = useCallback(async (workflowId: string, draft: WorkflowDraftPayload): Promise<WorkflowCatalogMutationResult> => {
    const source = workflows.find(w => w.id === workflowId), recordId = recordIdFor(workflowId)
    if (!source) return { ok: false, message: 'گردش‌کار پیدا نشد.' }
    if (source.isSystem || !source.ownerProjectId || !canManageProjectWorkflow(source.ownerProjectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژهٔ مالک می‌تواند Draft گردش‌کار را منتشر کند.' }
    const validation = validateCatalogPayload(draft, source.isSystem ? baseTaskStatuses.map(s => s.id) : [])
    if (validation) return { ok: false, message: validation }
    try {
      if (apiEnabled && recordId) {
        const dto = await requestApi<ApiWorkflow>(`/api/workflows/${recordId}/publish`, { method: 'POST', body: JSON.stringify(draft) })
        const workflow = fromApi(dto); setWorkflows(current => current.map(w => w.id === workflowId ? workflow : w))
        return { ok: true, workflow: cloneDefinition(workflow) }
      }
      const version: PublishedWorkflowVersion = { id: createId('workflow-version'), workflowId, version: source.publishedVersions.length + 1, ...clonePayload(draft), publishedAt: new Date().toISOString() }
      const workflow: StoredWorkflow = { ...source, publishedVersionId: version.id, publishedVersions: [...source.publishedVersions, version], draft: undefined }
      setWorkflows(current => current.map(w => w.id === workflowId ? workflow : w)); return { ok: true, workflow: cloneDefinition(workflow) }
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'انتشار گردش‌کار ناموفق بود.' } }
  }, [apiEnabled, canManageProjectWorkflow, recordIdFor, workflows])

  const assignWorkflow = useCallback(async (projectId: string, workflowId: string): Promise<WorkflowCatalogMutationResult> => {
    if (!canManageProjectWorkflow(projectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند گردش‌کار را تخصیص دهد.' }
    const workflow = getPublishedWorkflow(workflowId), projectNumericId = numericId(projectId), workflowRecordId = recordIdFor(workflowId)
    if (!workflow || !projectNumericId) return { ok: false, message: 'گردش‌کار منتشرشده یا شناسهٔ پروژه پیدا نشد.' }
    const statusIds = new Set(workflow.statuses.map(s => s.id))
    const incompatible = [...new Set(tasks.filter(t => t.projectId === projectId && !statusIds.has(t.status)).map(t => t.status))]
    if (incompatible.length) return { ok: false, message: 'وضعیت بعضی از وظایف پروژه در گردش‌کار انتخاب‌شده وجود ندارد. ابتدا وضعیت‌ها را سازگار کنید.' }
    try {
      if (apiEnabled) {
        if (!workflowRecordId) return { ok: false, message: 'شناسهٔ گردش‌کار در سرور موجود نیست.' }
        await requestApi(`/api/workflows/projects/${projectNumericId}/assignment`, { method: 'PUT', body: JSON.stringify({ workflowId: workflowRecordId }) })
      }
      const assignment = { projectId, defaultWorkflowId: workflowId }
      setAssignments(current => [...current.filter(a => a.projectId !== projectId), assignment])
      return { ok: true, assignment }
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'تخصیص گردش‌کار ناموفق بود.' } }
  }, [apiEnabled, canManageProjectWorkflow, getPublishedWorkflow, recordIdFor, tasks])

  const value = useMemo<WorkflowCatalogContextValue>(() => ({
    workflows: workflows.map(cloneDefinition), assignments: assignments.map(a => ({ ...a })),
    loading, error,
    capabilities: { canCreateWorkflow: true, canCloneWorkflow: true, canPublishWorkflow: true, canAssignWorkflow: true },
    listWorkflows, getWorkflow, getPublishedWorkflow, getAssignment, getActiveWorkflow,
    createWorkflow, createWorkflowDraft, cloneWorkflow, publishWorkflow, assignWorkflow,
  }), [workflows, assignments, loading, error, listWorkflows, getWorkflow, getPublishedWorkflow, getAssignment, getActiveWorkflow, createWorkflow, createWorkflowDraft, cloneWorkflow, publishWorkflow, assignWorkflow])
  return <WorkflowCatalogContext.Provider value={value}>{children}</WorkflowCatalogContext.Provider>
}

export function useWorkflowCatalog() {
  const context = useContext(WorkflowCatalogContext)
  if (!context) throw new Error('useWorkflowCatalog must be used within a WorkflowCatalogProvider.')
  return context
}
export function useOptionalWorkflowCatalog() { return useContext(WorkflowCatalogContext) }
