import { describe, expect, it } from 'vitest'
import type { UpdateCalendarEventResponse } from '@/types/calendarApi'
import type { UpdateTeamResponse } from '@/types/teamApi'
import type { UpdateOrganizationResponse } from '@/types/organizationApi'
import type { UpdateRolePermissionMatrixResponse } from '@/types/roleApi'
import type { MoveFileSystemItemResponse } from '@/types/filesApi'
import type { UpdateNotificationPreferencesResponse } from '@/types/notificationApi'
import type { UpdateSecurityPreferencesResponse } from '@/types/securityApi'
import type { UpdateBillingIdentityResponse } from '@/types/billingApi'
import type { UpdateTaskResponse } from '@/types/taskTransitionApprovalApi'
import type { MoveTaskPlacementResponse } from '@/types/sprintApi'
import type { UpdateTaskCommentResponse, UpdateTaskTimeLogResponse } from '@/types/taskCollaborationApi'

describe('resource-specific stale-write metadata', () => {
  it('requires the current authoritative version for each single-resource stale mutation', () => {
    const versions = [
      ({ ok: false, code: 'version_mismatch', currentEventVersion: 'event-v2' } satisfies UpdateCalendarEventResponse).currentEventVersion,
      ({ ok: false, code: 'version_mismatch', currentTeamVersion: 'team-v2' } satisfies UpdateTeamResponse).currentTeamVersion,
      ({ ok: false, code: 'version_mismatch', currentOrganizationVersion: 'org-v2' } satisfies UpdateOrganizationResponse).currentOrganizationVersion,
      ({ ok: false, code: 'version_mismatch', currentPreferencesVersion: 'notification-v2' } satisfies UpdateNotificationPreferencesResponse).currentPreferencesVersion,
      ({ ok: false, code: 'version_mismatch', currentPreferencesVersion: 'security-v2' } satisfies UpdateSecurityPreferencesResponse).currentPreferencesVersion,
      ({ ok: false, code: 'version_mismatch', currentBillingAccountVersion: 'billing-v2' } satisfies UpdateBillingIdentityResponse).currentBillingAccountVersion,
      ({ ok: false, code: 'version_mismatch', currentTaskVersion: 'task-v2' } satisfies UpdateTaskResponse).currentTaskVersion,
      ({ ok: false, code: 'version_mismatch', currentCommentVersion: 'comment-v2' } satisfies UpdateTaskCommentResponse).currentCommentVersion,
      ({ ok: false, code: 'version_mismatch', currentTimeLogVersion: 'time-log-v2' } satisfies UpdateTaskTimeLogResponse).currentTimeLogVersion,
    ]

    expect(versions).toHaveLength(9)
  })

  it('discriminates each versioned resource in multi-resource mutations', () => {
    const matrix = { ok: false, code: 'version_mismatch', currentMatrixVersion: 'matrix-v2' } satisfies UpdateRolePermissionMatrixResponse
    const destination = {
      ok: false,
      code: 'version_mismatch',
      resource: 'destination-folder',
      currentDestinationFolderVersion: 'folder-v2',
    } satisfies MoveFileSystemItemResponse
    const sprintTarget = {
      ok: false,
      code: 'version_mismatch',
      currentDestinationSprintVersion: 'sprint-v2',
    } satisfies MoveTaskPlacementResponse

    expect(matrix.currentMatrixVersion).toBe('matrix-v2')
    expect(destination.resource).toBe('destination-folder')
    expect(sprintTarget.currentDestinationSprintVersion).toBe('sprint-v2')
  })
})
