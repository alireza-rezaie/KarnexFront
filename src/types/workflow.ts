import type { StatusDefinition } from '@/types/status';
import type { ApprovalPolicy, TransitionValidator, WorkflowConditionGroup } from '@/types/workflowPolicy';

export type WorkflowStatus = StatusDefinition;

export interface WorkflowNode extends WorkflowStatus {
  x: number;
  y: number;
}

export interface WorkflowTransition {
  id: string;
  /** Optional transition label; legacy transitions use a derived source → destination label. */
  name?: string;
  from: string;
  to: string;
  /** Omitted legacy rules mean the transition remains unrestricted. */
  conditions?: WorkflowConditionGroup;
  /** Omitted legacy validators mean no attempt-time task validation is required. */
  validators?: TransitionValidator[];
  /** Omitted legacy approval means no approval is required. */
  approval?: ApprovalPolicy;
}

export interface ProjectTransitionSet {
  projectId: string;
  transitions: WorkflowTransition[];
}

export type WorkflowMutationResult = { ok: true } | { ok: false; message?: string }

export interface WorkflowCapabilities {
  canAddTransition: boolean
  canDeleteTransition: boolean
  canReplaceTransitions: boolean
}

export interface WorkflowDisplayCopy {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}

/** A published, reusable workflow snapshot. Runtime consumers resolve only this shape. */
export interface PublishedWorkflowVersion {
  id: string
  workflowId: string
  version: number
  statuses: StatusDefinition[]
  transitions: WorkflowTransition[]
  publishedAt: string
}

/**
 * Catalog metadata plus its published history. Editor drafts deliberately remain
 * editor-owned state and are never stored on a project assignment.
 */
export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  /** System workflows are supplied by Karnex; all other catalog entries are custom. */
  isSystem?: boolean
  /** The project that owns this custom workflow's mutable draft. Published versions remain reusable. */
  ownerProjectId?: string
  /** Absent while a custom workflow is still an unpublished draft. */
  publishedVersionId?: string
  publishedVersions: PublishedWorkflowVersion[]
  /** The editable payload for a new custom workflow before its first publish. */
  draft?: WorkflowDraftPayload
}

/** Project assignments hold identifiers only; they never embed a workflow definition. */
export interface ProjectWorkflowAssignment {
  projectId: string
  defaultWorkflowId: string
  /** Reserved for future issue-type mapping without introducing UI in this phase. */
  issueTypeWorkflowIds?: Record<string, string>
}

export interface WorkflowDraftPayload {
  statuses: StatusDefinition[]
  transitions: WorkflowTransition[]
}

export interface CreateWorkflowDefinitionInput extends WorkflowDraftPayload {
  name: string
  description?: string
}

export interface CloneWorkflowDefinitionInput {
  name?: string
  description?: string
}

export type WorkflowCatalogMutationResult =
  | { ok: true; workflow?: WorkflowDefinition; assignment?: ProjectWorkflowAssignment }
  | { ok: false; message?: string }

export interface WorkflowCatalogCapabilities {
  canCreateWorkflow: boolean
  canCloneWorkflow: boolean
  canPublishWorkflow: boolean
  canAssignWorkflow: boolean
}
