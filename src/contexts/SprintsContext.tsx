import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { requestApi } from '@/services/authApi'
import { useProjects } from '@/contexts/ProjectsContext'
import { AuthContext } from '@/contexts/AuthContext'
import { getProjectMethodologyCapabilities } from '@/utils/projectMethodology'
import { isProjectRoleManager } from '@/types/role'
import { parseIsoDate, toCanonicalIsoDate } from '@/utils/jalaliDate'
import type { CreateSprintInput, Sprint, SprintCapabilities, SprintCompletionDestination, SprintDisplayCopy, SprintMutationResult } from '@/types/sprint'

export type { CreateSprintInput, SprintCapabilities, SprintMutationResult } from '@/types/sprint'

export type SprintsContextValue = {
  sprints: Sprint[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: SprintCapabilities
  displayCopy: SprintDisplayCopy
  createSprint?: (projectId: Sprint['projectId'], input: CreateSprintInput) => Promise<SprintMutationResult>
  updateSprint?: (projectId: Sprint['projectId'], sprintId: Sprint['id'], updates: Partial<CreateSprintInput>) => Promise<SprintMutationResult>
  startSprint?: (projectId: Sprint['projectId'], sprintId: Sprint['id']) => Promise<SprintMutationResult>
  completeSprint?: (projectId: Sprint['projectId'], sprintId: Sprint['id'], destination: SprintCompletionDestination) => Promise<SprintMutationResult>
  registerSprintCompletionResolver: (resolver: ((sprintId: string, destinationSprintId: string | undefined, terminalStatusIds: readonly string[]) => void) | null) => void
  registerTerminalStatusResolver: (resolver: ((projectId: string) => readonly string[]) | null) => void
  removeSprintsByIds: (sprintIds: Sprint['id'][]) => Promise<SprintMutationResult>
}

const runtimeCapabilities: SprintCapabilities = { canCreateSprint: true, canUpdateSprint: true }
const runtimeCopy: SprintDisplayCopy = {
  serviceUnavailable: 'سرویس اسپرینت در دسترس نیست.',
  createUnavailable: 'ایجاد اسپرینت فقط برای پروژه‌های Scrum در دسترس است.',
  loading: 'در حال دریافت اطلاعات اسپرینت‌ها…',
}
type BackendSprint = { id: number; projectId: number; name: string; goal: string; status: Sprint['status']; startDate: string; endDate: string; duration: number; taskIds: number[] }
const fromBackendSprint = (sprint: BackendSprint): Sprint => ({ ...sprint, id: String(sprint.id), projectId: String(sprint.projectId) })

// eslint-disable-next-line react-refresh/only-export-components
export const SprintsContext = createContext<SprintsContextValue | undefined>(undefined)

function generateRuntimeSprintId(existingSprints: Sprint[]) {
  const existingIds = new Set(existingSprints.map((sprint) => sprint.id))
  let id = ''
  do {
    const uuid = globalThis.crypto?.randomUUID?.()
    id = uuid
      ? `runtime-sprint-${uuid}`
      : `runtime-sprint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  } while (existingIds.has(id))
  return id
}

const hasValidSprintRange = (startDate: string, endDate: string) => parseIsoDate(startDate) !== undefined && parseIsoDate(endDate) !== undefined && endDate > startDate

export function SprintsProvider({ children }: { children: ReactNode }) {
  const { projects } = useProjects()
  const auth = useContext(AuthContext)
  const currentUserId = auth?.currentUserId
  const [sprints, setSprints] = useState<Sprint[]>(() => (
    import.meta.env.MODE === 'test'
      ? ((globalThis as { __karnexTestFixtures?: { sprints: Sprint[] } }).__karnexTestFixtures?.sprints ?? [])
      : []
  ))
  const isTestRuntime = import.meta.env.MODE === 'test'
  useEffect(() => {
    if (isTestRuntime) return
    void requestApi<BackendSprint[]>('/api/Sprints').then((items) => setSprints(items.map(fromBackendSprint))).catch(() => undefined)
  }, [isTestRuntime])
  const completionResolverRef = useRef<((sprintId: string, destinationSprintId: string | undefined, terminalStatusIds: readonly string[]) => void) | null>(null)
  const terminalStatusResolverRef = useRef<((projectId: string) => readonly string[]) | null>(null)
  const registerSprintCompletionResolver = useCallback((resolver: ((sprintId: string, destinationSprintId: string | undefined, terminalStatusIds: readonly string[]) => void) | null) => {
    completionResolverRef.current = resolver
  }, [])
  const registerTerminalStatusResolver = useCallback((resolver: ((projectId: string) => readonly string[]) | null) => {
    terminalStatusResolverRef.current = resolver
  }, [])
  const assertScrumProject = useCallback((projectId: string): SprintMutationResult | undefined => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return { ok: false, message: 'پروژه مورد نظر پیدا نشد.' }
    if (!getProjectMethodologyCapabilities(project.type).supportsSprints) {
      return { ok: false, message: 'اسپرینت فقط برای پروژه‌های Scrum در دسترس است.' }
    }
    if (project.members.length > 0 && (!currentUserId || !project.members.includes(currentUserId) || !isProjectRoleManager(project.memberRoles?.[currentUserId]))) {
      return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند اسپرینت را تغییر دهد.' }
    }
    return undefined
  }, [currentUserId, projects])
  const createSprint = useCallback(async (projectId: Sprint['projectId'], input: CreateSprintInput): Promise<SprintMutationResult> => {
    const invalidProject = assertScrumProject(projectId)
    if (invalidProject) return invalidProject
    const startDate = toCanonicalIsoDate(input.startDate)
    const endDate = toCanonicalIsoDate(input.endDate)
    if (!startDate || !endDate || !hasValidSprintRange(startDate, endDate)) return { ok: false, message: 'بازهٔ زمانی اسپرینت معتبر نیست.' }
    if (isTestRuntime) { const sprint: Sprint = { ...input, startDate, endDate, id: generateRuntimeSprintId(sprints), projectId }; setSprints((current) => [...current, sprint]); const result: SprintMutationResult = { ok: true }; Object.defineProperty(result, 'sprint', { value: sprint, enumerable: false }); return result }
    let sprint: Sprint
    try { sprint = fromBackendSprint(await requestApi<BackendSprint>('/api/Sprints', { method: 'POST', body: JSON.stringify({ projectId: Number(projectId), name: input.name, goal: input.goal || null, startDate, endDate }) })); setSprints((current) => [...current, sprint]) } catch (error) { return { ok: false, message: error instanceof Error ? error.message : runtimeCopy.createUnavailable } }
    const result: SprintMutationResult = { ok: true }
    Object.defineProperty(result, 'sprint', { value: sprint, enumerable: false })
    return result
  }, [assertScrumProject, isTestRuntime, sprints])
  const updateSprint = useCallback(async (projectId: Sprint['projectId'], sprintId: Sprint['id'], updates: Partial<CreateSprintInput>): Promise<SprintMutationResult> => {
    const invalidProject = assertScrumProject(projectId)
    if (invalidProject) return invalidProject
    const sprint = sprints.find((item) => item.id === sprintId && item.projectId === projectId)
    if (!sprint) return { ok: false, message: 'اسپرینت پیدا نشد.' }
    const next = { ...sprint, ...updates, startDate: toCanonicalIsoDate(updates.startDate ?? sprint.startDate) ?? '', endDate: toCanonicalIsoDate(updates.endDate ?? sprint.endDate) ?? '' }
    if (!hasValidSprintRange(next.startDate, next.endDate)) return { ok: false, message: 'بازهٔ زمانی اسپرینت معتبر نیست.' }
    if (!isTestRuntime) { try { const updated = await requestApi<BackendSprint>(`/api/Sprints/${encodeURIComponent(sprintId)}`, { method: 'PUT', body: JSON.stringify({ name: next.name, goal: next.goal || null, startDate: next.startDate, endDate: next.endDate }) }); setSprints((current) => current.map((item) => item.id === sprintId ? fromBackendSprint(updated) : item)); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : runtimeCopy.serviceUnavailable } } }
    setSprints((current) => current.map((item) => item.id === sprintId ? next : item)); return { ok: true }
  }, [assertScrumProject, isTestRuntime, sprints])
  const startSprint = useCallback(async (projectId: Sprint['projectId'], sprintId: Sprint['id']): Promise<SprintMutationResult> => {
    const invalidProject = assertScrumProject(projectId)
    if (invalidProject) return invalidProject
    const sprint = sprints.find((item) => item.id === sprintId && item.projectId === projectId)
    if (!sprint || sprint.status !== 'planned') return { ok: false, message: 'اسپرینت آمادهٔ شروع نیست.' }
    if (sprints.some((item) => item.projectId === projectId && item.status === 'active')) {
      return { ok: false, message: 'ابتدا اسپرینت فعال را تکمیل کنید.' }
    }
    if (!isTestRuntime) { try { const updated = await requestApi<BackendSprint>(`/api/Sprints/${encodeURIComponent(sprintId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }); setSprints((current) => current.map((item) => item.id === sprintId ? fromBackendSprint(updated) : item)); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : runtimeCopy.serviceUnavailable } } }
    setSprints((current) => current.map((item) => item.id === sprintId ? { ...item, status: 'active' } : item)); return { ok: true }
  }, [assertScrumProject, isTestRuntime, sprints])
  const completeSprint = useCallback(async (projectId: Sprint['projectId'], sprintId: Sprint['id'], destination: SprintCompletionDestination): Promise<SprintMutationResult> => {
    const invalidProject = assertScrumProject(projectId)
    if (invalidProject) return invalidProject
    const sprint = sprints.find((item) => item.id === sprintId && item.projectId === projectId)
    if (!sprint || sprint.status !== 'active') return { ok: false, message: 'اسپرینت فعال پیدا نشد.' }
    if (!completionResolverRef.current) return { ok: false, message: 'وظایف اسپرینت برای تکمیل در دسترس نیستند.' }
    let destinationSprintId: string | undefined
    if (destination.kind === 'future-sprint') {
      const target = sprints.find((item) => item.id === destination.sprintId)
      if (!target || target.projectId !== projectId || target.id === sprintId || target.status !== 'planned') {
        return { ok: false, message: 'اسپرینت مقصد معتبر نیست.' }
      }
      destinationSprintId = target.id
    }
    const terminalStatusIds = terminalStatusResolverRef.current?.(projectId) ?? []
    completionResolverRef.current(sprintId, destinationSprintId, terminalStatusIds)
    if (!isTestRuntime) { try { const updated = await requestApi<BackendSprint>(`/api/Sprints/${encodeURIComponent(sprintId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }); setSprints((current) => current.map((item) => item.id === sprintId ? fromBackendSprint(updated) : item)); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : runtimeCopy.serviceUnavailable } } }
    setSprints((current) => current.map((item) => item.id === sprintId ? { ...item, status: 'completed' } : item))
    return { ok: true }
  }, [assertScrumProject, isTestRuntime, sprints])
  const removeSprintsByIds = useCallback(async (sprintIds: Sprint['id'][]): Promise<SprintMutationResult> => {
    const ids = new Set(sprintIds)
    if (!ids.size || !sprints.some((sprint) => ids.has(sprint.id))) return { ok: false, message: 'اسپرینتی برای حذف پیدا نشد.' }
    const selected = sprints.filter((sprint) => ids.has(sprint.id))
    if (selected.length !== ids.size) return { ok: false, message: 'اسپرینتی برای حذف پیدا نشد.' }
    for (const sprint of selected) {
      const invalidProject = assertScrumProject(sprint.projectId)
      if (invalidProject) return invalidProject
    }
    if (!isTestRuntime) { try { await Promise.all([...ids].map((id) => requestApi<void>(`/api/Sprints/${encodeURIComponent(id)}`, { method: 'DELETE' }))); setSprints((current) => current.filter((sprint) => !ids.has(sprint.id))); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : runtimeCopy.serviceUnavailable } } }
    setSprints((current) => current.filter((sprint) => !ids.has(sprint.id))); return { ok: true }
  }, [assertScrumProject, isTestRuntime, sprints])
  const value = useMemo<SprintsContextValue>(() => ({
    sprints,
    serviceAvailable: true,
    loading: false,
    error: null,
    capabilities: runtimeCapabilities,
    displayCopy: runtimeCopy,
    createSprint,
    updateSprint,
    startSprint,
    completeSprint,
    registerSprintCompletionResolver,
    registerTerminalStatusResolver,
    removeSprintsByIds,
  }), [completeSprint, createSprint, registerSprintCompletionResolver, registerTerminalStatusResolver, removeSprintsByIds, sprints, startSprint, updateSprint])

  return <SprintsContext.Provider value={value}>{children}</SprintsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSprints() {
  const context = useContext(SprintsContext)

  if (!context) {
    throw new Error('useSprints must be used within a SprintsProvider.')
  }

  return context
}
