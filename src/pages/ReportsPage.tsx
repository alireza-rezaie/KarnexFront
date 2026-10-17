import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Activity, BarChart3, Bookmark, GitCompare, TrendingDown, Zap } from 'lucide-react'
import { useProject } from '@/contexts/ProjectContext'
import { useReports } from '@/contexts/ReportsContext'
import type { ReportsOverview as ReportsOverviewData } from '@/types/report'
import './ReportsPage.css'

const reportNavigation = [{ id: 'burndown', label: 'Burndown', icon: TrendingDown }, { id: 'velocity', label: 'Velocity', icon: Zap }, { id: 'cumulative', label: 'جریان تجمعی', icon: BarChart3 }, { id: 'control', label: 'نمودار کنترل', icon: Activity }, { id: 'created', label: 'ایجادشده در برابر حل‌شده', icon: GitCompare }] as const

export default function ReportsPage() {
  const { currentProject } = useProject(); const reportsPath = currentProject ? `/projects/${currentProject.id}/reports` : '/projects'
  return <section className="reports-layout" dir="rtl"><aside className="reports-navigation" aria-label="ناوبری گزارش‌ها"><div className="reports-navigation-heading"><h1>گزارش‌ها</h1><p>تحلیل و گزارش‌گیری پروژه</p></div><nav className="reports-navigation-list">{reportNavigation.map((report) => { const Icon = report.icon; return <NavLink key={report.id} to={`${reportsPath}/${report.id}`} className={({ isActive }) => `reports-navigation-item${isActive ? ' active' : ''}`}><Icon aria-hidden /><span>{report.label}</span></NavLink> })}<button type="button" disabled className="reports-navigation-item reports-navigation-disabled" title="گزارش ذخیره‌شده به مدل پشتیبان نیاز دارد."><Bookmark aria-hidden /><span>گزارش‌های ذخیره‌شده</span></button></nav></aside><main className="reports-main-content"><Outlet /></main></section>
}

export function ReportsOverview() {
  const { currentProject } = useProject()
  const { serviceAvailable, loading, error, capabilities, displayCopy, getReportsOverview } = useReports()
  const [overviewResult, setOverviewResult] = useState<{ projectId: string; data: ReportsOverviewData } | null>(null)
  const canFilter = serviceAvailable && !loading && capabilities.canFilterReports

  useEffect(() => {
    if (!currentProject || !serviceAvailable || !capabilities.canViewReports || !getReportsOverview) {
      return
    }

    let ignore = false
    void getReportsOverview({
      projectId: currentProject.id,
      dateRange: { start: currentProject.startDate, end: currentProject.endDate },
    }).then((result) => {
      if (!ignore) setOverviewResult({ projectId: currentProject.id, data: result })
    })

    return () => { ignore = true }
  }, [capabilities.canViewReports, currentProject, getReportsOverview, serviceAvailable])

  const overview = overviewResult && overviewResult.projectId === currentProject?.id ? overviewResult.data : null
  const unavailable = !serviceAvailable || loading || !overview
  const heading = loading ? displayCopy.loading : serviceAvailable ? 'نمای کلی گزارش‌ها' : displayCopy.serviceUnavailable
  const description = error ?? (unavailable ? displayCopy.reportsUnavailable : 'شاخص‌های گزارش از سرویس گزارش‌گیری دریافت شده‌اند.')

  return <section className="reports-page" dir="rtl"><div className="reports-title"><h1>گزارش‌ها</h1><p>تحلیل و گزارش‌گیری از پروژه‌ها</p></div><section className="report-panel"><header className="report-panel-header"><div className="report-heading"><h2>{heading}</h2><p>{description}</p></div><button type="button" disabled={!canFilter} className="report-select" title={displayCopy.actionUnavailable}>فیلتر گزارش</button></header><div className="report-chart grid place-items-center text-sm text-muted-foreground">{unavailable ? description : <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">{overview.metrics.map((metric) => <div key={metric.id} className="rounded-lg border border-border/65 bg-secondary/25 p-3 text-right"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-1 text-lg font-bold text-foreground">{metric.value}</p></div>)}</div>}</div></section></section>
}
