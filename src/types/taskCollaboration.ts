export type TaskCollaborationScope = { projectId: string; taskId: string }

export type TaskComment = TaskCollaborationScope & {
  id: string
  authorId: string
  body: string
  createdAt: string
  updatedAt: string | null
}

export type TaskAttachment = TaskCollaborationScope & {
  id: string
  name: string
  contentType: string
  size: number
  uploadedBy: string
  uploadedAt: string
}

export type TaskTimeLog = TaskCollaborationScope & {
  id: string
  authorId: string
  startedAt: string
  durationSeconds: number
  description: string | null
}

export type TaskActiveTimer = TaskCollaborationScope & {
  id: string
  authorId: string
  startedAt: string
}

export type TaskWatchState = TaskCollaborationScope & {
  isFollowing: boolean
  followerIds: string[]
}

export type TaskCollaborationCapabilities = {
  canViewComments: boolean
  canAddComment: boolean
  canEditComment: boolean
  canDeleteComment: boolean
  canViewAttachments: boolean
  canUploadAttachment: boolean
  canDownloadAttachment: boolean
  canDeleteAttachment: boolean
  canViewTimeLogs: boolean
  canAddTimeLog: boolean
  canEditTimeLog: boolean
  canDeleteTimeLog: boolean
  canStartTimer: boolean
  canStopTimer: boolean
  canFollowTask: boolean
}

export type TaskCollaborationMutationResult = { ok: true } | { ok: false; message?: string }

export type TaskCollaborationDisplayCopy = {
  serviceUnavailable: string
  dataUnavailable: string
  actionUnavailable: string
  loading: string
}
