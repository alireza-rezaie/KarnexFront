import { describe, expect, it } from 'vitest'
import type {
  FilesApiFailure,
  MoveFileSystemItemRequest,
  RequestFileUploadInput,
} from '@/types/filesApi'

describe('files and storage API contract', () => {
  it('requests an upload session from metadata rather than placing binary data in JSON', () => {
    const request: RequestFileUploadInput = {
      idempotencyKey: 'upload-request-1',
      organizationId: 'organization-a', projectId: 'project-a', folderId: null, name: 'brief.pdf',
      metadata: { mimeType: 'application/pdf', sizeBytes: 1024, extension: 'pdf' },
    }

    expect(request.metadata.sizeBytes).toBe(1024)
  })

  it('makes folder moves conflict-ready', () => {
    const move: MoveFileSystemItemRequest = {
      itemId: 'folder-a', itemType: 'folder', expectedVersion: 'folder-version-2', destinationFolderId: 'folder-b', expectedDestinationVersion: 'folder-version-1',
    }

    expect(move.destinationFolderId).toBe('folder-b')
  })

  it('uses typed failures for storage topology and provider issues', () => {
    const cycle: FilesApiFailure = { ok: false, code: 'folder_cycle' }
    const quota: FilesApiFailure = { ok: false, code: 'quota_exceeded' }
    const provider: FilesApiFailure = { ok: false, code: 'storage_unavailable' }

    expect([cycle.code, quota.code, provider.code]).toEqual(['folder_cycle', 'quota_exceeded', 'storage_unavailable'])
  })
})
