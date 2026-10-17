import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Activity, BarChart3, ChevronLeft, Download, Filter, TrendingDown, Zap } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { chartTheme } from '@/lib/chart-theme'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectStatus } from '@/contexts/ProjectStatusContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useSprints } from '@/contexts/SprintsContext'
import { type ReportMetric } from '@/utils/reportMetrics'
import { useReports } from '@/contexts/ReportsContext'
import type { BurndownReport, ControlChartReport, CreatedResolvedReport, CumulativeFlowReport, VelocityReport, ReportKind } from '@/types/report'
import { formatJalaliDate } from '@/utils/jalaliDate'
import { useOptionalTerminalStatusPolicy } from '@/contexts/TerminalStatusPolicyContext'

const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })
const axis = { fontSize: 10, fill: chartTheme.axis }
const tooltip = { contentStyle: chartTheme.tooltip, labelStyle: { color: 'hsl(var(--foreground))' } }

function Metrics({ items }: { items: ReportMetric[] }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {items.map((item) => <div key={item.label} className="karnex-card p-4">
      <p className="mb-1 text-xs text-muted-foreground">{item.label}</p>
      <p className="text-xl font-bold text-foreground">{typeof item.value === 'number' ? number.format(item.value) : item.value}</p>
    </div>)}
  </div>
}

function ChartCard({ children, chartType, title, icon: Icon }: { children: React.ReactNode; chartType: 'line' | 'grouped-bar' | 'stacked-area' | 'scatter'; title: string; icon: typeof Activity }) {
  return <section data-testid="report-chart" data-chart-type={chartType} className="karnex-card p-5">
    <div className="mb-4 flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">{title}</h2></div>
    <div className="h-72">{children}</div>
  </section>
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">{message}</div>
}

