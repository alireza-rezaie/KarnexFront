import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ProjectsContext } from '@/contexts/ProjectsContext'
import { createDefaultBoardColumns, type BoardCapabilities, type BoardColumn, type BoardMappingMutationResult, type BoardMappingValidation, type ProjectBoardConfiguration } from '@/types/board'
import type { StatusDefinition } from '@/types/status'

const cloneColumn = (column: BoardColumn): BoardColumn => ({ ...column, statusIds: [...column.statusIds] })
const cloneConfiguration = (configuration: ProjectBoardConfiguration): ProjectBoardConfiguration => ({
  ...configuration,
  columns: configuration.columns.map(cloneColumn),
})

// eslint-disable-next-line react-refresh/only-export-components
export function validateBoardMapping(columns: BoardColumn[], statuses: StatusDefinition[]): BoardMappingValidation {
  const validStatusIds = new Set(statuses.map((status) => status.id))
  const mappedStatusIds = new Set<string>()
  for (const column of columns) {
    if (!column.id || !column.name.trim() || column.order < 0) return { valid: false, message: 'ستون برد معتبر نیست.' }
    if (column.wipLimit !== undefined && (!Number.isSafeInteger(column.wipLimit) || column.wipLimit < 1)) return { valid: false, message: 'سقف WIP باید یک عدد صحیح مثبت باشد.' }
    for (const statusId of column.statusIds) {
      if (!validStatusIds.has(statusId)) return { valid: false, message: 'وضعیت انتخاب‌شده در گردش‌کار فعال وجود ندارد.' }
      if (mappedStatusIds.has(statusId)) return { valid: false, message: 'هر وضعیت فقط می‌تواند در یک ستون برد قرار بگیرد.' }
      mappedStatusIds.add(statusId)
    }
  }
  return { valid: true }
}

type ProjectBoardContextValue = {
  configurations: ProjectBoardConfiguration[]
  loading: boolean
  error: string | null
  capabilities: BoardCapabilities
  canManageBoardMapping: (projectId: string) => boolean
  getBoardConfiguration: (projectId: string, statuses: StatusDefinition[]) => ProjectBoardConfiguration
  resolveColumns: (projectId: string, statuses: StatusDefinition[]) => BoardColumn[]
  updateBoardConfiguration: (projectId: string, columns: BoardColumn[], statuses: StatusDefinition[]) => Promise<BoardMappingMutationResult>
  setKanbanBacklogEnabled: (projectId: string, enabled: boolean, statuses: StatusDefinition[]) => Promise<ProjectBoardConfiguration>
}

const ProjectBoardContext = createContext<ProjectBoardContextValue | undefined>(undefined)

export function ProjectBoardProvider({ children }: { children: ReactNode }) {
  const projectsContext = useContext(ProjectsContext)
  const [configurations, setConfigurations] = useState<ProjectBoardConfiguration[]>([])
  const canManageBoardMapping = useCallback((projectId: string) => (
    !projectsContext || Boolean(
      projectsContext.accessCapabilities.canManageProjectAccess
      && projectsContext.canManageProjectAccess(projectId),
    )
  ), [projectsContext])
  const getBoardConfiguration = useCallback((projectId: string, statuses: StatusDefinition[]) => {
    const configuration = configurations.find((candidate) => candidate.projectId === projectId)
    if (configuration) return cloneConfiguration(configuration)
    return { projectId, columns: createDefaultBoardColumns(statuses), isCustomized: false, kanbanBacklogEnabled: true }
  }, [configurations])
  const resolveColumns = useCallback((projectId: string, statuses: StatusDefinition[]) => {
    const configuration = configurations.find((candidate) => candidate.projectId === projectId)
    if (!configuration) return createDefaultBoardColumns(statuses)
    const validStatusIds = new Set(statuses.map((status) => status.id))
    return configuration.columns.map((column) => {
      // Removed workflow statuses are intentionally unmapped, never remapped.
      const statusIds = column.statusIds.filter((statusId) => validStatusIds.has(statusId))
      const mappedStatus = !column.custom && statusIds.length === 1
        ? statuses.find((status) => status.id === statusIds[0])
        : undefined
      return {
        ...cloneColumn(column),
        statusIds,
        // A one-status column is a workflow presentation, not copied status metadata.
        name: mappedStatus?.name ?? column.name,
        color: mappedStatus?.color ?? column.color,
      }
    })
  }, [configurations])
  const updateBoardConfiguration = useCallback(async (projectId: string, columns: BoardColumn[], statuses: StatusDefinition[]): Promise<BoardMappingMutationResult> => {
    if (!canManageBoardMapping(projectId)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند نگاشت ستون‌های برد را تغییر دهد.' }
    const validation = validateBoardMapping(columns, statuses)
    if (!validation.valid) return { ok: false, message: validation.message ?? 'تنظیمات برد معتبر نیست.' }
    const anticipated = configurations.find((candidate) => candidate.projectId === projectId)
    const responseConfiguration: ProjectBoardConfiguration = {
      projectId,
      columns: columns.map(cloneColumn),
      isCustomized: true,
      kanbanBacklogEnabled: anticipated?.kanbanBacklogEnabled ?? true,
    }
    setConfigurations((current) => {
      const existing = current.find((candidate) => candidate.projectId === projectId)
      const configuration: ProjectBoardConfiguration = {
        projectId,
        columns: columns.map(cloneColumn),
        isCustomized: true,
        kanbanBacklogEnabled: existing?.kanbanBacklogEnabled ?? true,
      }
      return [...current.filter((candidate) => candidate.projectId !== projectId), configuration]
    })
    return { ok: true, configuration: cloneConfiguration(responseConfiguration) }
  }, [canManageBoardMapping, configurations])
  const setKanbanBacklogEnabled = useCallback(async (projectId: string, enabled: boolean, statuses: StatusDefinition[]) => {
    if (!canManageBoardMapping(projectId)) return getBoardConfiguration(projectId, statuses)
    const anticipated = configurations.find((candidate) => candidate.projectId === projectId)
    const responseConfiguration: ProjectBoardConfiguration = {
      projectId,
      columns: (anticipated?.columns ?? createDefaultBoardColumns(statuses)).map(cloneColumn),
      isCustomized: anticipated?.isCustomized ?? false,
      kanbanBacklogEnabled: enabled,
    }
    setConfigurations((current) => {
      const existing = current.find((candidate) => candidate.projectId === projectId)
      const configuration: ProjectBoardConfiguration = {
        projectId,
        columns: (existing?.columns ?? createDefaultBoardColumns(statuses)).map(cloneColumn),
        isCustomized: existing?.isCustomized ?? false,
        kanbanBacklogEnabled: enabled,
      }
      return [...current.filter((candidate) => candidate.projectId !== projectId), configuration]
    })
    return cloneConfiguration(responseConfiguration)
  }, [canManageBoardMapping, configurations, getBoardConfiguration])
  const value = useMemo<ProjectBoardContextValue>(() => ({
    configurations: configurations.map(cloneConfiguration),
    loading: false,
    error: null,
    capabilities: { canUpdateMapping: true },
    canManageBoardMapping,
    getBoardConfiguration,
    resolveColumns,
    updateBoardConfiguration,
    setKanbanBacklogEnabled,
  }), [canManageBoardMapping, configurations, getBoardConfiguration, resolveColumns, setKanbanBacklogEnabled, updateBoardConfiguration])

  return <ProjectBoardContext.Provider value={value}>{children}</ProjectBoardContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjectBoard() {
  const context = useContext(ProjectBoardContext)
  if (!context) throw new Error('useProjectBoard must be used within a ProjectBoardProvider.')
  return context
}
