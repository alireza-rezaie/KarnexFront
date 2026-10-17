import type { StatusDefinition } from '@/types/status'

/** Presentation mapping only. Workflow status metadata remains owned by the active workflow. */
export interface BoardColumn {
  id: string
  name: string
  order: number
  statusIds: string[]
  /** Existing visual-only preferences retained for the current Board UI. */
  color?: string
  pinned?: boolean
  custom?: boolean
  /** A Kanban presentation limit only; it never changes workflow transitions. */
  wipLimit?: number
}

export interface ProjectBoardConfiguration {
  projectId: string
  columns: BoardColumn[]
  /** Default configurations are derived; custom configurations survive workflow publication. */
  isCustomized: boolean
  /** Kanban teams may keep a planning area, or flow all work directly on the board. */
  kanbanBacklogEnabled: boolean
}

export interface BoardMappingValidation {
  valid: boolean
  message?: string
}

export type BoardMappingMutationResult =
  | { ok: true; configuration: ProjectBoardConfiguration }
  | { ok: false; message: string }

export interface BoardCapabilities {
  canUpdateMapping: boolean
}

export const createDefaultBoardColumns = (statuses: StatusDefinition[]): BoardColumn[] =>
  statuses.map((status, order) => ({
    id: `board-column-${status.id}`,
    name: status.name,
    order,
    statusIds: [status.id],
  }))

export const resolveTaskBoardColumn = (columns: BoardColumn[], statusId: string): BoardColumn | undefined =>
  columns.find((column) => column.statusIds.includes(statusId))
