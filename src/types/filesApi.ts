import type {
  FileItem,
  FileMetadata,
  FilePermission,
  FolderItem,
  StorageUsage,
} from '@/types/file'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'

export type FileSystemItemType = 'file' | 'folder'

/** A resource belongs to one organization and may additionally be scoped to a project. */
export type FileResourceScope = {
  organizationId: string
  projectId?: string
}

export type FilesApiErrorCode = ApiErrorCode<
  | 'quota_exceeded'
  | 'invalid_parent'
  | 'folder_cycle'
  | 'upload_failed'
  | 'storage_unavailable'
>

export type FilesApiFailure = ApiFailure<FilesApiErrorCode, {
  currentVersion?: string
}>

export type FilesApiSuccess<T> = ApiSuccess<T>
export type FilesApiResult<T> = ApiResult<T, FilesApiErrorCode, { currentVersion?: string }>
export type FileSystemMutationResponse<T> =
  | ApiSuccess<T>
  | (ApiVersionMismatch<'currentFileVersion'> & { resource: 'file' })
  | (ApiVersionMismatch<'currentFolderVersion'> & { resource: 'folder' })
  | ApiFailure<Exclude<FilesApiErrorCode, 'version_mismatch'>>
export type FileMoveMutationResponse<T> =
  | FileSystemMutationResponse<T>
  | (ApiVersionMismatch<'currentDestinationFolderVersion'> & { resource: 'destination-folder' })
export type FileShareMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentFileVersion'>
  | ApiFailure<Exclude<FilesApiErrorCode, 'version_mismatch'>>

/** Size, MIME type, timestamps, and owner are backend-authoritative metadata. */
export type AuthoritativeFileItem = Omit<FileItem, 'downloadUrl'> & FileResourceScope & {
  ownerId: string
  version: string
}

export type AuthoritativeFolderItem = FolderItem & FileResourceScope & {
  ownerId: string
  version: string
}

export type ListFileSystemItemsQuery = FileResourceScope & {
  parentFolderId?: string | null
  cursor?: string
  limit?: number
}

export type ListFileSystemItemsResponse = FilesApiResult<{
  files: AuthoritativeFileItem[]
  folders: AuthoritativeFolderItem[]
  nextCursor?: string
}>

export type GetFileMetadataResponse = FilesApiResult<{ file: AuthoritativeFileItem }>
export type GetFolderMetadataResponse = FilesApiResult<{ folder: AuthoritativeFolderItem }>

export type FileSystemVersionPrecondition = {
  itemId: string
  itemType: FileSystemItemType
  expectedVersion: string
}

export type CreateFolderRequest = FileResourceScope & IdempotentCommand & {
  name: string
  parentFolderId?: string | null
}

export type CreateFolderResponse = FilesApiResult<{ folder: AuthoritativeFolderItem }>

export type RenameFileSystemItemRequest = FileSystemVersionPrecondition & {
  name: string
}

export type RenameFileSystemItemResponse = FileSystemMutationResponse<{
  item: AuthoritativeFileItem | AuthoritativeFolderItem
}>

export type MoveFileSystemItemRequest = FileSystemVersionPrecondition & {
  destinationFolderId: string | null
  expectedDestinationVersion?: string
}

export type MoveFileSystemItemResponse = FileMoveMutationResponse<{
  item: AuthoritativeFileItem | AuthoritativeFolderItem
}>

export type DeleteFileSystemItemRequest = FileSystemVersionPrecondition
export type DeleteFileSystemItemResponse = FileSystemMutationResponse<{ itemId: string; itemType: FileSystemItemType }>

/** Metadata requests an upload session; the binary never travels in this JSON contract. */
export type RequestFileUploadInput = FileResourceScope & IdempotentCommand & {
  name: string
  folderId?: string | null
  metadata: Pick<FileMetadata, 'mimeType' | 'sizeBytes' | 'extension' | 'checksum'>
}

export type FileUploadState = 'pending' | 'uploading' | 'completed' | 'failed'

export type FileUploadSession = {
  uploadId: string
  state: FileUploadState
  uploadReference?: string
  expiresAt?: string
  progress: number
  file?: AuthoritativeFileItem
  failureMessage?: string
}

export type RequestFileUploadResponse = FilesApiResult<{ upload: FileUploadSession }>
export type GetFileUploadStatusResponse = FilesApiResult<{ upload: FileUploadSession }>

export type RequestFileDownloadInput = {
  fileId: string
  expectedVersion?: string
}

/** Signed/reference download URLs expire and are never persisted as file metadata by the frontend. */
export type RequestFileDownloadResponse = FilesApiResult<{
  downloadReference: string
  expiresAt: string
  file: AuthoritativeFileItem
}>

export type UpdateFilePermissionsRequest = FileSystemVersionPrecondition & {
  permissions: FilePermission[]
}

export type UpdateFilePermissionsResponse = FileSystemMutationResponse<{
  item: AuthoritativeFileItem | AuthoritativeFolderItem
  permissions: FilePermission[]
}>

export type CreateFileShareRequest = IdempotentCommand & {
  fileId: string
  expectedVersion: string
}

export type CreateFileShareResponse = FileShareMutationResponse<{
  shareReference: string
  expiresAt?: string
}>

export type GetStorageUsageResponse = FilesApiResult<{
  scope: FileResourceScope
  usage: StorageUsage
  computedAt: string
}>

/**
 * Permission checks and project/org scope are backend-authoritative. Folder moves
 * must reject invalid parents and cycles. Rename/move/delete/permissions use versions.
 * Attachment records can later reference stable `fileId` values; upload/download remain
 * session/reference operations rather than normal JSON binary payloads.
 */
export interface FilesApiContract {
  listItems(query: ListFileSystemItemsQuery): Promise<ListFileSystemItemsResponse>
  getFileMetadata(fileId: string): Promise<GetFileMetadataResponse>
  getFolderMetadata(folderId: string): Promise<GetFolderMetadataResponse>
  createFolder(input: CreateFolderRequest): Promise<CreateFolderResponse>
  renameItem(input: RenameFileSystemItemRequest): Promise<RenameFileSystemItemResponse>
  moveItem(input: MoveFileSystemItemRequest): Promise<MoveFileSystemItemResponse>
  deleteItem(input: DeleteFileSystemItemRequest): Promise<DeleteFileSystemItemResponse>
  requestUpload(input: RequestFileUploadInput): Promise<RequestFileUploadResponse>
  getUploadStatus(uploadId: string): Promise<GetFileUploadStatusResponse>
  requestDownload(input: RequestFileDownloadInput): Promise<RequestFileDownloadResponse>
  createShare(input: CreateFileShareRequest): Promise<CreateFileShareResponse>
  updatePermissions(input: UpdateFilePermissionsRequest): Promise<UpdateFilePermissionsResponse>
  getStorageUsage(scope: FileResourceScope): Promise<GetStorageUsageResponse>
}
