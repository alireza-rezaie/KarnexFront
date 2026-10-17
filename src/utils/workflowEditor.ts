import type { StatusDefinition } from '@/types/status'
import type { WorkflowTransition } from '@/types/workflow'

export type WorkflowNodePositions = Record<string, { x: number; y: number }>

export type WorkflowDraft = {
  statuses: StatusDefinition[]
  transitions: WorkflowTransition[]
  nodePositions: WorkflowNodePositions
}

export type WorkflowTemplate = WorkflowDraft & {
  id: string
  name: string
}

export type WorkflowHistory = {
  undo: WorkflowDraft[]
  redo: WorkflowDraft[]
}

export const WORKFLOW_TEMPLATES_STORAGE_KEY = 'karnex-workflow-templates-v1'

let sessionWorkflowTemplates: WorkflowTemplate[] = []

const cloneStatuses = (statuses: StatusDefinition[]) => statuses.map((status) => ({ ...status }))
const cloneTransitions = (transitions: WorkflowTransition[]) => transitions.map((transition) => ({ ...transition }))
const clonePositions = (nodePositions: WorkflowNodePositions) => Object.fromEntries(
  Object.entries(nodePositions).map(([id, position]) => [id, { ...position }]),
) as WorkflowNodePositions

export function createWorkflowDraft(
  statuses: StatusDefinition[],
  transitions: WorkflowTransition[],
  nodePositions: WorkflowNodePositions,
): WorkflowDraft {
  return { statuses: cloneStatuses(statuses), transitions: cloneTransitions(transitions), nodePositions: clonePositions(nodePositions) }
}

export function cloneWorkflowDraft(draft: WorkflowDraft): WorkflowDraft {
  return createWorkflowDraft(draft.statuses, draft.transitions, draft.nodePositions)
}

export function workflowDraftEquals(left: WorkflowDraft, right: WorkflowDraft) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateWorkflowDraft(draft: WorkflowDraft, requiredStatusIds: string[]) {
  if (!draft.statuses.length) return 'حداقل یک وضعیت برای انتشار لازم است.'
  const statusIds = new Set<string>()
  const names = new Set<string>()
  for (const status of draft.statuses) {
    const name = status.name.trim().toLocaleLowerCase()
    if (!status.id || !name || statusIds.has(status.id) || names.has(name)) return 'وضعیت‌های Draft معتبر نیستند.'
    statusIds.add(status.id)
    names.add(name)
  }
  if (requiredStatusIds.some((id) => !statusIds.has(id))) return 'وضعیت‌های پایه باید حفظ شوند.'

  const transitionIds = new Set<string>()
  const paths = new Set<string>()
  for (const transition of draft.transitions) {
    const path = `${transition.from}:${transition.to}`
    if (!transition.id || !statusIds.has(transition.from) || !statusIds.has(transition.to) || transition.from === transition.to || transitionIds.has(transition.id) || paths.has(path)) {
      return 'انتقال‌های Draft معتبر نیستند.'
    }
    transitionIds.add(transition.id)
    paths.add(path)
  }
  return null
}

export function pushWorkflowHistory(history: WorkflowHistory, currentDraft: WorkflowDraft): WorkflowHistory {
  return { undo: [...history.undo, cloneWorkflowDraft(currentDraft)], redo: [] }
}

export function undoWorkflowHistory(history: WorkflowHistory, currentDraft: WorkflowDraft) {
  const previous = history.undo.at(-1)
  if (!previous) return { history, draft: null }
  return {
    draft: cloneWorkflowDraft(previous),
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, cloneWorkflowDraft(currentDraft)],
    },
  }
}

export function redoWorkflowHistory(history: WorkflowHistory, currentDraft: WorkflowDraft) {
  const next = history.redo.at(-1)
  if (!next) return { history, draft: null }
  return {
    draft: cloneWorkflowDraft(next),
    history: {
      undo: [...history.undo, cloneWorkflowDraft(currentDraft)],
      redo: history.redo.slice(0, -1),
    },
  }
}

function isWorkflowTemplate(value: unknown): value is WorkflowTemplate {
  if (!value || typeof value !== 'object') return false
  const template = value as Partial<WorkflowTemplate>
  return typeof template.id === 'string'
    && typeof template.name === 'string'
    && Array.isArray(template.statuses)
    && Array.isArray(template.transitions)
    && !!template.nodePositions
}

export function loadWorkflowTemplates(storage?: Pick<Storage, 'getItem'>) {
  if (!storage) return sessionWorkflowTemplates.map((template) => ({
    ...template,
    ...cloneWorkflowDraft(template),
  }))
  try {
    const raw = storage.getItem(WORKFLOW_TEMPLATES_STORAGE_KEY)
    if (!raw) return []
    const templates: unknown = JSON.parse(raw)
    return Array.isArray(templates) ? templates.filter(isWorkflowTemplate).map((template) => ({
      ...template,
      ...cloneWorkflowDraft(template),
    })) : []
  } catch {
    return []
  }
}

export function saveWorkflowTemplate(
  templates: WorkflowTemplate[],
  name: string,
  draft: WorkflowDraft,
  createId: () => string,
  storage?: Pick<Storage, 'setItem'>,
) {
  const normalizedName = name.trim()
  if (!normalizedName) return { template: null, error: 'نام الگو الزامی است.' }
  if (templates.some((template) => template.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
    return { template: null, error: 'الگویی با این نام وجود دارد.' }
  }
  const template: WorkflowTemplate = { id: createId(), name: normalizedName, ...cloneWorkflowDraft(draft) }
  const next = [...templates, template]
  if (!storage) {
    sessionWorkflowTemplates = next.map((item) => ({ ...item, ...cloneWorkflowDraft(item) }))
    return { template, error: null }
  }
  try {
    storage.setItem(WORKFLOW_TEMPLATES_STORAGE_KEY, JSON.stringify(next))
    return { template, error: null }
  } catch {
    return { template: null, error: 'ذخیره‌سازی الگو در مرورگر در دسترس نیست.' }
  }
}
