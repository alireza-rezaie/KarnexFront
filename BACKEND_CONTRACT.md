# Karnex Frontend → Backend Handoff Contract

## Status and authority

**Current certified baseline:** PHASE 29 FINAL API CONTRACT CERTIFICATION PASSED.

| Check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm test -- --run` | PASS — 77 files / 416 tests |

The current application is a frontend runtime with in-memory Context authorities. It has no backend persistence, transport implementation, or browser business-data persistence. Backend integration must replace those runtime data sources with one authoritative API/cache layer; it must not introduce a second page-local mutable copy of an entity.

This document is explanatory only. The canonical, machine-checkable integration contract is the current TypeScript surface in [`src/types/api.ts`](./src/types/api.ts) and [`src/types/*Api.ts`](./src/types). If this document conflicts with those types, the types win.

## Canonical contract modules

| Domain | Canonical contract |
| --- | --- |
| Auth, accounts, member identity | `authMemberApi.ts` |
| Projects and access | `projectAccessApi.ts` |
| Workflows, assignments, Board configuration | `workflowBoardApi.ts` |
| Tasks, transitions, approvals | `taskTransitionApprovalApi.ts` |
| Sprints and task placement | `sprintApi.ts` |
| Comments and time logs | `taskCollaborationApi.ts` |
| Calendar | `calendarApi.ts` |
| Teams | `teamApi.ts` |
| Organization | `organizationApi.ts` |
| Reports and exports | `reportApi.ts` |
| Notification preferences and feed | `notificationApi.ts` |
| Files and storage | `filesApi.ts` |
| Password, 2FA, sessions | `securityApi.ts` |
| Project roles and permissions | `roleApi.ts` |
| Plans, subscriptions, billing | `billingApi.ts` |

## Identity, membership, and authority

- `AuthAccount.id === Member.id`. An account and its profile are one stable identity, but credentials/account authority and profile data remain separate resources.
- Account creation is system-level. It does **not** create Project access.
- Project membership comes only from `project.members`.
- A member's role in a project comes only from `project.memberRoles[memberId]`; it is not inferred from a global Member role.
- PM and Scrum Master (`pm`/`sm`) authority is project-scoped. It authorizes only the relevant project operations.
- System Admin is account-level authority for system-user and plan administration. It has no implicit project, workflow, Board, Sprint, task, role, or access bypass.
- Billing authority is explicitly separate from project authority.
- Private-project visibility requires project membership. The backend must apply this rule before returning a private project or a child resource.

## Projects and access

Project creation is an atomic operation: create the project, create the creator's membership, assign the creator the `pm` project role, and establish the initial workflow assignment. The result returns the authoritative Project and initial version.

Project update, archive/delete, add-member, change-member-role, and remove-access operations are project-scoped PM/SM operations. Access mutations only add, change, or remove an existing Member's membership; they never create or delete accounts or Members.

Project mutations are optimistic-concurrency operations. Their request carries the required expected Project version and a success returns the authoritative new Project version. A stale request returns the resource-specific current Project version and applies no partial mutation.

## Workflow, Board, and terminal-status policy

### Workflow lifecycle

- Custom editable drafts are mutable and explicitly owned by `ownerProjectId`.
- Draft mutation and publication are authorized through the owning project's PM/SM membership. Cross-project draft mutation must fail safely.
- A published workflow version is immutable and may be reused by other projects.
- Cloning a reusable workflow creates a new independently owned draft for the requesting project.
- System/built-in workflows remain protected according to the contract.
- Publishing atomically validates the draft and creates the immutable published snapshot. A draft never becomes active merely by being created or edited.

### Assignment

Only a published workflow version can be assigned to a target project. The target project's PM/SM rule applies; System Admin alone has no bypass. Assignment requests require `expectedAssignmentVersion`; reads and successful writes return the authoritative assignment version. A stale assignment returns `currentAssignmentVersion` and makes no partial change.

### Board configuration and completion

- Board columns map only to status IDs in the project's active published workflow.
- A status cannot be mapped to more than one Board column. Stale or invalid mappings remain diagnosed/unmapped; they are never silently coerced.
- Board configuration mutations require `expectedBoardVersion`; reads and successful writes return `boardVersion`; stale writes return `currentBoardVersion`.
- A task is terminal/completed **only** when its status is mapped to the final effective Board column for that project and active published workflow.
- There is no completion authority based on a literal status ID or label such as `done`; no `done` fallback exists.
- Task status changes only through the transition policy. Board presentation or column order is never a status-mutation authority.

## Tasks, transitions, and approvals

`projectId` is immutable for a task. Generic Task update excludes `status`; task status is changed only by execution of an identified workflow transition.

The backend must resolve the active published workflow, verify task/project ownership and source status, evaluate conditions, validate fields, and then either execute the transition or create/resolve the required approval path. Board drop targets must still commit through this transition authority.

Transition execution is idempotent and unsafe for client-side optimistic status mutation. Its authoritative transaction includes task status, audit/history, and any approval side effects.

Approval requests and votes are project/task/transition-scoped. The backend derives the voter from the session, blocks requester self-approval where policy requires it, blocks duplicate votes, evaluates quorum/rejection atomically, and never lets approval bypass conditions or validators. Approval reads expose `approvalVersion`; approval votes require `expectedApprovalVersion`; stale writes return `currentApprovalVersion` without partial resolution.

## Sprint lifecycle and task placement

Sprint lifecycle contracts cover creation, update, start, completion, deletion, and project-scoped task placement/reassignment. These operations are Scrum-only and require the project's PM/SM authority.

Sprint reads expose `sprintVersion`; relevant Sprint mutations require `expectedSprintVersion` and return authoritative new versions. A stale Sprint write returns `currentSprintVersion` and applies nothing.

Complete Sprint is one backend-atomic command:

- Terminal tasks stay in the completed Sprint.
- Unfinished tasks must be explicitly sent either to Backlog (clear `sprintId`) or to an eligible future Sprint in the same Scrum project.
- The client does not classify tasks as completed; the backend derives terminality from the active Board/workflow terminal-status policy.
- Moving unfinished work does not change its Task status.
- A missing, completed, current, cross-project, or otherwise invalid destination rejects the whole operation with no task or Sprint partial mutation.
- Stale task-placement conflicts are discriminated: task conflicts identify `currentTaskVersion`; destination-Sprint conflicts identify the authoritative destination Sprint version.

## Shared version, conflict, and idempotency semantics

`src/types/api.ts` defines the shared `{ ok: true } | { ok: false }` result style, authorization semantics, `ApiVersionMismatch`, and `IdempotentCommand`.

- A versioned mutation sends its required expected-version precondition and returns the new authoritative version on success.
- `version_mismatch` is a rejection before durable mutation. It carries the resource-specific version to refresh, rather than a generic optional token.
- Examples include `currentAssignmentVersion`, `currentBoardVersion`, `currentApprovalVersion`, `currentSprintVersion`, `currentTaskVersion`, and the corresponding Project, Calendar Event, Team, Organization, Role, File, Folder, Share, notification, security, billing, and subscription version fields where their contracts define them.
- Multi-resource mutations use discriminated stale failures where needed, including Task versus destination Sprint and File/Folder versus destination Folder. Role/matrix operations retain the affected resource's explicit conflict metadata.
- Not every resource is versioned: read-only and immutable resources do not gain a version precondition merely for uniformity.

`IdempotentCommand` provides `idempotencyKey` only for durable, retry-sensitive commands. Repeating the same command scope and key must return the first authoritative result rather than repeating a durable effect. It applies to creation commands, transition/approval commands, workflow publish/assign, Complete Sprint, upload/share commands, and report export jobs. Reads, queries, and operations already naturally idempotent do not require it.

## Error semantics

The stable shared meanings are:

| Code | Meaning |
| --- | --- |
| `unauthorized` | No valid authenticated session. |
| `forbidden` | Authenticated actor lacks required authority. |
| `not_found` | Resource does not exist or is not visible to the actor. |
| `validation` | Request data is invalid. |
| `conflict` | A non-version business conflict. |
| `version_mismatch` | Required optimistic-concurrency version is stale; resource-specific current-version metadata is returned. |
| Domain codes | Explicit domain failures such as invalid state/reference, duplicate membership/vote, provider failure, or unavailable report. |
| `rate_limited` | A relevant auth/security endpoint is throttled; `retryAfterSeconds` is required. |

Auth/security throttling is distinct from authentication, authorization, validation, and version conflicts. `rate_limited` applies only to relevant authentication, registration, password, OTP, and 2FA/security challenge operations; it is not a blanket domain-mutation error.

## Billing and subscription

Plan management is System Admin-only. Billing/subscription/payment actions require the separate organization billing authority and provider-confirmed authoritative results; project PM/SM membership grants neither authority.

`ChangeSubscriptionRequest` is discriminated:

- `kind: 'new-subscription'` creates/activates when no subscription exists and does not include an existing-subscription version.
- `kind: 'existing-subscription'` changes an existing subscription and requires `expectedSubscriptionVersion`.

A stale existing-subscription mutation returns `currentSubscriptionVersion`. Payment and subscription commands use idempotency keys and must not report success until the provider-confirmed backend result is returned.

## Other domain integrity rules

- Task assignee, Sprint, and epic references are validated against the task's project.
- Team membership and lead references use stable Member IDs; a lead must belong to the Team.
- Calendar uses canonical ISO start/end values; Jalali conversion is presentation-only. Project and participant references are validated server-side.
- File/folder metadata, ownership, size, MIME type, timestamps, permissions, and signed download references are backend-authoritative. Binary transfer is outside ordinary JSON contracts. Folder moves must reject cycles.
- Reports use backend snapshots/events only. They distinguish zero data, no history, unavailable report, and backend failure; the frontend must not synthesize historical series. Export is an asynchronous backend job.
- Notifications are owner-scoped. Feed pagination and unread counts are backend-authoritative; read mutations are safely idempotent.

## Required backend atomic boundaries

The backend must treat the following as single authoritative operations:

1. Registration/account creation and its Account–Member identity result.
2. Project creation, creator membership, PM role, and initial workflow assignment.
3. Project access mutation and its membership/role integrity checks.
4. Workflow publication and immutable snapshot validation.
5. Workflow assignment and Board-configuration updates after their version checks.
6. Task transition, audit/history, and approval side effects.
7. Approval vote, quorum/rejection calculation, request resolution, and permitted transition result.
8. Complete Sprint and all unfinished-task reassignment.
9. Role deletion/reassignment where a role is in use.
10. Payment, subscription, and provider-confirmed billing mutations.

## Backend-only boundaries

The frontend has typed contracts but must not claim successful local completion for:

- password changes, OTP, 2FA, recovery material, and remote session/device revocation;
- file storage, binary upload/download, and signed download references;
- email, push, and in-app notification delivery;
- authoritative report history and export jobs;
- payment methods, invoices, subscriptions, and billing-provider results;
- server-side audit trails.

Server-generated IDs, author identity, timestamps, audit/history, unread counts, file metadata, provider state, session/device metadata, report history, and task-completion classification are backend-authoritative. The client must not treat them as trusted request input.

## Integration rule

Future adapters may add loading, pending, refresh, cache invalidation, error, and conflict handling around these contracts. They must preserve the current project-scoped authorization and business semantics, and must not introduce frontend mock success, a second mutable authority, or business-data persistence in `localStorage`.
