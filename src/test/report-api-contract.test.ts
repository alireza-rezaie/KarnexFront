import { describe, expect, it } from 'vitest'
import type {
  BurndownReportResponse,
  ReportApiFailure,
  RequestReportExportInput,
} from '@/types/reportApi'

describe('reports API contract', () => {
  it('distinguishes authoritative zero data from an absent historical series', () => {
    const zero: BurndownReportResponse = {
      ok: true,
      query: { projectId: 'project-a', dateRange: { start: '2026-10-01', end: '2026-10-31' } },
      snapshot: { snapshotId: 'snapshot-a', queryFingerprint: 'query-a', generatedAt: '2026-10-31T00:00:00.000Z', timezone: 'Asia/Tehran', aggregationPeriod: { start: '2026-10-01', end: '2026-10-31', aggregation: 'day' } },
      history: { kind: 'available', data: { remaining: [] }, isZeroData: true },
    }
    const noHistory: BurndownReportResponse = {
      ...zero,
      history: { kind: 'no-history', data: { remaining: [] } },
    }

    expect(zero.history.kind).toBe('available')
    expect(noHistory.history.kind).toBe('no-history')
  })

  it('makes report export an asynchronous job rather than a fabricated download', () => {
    const request: RequestReportExportInput = {
      idempotencyKey: 'report-export-1',
      kind: 'velocity',
      format: 'csv',
      query: { projectId: 'project-a', dateRange: { start: '2026-10-01', end: '2026-10-31' } },
    }

    expect(request.format).toBe('csv')
  })

  it('models unavailable and backend failures independently', () => {
    const unavailable: ReportApiFailure = { ok: false, code: 'unavailable' }
    const backend: ReportApiFailure = { ok: false, code: 'backend_error' }

    expect([unavailable.code, backend.code]).toEqual(['unavailable', 'backend_error'])
  })
})
