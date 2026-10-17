export type FileMetadata = {
  mimeType: string
  sizeBytes: number
  extension?: string
  checksum?: string
}

export type FileItem = {
  id: string
  name: string
  folderId: string | null
  metadata: FileMetadata
  createdAt: string
  updatedAt: string
  createdById?: string
  downloadUrl?: string
}

export type FolderItem = {
  id: string
  name: string
  parentFolderId: string | null
  createdAt: string
  updatedAt: string
  createdById?: string
}

export type UploadState = 'queued' | 'uploading' | 'completed' | 'failed'

export type UploadProgress = {
  uploadId: string
  fileName: string
  state: UploadState
  progress: number
  error?: string
}

export type UploadRequest = {
  file: File
  folderId?: FolderItem['id'] | null
}

export type StorageUsage = {
  usedBytes: number
  quotaBytes?: number
}

export type FileCapabilities = {
  canUpload: boolean
  canDownload: boolean
  canDelete: boolean
  canRename: boolean
  canCreateFolder: boolean
  canMove: boolean
  canShare: boolean
  canManagePermissions: boolean
}

export type FilePermission = {
  memberId: string
  access: 'view' | 'edit'
}

export type MoveItemRequest = {
  itemId: string
  itemType: 'file' | 'folder'
  destinationFolderId: FolderItem['id'] | null
}

export type FileMutationResult =
  | { ok: true }
  | { ok: false; message?: string }

export type FilesDisplayCopy = {
  serviceUnavailable: string
  filesUnavailable: string
  foldersUnavailable: string
  storageUsageUnavailable: string
  actionUnavailable: string
  loading: string
}
