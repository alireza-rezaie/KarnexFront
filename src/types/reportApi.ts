import type {
  BurndownReport,
  ControlChartReport,
  CreatedResolvedReport,
  CumulativeFlowReport,
  ReportDateRange,
  ReportExportFormat,
  ReportFilters,
  ReportKind,
  ReportsOverview,
  VelocityReport,
} from '@/types/report'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, IdempotentCommand } from '@/types/api'

/** Canonical transport failures for project report queries and export jobs. */
export type ReportApiErrorCode = ApiErrorCode<
  | 'unavailable'
  | 'export_failed'
  | 'backend_error'
>

export type ReportApiFailure = ApiFailure<ReportApiErrorCode, {
  retryAfterSeconds?: number
}>

export type ReportApiSuccess<T> = ApiSuccess<T>
export type ReportApiResult<T> = ApiResult<T, ReportApiErrorCode, { retryAfterSeconds?: number }>

/** ISO range supplied by the client; display conversion to Jalali remains in the frontend. */
export type ProjectReportQuery = {
  projectId: string
  dateRange: ReportDateRange
  sprintId?: string
  filters?: ReportFilters
  /** IANA timezone used for buckets; server returns the authoritative applied value. */
  timezone?: string
  aggregation?: 'day' | 'week' | 'month'
}

export type ReportSnapshotMetadata = {
  /** A response-wide immutable snapshot identity. Do not merge series with different IDs. */
  snapshotId: string
  queryFingerprint: string
  generatedAt: string
  timezone: string
  aggregationPeriod: ReportDateRange & { aggregation: 'day' | 'week' | 'month' }
}

/**
 * `available` may represent legitimate zero values. `no-history` means no persisted
 * snapshots/events exist for the query—not a generated replacement timeline.
 */
export type HistoricalReportData<T> =
  | { kind: 'available'; data: T; isZeroData: boolean }
  | { kind: 'no-history'; data: T }

export type ReportResponse<T> = ReportApiResult<{
  query: ProjectReportQuery
  snapshot: ReportSnapshotMetadata
  history: HistoricalReportData<T>
}>

export type ReportsOverviewResponse = ReportApiResult<{
  query: Omit<ProjectReportQuery, 'sprintId'>
  snapshot: ReportSnapshotMetadata
  overview: ReportsOverview
  /** True only when authoritative aggregation has no work, never a fabricated fallback. */
  isZeroData: boolean
}>

export type BurndownReportResponse = ReportResponse<BurndownReport>
export type VelocityReportResponse = ReportResponse<VelocityReport>
export type CumulativeFlowReportResponse = ReportResponse<CumulativeFlowReport>
export type ControlChartReportResponse = ReportResponse<ControlChartReport>
export type CreatedResolvedReportResponse = ReportResponse<CreatedResolvedReport>

export type RequestReportExportInput = IdempotentCommand & {
  kind: ReportKind
  query: ProjectReportQuery
  format: ReportExportFormat
}

export type ReportExportJobStatus = 'queued' | 'running' | 'completed' | 'failed'

/** A download reference exists only for a completed server-side export job. */
export type ReportExportJob = {
  id: string
  status: ReportExportJobStatus
  kind: ReportKind
  format: ReportExportFormat
  requestedAt: string
  completedAt?: string
  expiresAt?: string
  downloadReference?: string
  failureCode?: 'export_failed' | 'unavailable' | 'backend_error'
  failureMessage?: string
}

export type RequestReportExportResponse = ReportApiResult<{
  job: ReportExportJob
}>

export type GetReportExportJobResponse = ReportApiResult<{
  job: ReportExportJob
}>

/**
 * Every read requires project visibility. The backend aggregates terminal work from
 * the project's authoritative workflow/Board terminal-status semantics, never a
 * literal status name. Historical reports are sourced only from persisted snapshots
 * or events. Export creation is asynchronous and does not imply a completed download.
 */
export interface ReportsApiContract {
  getOverview(query: Omit<ProjectReportQuery, 'sprintId'>): Promise<ReportsOverviewResponse>
  getBurndown(query: ProjectReportQuery): Promise<BurndownReportResponse>
  getVelocity(query: ProjectReportQuery): Promise<VelocityReportResponse>
  getCumulativeFlow(query: ProjectReportQuery): Promise<CumulativeFlowReportResponse>
  getControlChart(query: ProjectReportQuery): Promise<ControlChartReportResponse>
  getCreatedResolved(query: ProjectReportQuery): Promise<CreatedResolvedReportResponse>
  requestExport(input: RequestReportExportInput): Promise<RequestReportExportResponse>
  getExportJob(jobId: string): Promise<GetReportExportJobResponse>
}
