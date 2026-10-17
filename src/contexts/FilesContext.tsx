import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type {
  FileCapabilities,
  FileItem,
  FileMutationResult,
  FilePermission,
  FilesDisplayCopy,
  FolderItem,
  MoveItemRequest,
  StorageUsage,
  UploadProgress,
  UploadRequest,
} from '@/types/file'

type FilesContextValue = {
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  files: FileItem[]
  folders: FolderItem[]
  currentFolderId: FolderItem['id'] | null
  uploads: UploadProgress[]
  storageUsage: StorageUsage | null
  capabilities: FileCapabilities
  displayCopy: FilesDisplayCopy
  uploadFile?: (request: UploadRequest) => Promise<FileMutationResult>
  downloadFile?: (fileId: FileItem['id']) => Promise<FileMutationResult>
  deleteFile?: (fileId: FileItem['id']) => Promise<FileMutationResult>
  renameFile?: (fileId: FileItem['id'], name: string) => Promise<FileMutationResult>
  createFolder?: (name: string, parentFolderId?: FolderItem['id'] | null) => Promise<FileMutationResult>
  moveItem?: (request: MoveItemRequest) => Promise<FileMutationResult>
  shareFile?: (fileId: FileItem['id']) => Promise<FileMutationResult>
  updatePermissions?: (fileId: FileItem['id'], permissions: FilePermission[]) => Promise<FileMutationResult>
}

const unavailableCapabilities: FileCapabilities = {
  canUpload: false,
  canDownload: false,
  canDelete: false,
  canRename: false,
  canCreateFolder: false,
  canMove: false,
  canShare: false,
  canManagePermissions: false,
}

const unavailableCopy: FilesDisplayCopy = {
  serviceUnavailable: 'نیازمند اتصال سرویس ذخیره‌سازی',
  filesUnavailable: 'فایل‌ها پس از اتصال سرویس ذخیره‌سازی نمایش داده می‌شوند.',
  foldersUnavailable: 'پوشه‌ها پس از اتصال سرویس ذخیره‌سازی نمایش داده می‌شوند.',
  storageUsageUnavailable: 'اطلاعات فضای ذخیره‌سازی پس از اتصال سرویس در دسترس خواهد بود.',
  actionUnavailable: 'این عملیات پس از اتصال سرویس ذخیره‌سازی در دسترس خواهد بود.',
  loading: 'در حال دریافت اطلاعات فایل‌ها…',
}

const availableCopy: FilesDisplayCopy = {
  serviceUnavailable: 'وضعیت سرویس ذخیره‌سازی در حال بررسی است.',
  filesUnavailable: 'فایل‌ها از سرویس ذخیره‌سازی دریافت می‌شوند.',
  foldersUnavailable: 'پوشه‌ها از سرویس ذخیره‌سازی دریافت می‌شوند.',
  storageUsageUnavailable: 'اطلاعات فضای ذخیره‌سازی از سرویس دریافت می‌شود.',
  actionUnavailable: 'این عملیات برای حساب فعلی در دسترس نیست.',
  loading: 'در حال دریافت اطلاعات فایل‌ها…',
}

const FilesContext = createContext<FilesContextValue | undefined>(undefined)

export function FilesProvider({ children }: { children: ReactNode }) {
  // The fallback remains empty and read-only until a storage-backed provider supplies data and mutations.
  const serviceAvailable = false
  const loading = false
  const error = null

  const value = useMemo<FilesContextValue>(() => ({
    serviceAvailable,
    loading,
    error,
    files: [],
    folders: [],
    currentFolderId: null,
    uploads: [],
    storageUsage: null,
    capabilities: unavailableCapabilities,
    displayCopy: serviceAvailable ? availableCopy : unavailableCopy,
  }), [serviceAvailable, loading, error])

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFiles() {
  const context = useContext(FilesContext)

  if (!context) {
    throw new Error('useFiles must be used within a FilesProvider.')
  }

  return context
}
