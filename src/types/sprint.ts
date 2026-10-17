export interface Sprint {
  id: string;
  name: string;
  goal: string;
  status: 'active' | 'planned' | 'completed';
  projectId: string;
  startDate: string;
  endDate: string;
  duration: number;
}

export type CreateSprintInput = Omit<Sprint, 'id' | 'projectId'>;

export type SprintCompletionDestination =
  | { kind: 'backlog' }
  | { kind: 'future-sprint'; sprintId: string };

export type SprintMutationResult =
  | { ok: true; sprint?: Sprint }
  | { ok: false; message?: string };

export interface SprintCapabilities {
  canCreateSprint: boolean;
  canUpdateSprint: boolean;
}

export interface SprintDisplayCopy {
  serviceUnavailable: string;
  createUnavailable: string;
  loading: string;
}
