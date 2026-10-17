import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { BurndownReport, ControlChartReport, CreatedResolvedReport, CumulativeFlowReport, ReportExportFormat, ReportKind, ReportMutationResult, ReportQueryState, ReportsCapabilities, ReportsDisplayCopy, ReportsOverview, VelocityReport } from '@/types/report'

type ReportsContextValue = {
  serviceAvailable: boolean; loading: boolean; error: string | null; capabilities: ReportsCapabilities; displayCopy: ReportsDisplayCopy
  getBurndownReport?: (query: ReportQueryState) => Promise<BurndownReport>
  getReportsOverview?: (query: Omit<ReportQueryState, 'sprintId'>) => Promise<ReportsOverview>
  getVelocityReport?: (query: ReportQueryState) => Promise<VelocityReport>
  getCumulativeFlowReport?: (query: ReportQueryState) => Promise<CumulativeFlowReport>
  getControlChartReport?: (query: ReportQueryState) => Promise<ControlChartReport>
  getCreatedResolvedReport?: (query: ReportQueryState) => Promise<CreatedResolvedReport>
  exportReport?: (kind: ReportKind, query: ReportQueryState, format: ReportExportFormat) => Promise<ReportMutationResult>
}
const unavailableCapabilities: ReportsCapabilities = { canViewReports: false, canFilterReports: false, canExportReports: false }
const unavailableCopy: ReportsDisplayCopy = { serviceUnavailable: 'نیازمند اتصال سرویس گزارش‌گیری', reportsUnavailable: 'گزارش‌های تاریخی پس از اتصال سرویس گزارش‌گیری نمایش داده می‌شوند.', actionUnavailable: 'این عملیات پس از اتصال سرویس گزارش‌گیری در دسترس خواهد بود.', loading: 'در حال دریافت گزارش‌ها…' }
const availableCopy: ReportsDisplayCopy = { serviceUnavailable: 'وضعیت سرویس گزارش‌گیری در حال بررسی است.', reportsUnavailable: 'گزارش‌های تاریخی از سرویس گزارش‌گیری دریافت می‌شوند.', actionUnavailable: 'این عملیات برای حساب فعلی در دسترس نیست.', loading: 'در حال دریافت گزارش‌ها…' }
const ReportsContext = createContext<ReportsContextValue | undefined>(undefined)
export function ReportsProvider({ children }: { children: ReactNode }) {
  const serviceAvailable = false, loading = false, error = null
  const value = useMemo<ReportsContextValue>(() => ({ serviceAvailable, loading, error, capabilities: unavailableCapabilities, displayCopy: serviceAvailable ? availableCopy : unavailableCopy }), [serviceAvailable, loading, error])
  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useReports() { const context = useContext(ReportsContext); if (!context) throw new Error('useReports must be used within a ReportsProvider.'); return context }
