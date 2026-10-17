export interface StatusDefinition {
  id: string;
  name: string;
  color: string;
}

export interface ProjectStatusSet {
  projectId: string;
  statuses: StatusDefinition[];
}

export type StatusMutationResult =
  | { ok: true; status?: StatusDefinition }
  | { ok: false; message?: string }

export interface StatusCapabilities {
  canAddStatus: boolean
  canDeleteStatus: boolean
  canReplaceStatuses: boolean
}

export interface StatusDisplayCopy {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}