function Table({ children, headings }: { children: React.ReactNode; headings: string[] }) {
  return <section className="karnex-card overflow-x-auto p-5">
    <table className="w-full min-w-[560px]">
      <thead><tr className="border-b border-border bg-secondary/30">{headings.map((heading) => <th key={heading} className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{heading}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </section>
}

const Cell = ({ children }: { children: React.ReactNode }) => <td className="border-b border-border px-4 py-3 text-xs text-muted-foreground">{children}</td>

export default function ReportDetailPage() {
  const { projectId, type } = useParams()
  const navigate = useNavigate()
  const { currentProject, projectExists } = useProject()
  const { tasks } = useProjectTasks()
  const { sprints } = useSprints()
  const { statuses } = useProjectStatus()
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy()
  const { serviceAvailable, loading, error, capabilities, displayCopy, getBurndownReport, getVelocityReport, getCumulativeFlowReport, getControlChartReport, getCreatedResolvedReport, exportReport } = useReports()
  const [burndown, setBurndown] = useState<BurndownReport | null>(null)
  const [velocity, setVelocity] = useState<VelocityReport | null>(null)
  const [cumulativeFlow, setCumulativeFlow] = useState<CumulativeFlowReport | null>(null)
  const [controlChart, setControlChart] = useState<ControlChartReport | null>(null)
  const [createdResolved, setCreatedResolved] = useState<CreatedResolvedReport | null>(null)

  const projectSprints = sprints.filter((sprint) => sprint.projectId === currentProject?.id)
  const activeSprintId = projectSprints.find((sprint) => sprint.status === 'active')?.id
  useEffect(() => {
    if (type !== 'burndown' || !currentProject || !serviceAvailable || !getBurndownReport) return
    void getBurndownReport({ projectId: currentProject.id, sprintId: activeSprintId, dateRange: { start: currentProject.startDate, end: currentProject.endDate } }).then(setBurndown)
  }, [activeSprintId, currentProject, getBurndownReport, serviceAvailable, type])
  useEffect(() => {
    if (type !== 'velocity' || !currentProject || !serviceAvailable || !getVelocityReport) return
    let ignore = false
    void getVelocityReport({ projectId: currentProject.id, dateRange: { start: currentProject.startDate, end: currentProject.endDate } }).then((result) => { if (!ignore) setVelocity(result) })
    return () => { ignore = true }
  }, [currentProject, getVelocityReport, serviceAvailable, type])
  useEffect(() => {
    if (type !== 'cumulative' || !currentProject || !serviceAvailable || !getCumulativeFlowReport) return
    let ignore = false
    void getCumulativeFlowReport({ projectId: currentProject.id, dateRange: { start: currentProject.startDate, end: currentProject.endDate } }).then((result) => { if (!ignore) setCumulativeFlow(result) })
    return () => { ignore = true }
  }, [currentProject, getCumulativeFlowReport, serviceAvailable, type])
  useEffect(() => {
    if (type !== 'control' || !currentProject || !serviceAvailable || !getControlChartReport) return
    let ignore = false
    void getControlChartReport({ projectId: currentProject.id, dateRange: { start: currentProject.startDate, end: currentProject.endDate } }).then((result) => { if (!ignore) setControlChart(result) })
    return () => { ignore = true }
  }, [currentProject, getControlChartReport, serviceAvailable, type])
  useEffect(() => {
    if (type !== 'created' || !currentProject || !serviceAvailable || !getCreatedResolvedReport) return
    let ignore = false
    void getCreatedResolvedReport({ projectId: currentProject.id, dateRange: { start: currentProject.startDate, end: currentProject.endDate } }).then((result) => { if (!ignore) setCreatedResolved(result) })
    return () => { ignore = true }
  }, [currentProject, getCreatedResolvedReport, serviceAvailable, type])
  if (!projectExists || !currentProject) return <div>پروژه پیدا نشد</div>
  if (!type || !['burndown', 'velocity', 'cumulative', 'control', 'created'].includes(type)) return <Navigate to={`/projects/${projectId}/reports`} replace />
  const sharedHeader = (title: string, subtitle: string, reportKind: ReportKind = 'burndown') => <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <button type="button" aria-label="بازگشت به گزارش‌ها" onClick={() => navigate(`/projects/${projectId}/reports`)} className="rounded-lg p-2 transition-colors hover:bg-secondary"><ChevronLeft className="size-4" /></button>
      <div><h1 className="text-xl font-bold text-foreground">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
    </div>
    <div className="flex items-center gap-2">
      <span title={displayCopy.actionUnavailable}><button type="button" disabled={!(serviceAvailable && !loading && capabilities.canFilterReports)} className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground opacity-50"><Filter className="size-3.5" />فیلتر</button></span>
      <span title={displayCopy.actionUnavailable}><button type="button" disabled={!(serviceAvailable && !loading && capabilities.canExportReports && exportReport)} onClick={() => exportReport && void exportReport(reportKind, { projectId: currentProject.id, sprintId: activeSprintId, dateRange: { start: currentProject.startDate, end: currentProject.endDate } }, 'csv')} className="app-action opacity-50"><Download className="size-3.5" />خروجی</button></span>
    </div>
  </div>

  if (type === 'burndown') {
    if (!serviceAvailable || loading || !burndown) return <div className="space-y-6" dir="rtl">{sharedHeader('نمودار Burndown', 'کاهش کار باقی‌مانده در اسپرینت')}<ChartCard chartType="line" title="کار باقی‌مانده در طول اسپرینت" icon={TrendingDown}><EmptyChart message={loading ? displayCopy.loading : error ?? displayCopy.reportsUnavailable} /></ChartCard></div>
    const report = { data: burndown.remaining.map((point, index) => ({ day: point.date, actual: point.value, ideal: burndown.scope?.[index]?.value })), sprintTasks: tasks.slice(0, 0), metrics: [{ label: 'کار باقی‌مانده', value: burndown.remaining.at(-1)?.value ?? 0 }, { label: 'نقاط تاریخی', value: burndown.remaining.length }] }
    return <div className="space-y-6" dir="rtl">{sharedHeader('نمودار Burndown', 'کاهش کار باقی‌مانده در اسپرینت')}
      <Metrics items={report.metrics} />
      <ChartCard chartType="line" title="کار باقی‌مانده در طول اسپرینت" icon={TrendingDown}><ResponsiveContainer width="100%" height="100%"><LineChart data={report.data}><CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} /><Tooltip {...tooltip} /><Legend /><Line type="monotone" dataKey="ideal" name="کار ایده‌آل باقی‌مانده" stroke="#8b9bb4" strokeDasharray="5 5" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="actual" name="کار واقعی باقی‌مانده" stroke="#3b82f6" strokeWidth={2.5} /></LineChart></ResponsiveContainer></ChartCard>
      <Table headings={['وظیفه', 'Story Point', 'وضعیت', 'سررسید']}><>{report.sprintTasks.filter((task) => !(terminalStatusPolicy?.isTaskCompleted(currentProject.id, task) ?? false)).map((task) => <tr key={task.id}><Cell>{task.title}</Cell><Cell>{number.format(task.storyPoints ?? 1)}</Cell><Cell>{statuses.find((status) => status.id === task.status)?.name ?? task.status}</Cell><Cell>{formatJalaliDate(task.dueDate) ?? '—'}</Cell></tr>)}{!report.sprintTasks.some((task) => !(terminalStatusPolicy?.isTaskCompleted(currentProject.id, task) ?? false)) && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">کار باقی‌مانده‌ای در این اسپرینت وجود ندارد.</td></tr>}</></Table>
    </div>
  }

  if (type === 'velocity') {
    if (!serviceAvailable || loading || !velocity) return <div className="space-y-6" dir="rtl">{sharedHeader('Velocity', 'مقایسه تعهد و تحویل Story Point در اسپرینت‌ها', 'velocity')}<ChartCard chartType="grouped-bar" title="Velocity اسپرینت‌ها" icon={BarChart3}><EmptyChart message={loading ? displayCopy.loading : error ?? displayCopy.reportsUnavailable} /></ChartCard></div>
    const rows = velocity.map((row) => ({ ...row, sprint: projectSprints.find((sprint) => sprint.id === row.sprintId)?.name ?? row.sprintId, completion: row.committed ? Math.round((row.completed / row.committed) * 100) : 0, difference: row.completed - row.committed }))
    const metrics: ReportMetric[] = [{ label: 'تعهد کل', value: rows.reduce((total, row) => total + row.committed, 0) }, { label: 'تکمیل کل', value: rows.reduce((total, row) => total + row.completed, 0) }, { label: 'اسپرینت‌های گزارش‌شده', value: rows.length }]
    return <div className="space-y-6" dir="rtl">{sharedHeader('Velocity', 'مقایسه تعهد و تحویل Story Point در اسپرینت‌ها', 'velocity')}
      <Metrics items={metrics} />
      <ChartCard chartType="grouped-bar" title="Velocity اسپرینت‌ها" icon={BarChart3}>{rows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} barGap={5}><CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="sprint" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} /><Tooltip {...tooltip} /><Legend /><Bar dataKey="committed" name="تعهدشده" fill="#64748b" radius={[4, 4, 0, 0]} /><Bar dataKey="completed" name="تکمیل‌شده" fill="#22c55e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart message="داده Velocity از سرویس گزارش‌گیری دریافت نشد." />}</ChartCard>
      <Table headings={['اسپرینت', 'تعهد', 'تکمیل', 'تحقق', 'اختلاف']}><>{rows.map((row) => <tr key={row.sprintId}><Cell>{row.sprint}</Cell><Cell>{number.format(row.committed)}</Cell><Cell>{number.format(row.completed)}</Cell><Cell>{row.completion}٪</Cell><Cell>{number.format(row.difference)}</Cell></tr>)}{!rows.length && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">داده Velocity موجود نیست.</td></tr>}</></Table>
    </div>
  }

  if (type === 'cumulative') {
    if (!serviceAvailable || loading || !cumulativeFlow) return <div className="space-y-6" dir="rtl">{sharedHeader('Cumulative Flow', 'حجم کار در وضعیت‌های واقعی پروژه', 'cumulative-flow')}<ChartCard chartType="stacked-area" title="جریان تجمعی وضعیت‌ها" icon={Activity}><EmptyChart message={loading ? displayCopy.loading : error ?? displayCopy.reportsUnavailable} /></ChartCard></div>
    const data = Array.from(new Set(cumulativeFlow.map((point) => point.date))).map((date) => cumulativeFlow.filter((point) => point.date === date).reduce<Record<string, string | number>>((row, point) => ({ ...row, date, [point.statusId]: point.count }), { date }))
    const latestDate = data.at(-1)
    const areas = statuses.filter((status) => cumulativeFlow.some((point) => point.statusId === status.id)).map((status) => {
      const latestCount = latestDate?.[status.id]
      return { key: status.id, label: status.name, color: status.color, count: typeof latestCount === 'number' ? latestCount : 0 }
    })
    const latestTotal = areas.reduce((total, area) => total + area.count, 0)
    const metrics: ReportMetric[] = [{ label: 'وضعیت‌های گزارش‌شده', value: areas.length }, { label: 'نقاط تاریخی', value: data.length }, { label: 'کار جاری', value: latestTotal }]
    return <div className="space-y-6" dir="rtl">{sharedHeader('Cumulative Flow', 'حجم کار در وضعیت‌های واقعی پروژه', 'cumulative-flow')}
      <Metrics items={metrics} />
      <ChartCard chartType="stacked-area" title="جریان تجمعی وضعیت‌ها" icon={Activity}>{areas.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} /><Tooltip {...tooltip} /><Legend />{areas.map((area) => <Area key={area.key} type="monotone" dataKey={area.key} name={area.label} stackId="status" stroke={area.color} fill={area.color} fillOpacity={0.55} />)}</AreaChart></ResponsiveContainer> : <EmptyChart message="داده جریان تجمعی از سرویس گزارش‌گیری دریافت نشد." />}</ChartCard>
      <Table headings={['وضعیت', 'تعداد فعلی', 'درصد']}><>{areas.map((area) => <tr key={area.key}><Cell><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full" style={{ backgroundColor: area.color }} />{area.label}</span></Cell><Cell>{number.format(area.count)}</Cell><Cell>{latestTotal ? `${Math.round((area.count / latestTotal) * 100)}٪` : '۰٪'}</Cell></tr>)}</></Table>
    </div>
  }

  if (type === 'control') {
    if (!serviceAvailable || loading || !controlChart) return <div className="space-y-6" dir="rtl">{sharedHeader('نمودار کنترل', 'Cycle Time وظایف تکمیل‌شده', 'control-chart')}<ChartCard chartType="scatter" title="Cycle Time هر وظیفه" icon={Activity}><EmptyChart message={loading ? displayCopy.loading : error ?? displayCopy.reportsUnavailable} /></ChartCard></div>
    const rows = controlChart.filter((row) => typeof row.cycleTimeDays === 'number').map((row, index) => ({ ...row, index: index + 1, cycleTime: row.cycleTimeDays ?? 0, title: tasks.find((task) => task.id === row.taskId)?.title ?? row.taskId }))
    const cycleTimes = rows.map((row) => row.cycleTime)
    const sortedCycleTimes = [...cycleTimes].sort((left, right) => left - right)
    const average = cycleTimes.length ? cycleTimes.reduce((total, value) => total + value, 0) / cycleTimes.length : 0
    const median = sortedCycleTimes.length ? sortedCycleTimes[Math.floor(sortedCycleTimes.length / 2)] : 0
    const metrics: ReportMetric[] = [{ label: 'میانگین Cycle Time', value: `${number.format(average)} روز` }, { label: 'میانه', value: `${number.format(median)} روز` }, { label: 'کمینه / بیشینه', value: cycleTimes.length ? `${number.format(sortedCycleTimes[0])} / ${number.format(sortedCycleTimes.at(-1) ?? 0)}` : '—' }]
    return <div className="space-y-6" dir="rtl">{sharedHeader('نمودار کنترل', 'Cycle Time وظایف تکمیل‌شده', 'control-chart')}
      <Metrics items={metrics} />
      <ChartCard chartType="scatter" title="Cycle Time هر وظیفه" icon={Activity}>{rows.length ? <ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} /><XAxis type="number" dataKey="index" name="ترتیب تکمیل" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis type="number" dataKey="cycleTime" name="روز" tick={axis} axisLine={false} tickLine={false} /><Tooltip {...tooltip} cursor={{ strokeDasharray: '3 3' }} /><ReferenceLine y={average} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `میانگین ${number.format(average)} روز`, fill: chartTheme.axis, fontSize: 10 }} /><Scatter data={rows} name="Cycle Time" fill="#a855f7" /></ScatterChart></ResponsiveContainer> : <EmptyChart message="داده Cycle Time از سرویس گزارش‌گیری دریافت نشد." />}</ChartCard>
      <Table headings={['وظیفه', 'Cycle Time', 'تاریخ تکمیل']}><>{rows.map((row) => <tr key={row.taskId}><Cell>{row.title}</Cell><Cell>{number.format(row.cycleTime)} روز</Cell><Cell>{row.completedAt ?? '—'}</Cell></tr>)}{!rows.length && <tr><td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">داده Cycle Time موجود نیست.</td></tr>}</></Table>
    </div>
  }

  if (!serviceAvailable || loading || !createdResolved) return <div className="space-y-6" dir="rtl">{sharedHeader('ایجاد شده vs حل شده', 'مقایسه روند ایجاد و حل وظایف در بازه زمانی', 'created-resolved')}<ChartCard chartType="line" title="روند ایجاد و حل وظایف" icon={Zap}><EmptyChart message={loading ? displayCopy.loading : error ?? displayCopy.reportsUnavailable} /></ChartCard></div>
  const created = createdResolved.reduce((total, row) => total + row.created, 0)
  const resolved = createdResolved.reduce((total, row) => total + row.resolved, 0)
  const metrics: ReportMetric[] = [{ label: 'ایجادشده', value: created }, { label: 'حل‌شده', value: resolved }, { label: 'تغییر خالص', value: created - resolved }, { label: 'نسبت حل', value: `${created ? Math.round((resolved / created) * 100) : 0}٪` }]
  return <div className="space-y-6" dir="rtl">{sharedHeader('ایجاد شده vs حل شده', 'مقایسه روند ایجاد و حل وظایف در بازه زمانی', 'created-resolved')}
    <Metrics items={metrics} />
    <ChartCard chartType="line" title="روند ایجاد و حل وظایف" icon={Zap}>{createdResolved.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={createdResolved}><CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip {...tooltip} /><Legend /><Line type="monotone" dataKey="created" name="ایجادشده" stroke="#38bdf8" strokeWidth={2.5} /><Line type="monotone" dataKey="resolved" name="حل‌شده" stroke="#22c55e" strokeWidth={2.5} /></LineChart></ResponsiveContainer> : <EmptyChart message="داده زمانی از سرویس گزارش‌گیری دریافت نشد." />}</ChartCard>
    <Table headings={['تاریخ', 'ایجادشده', 'حل‌شده', 'تغییر خالص']}><>{createdResolved.map((row) => <tr key={row.date}><Cell>{row.date}</Cell><Cell>{number.format(row.created)}</Cell><Cell>{number.format(row.resolved)}</Cell><Cell>{number.format(row.created - row.resolved)}</Cell></tr>)}{!createdResolved.length && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">داده‌ای برای نمایش وجود ندارد.</td></tr>}</></Table>
  </div>
}
