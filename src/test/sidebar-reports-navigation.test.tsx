import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectGuard, ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectTaskProvider } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider } from '@/contexts/ProjectWorkflowContext'
import { ProjectStatusProvider } from '@/contexts/ProjectStatusContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { MembersProvider } from '@/contexts/MembersContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { SprintsProvider } from '@/contexts/SprintsContext'
import { ApprovalRequestsProvider } from '@/contexts/ApprovalRequestsContext'
import { CurrentUserProvider } from '@/contexts/CurrentUserContext'
import { ReportsProvider } from '@/contexts/ReportsContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import ReportsPage, { ReportsOverview } from '@/pages/ReportsPage'
import ReportDetailPage from '@/pages/ReportDetailPage'
import Sidebar, { ModuleContext, resolveActiveModule, resolveContextPath, resolveModulePath } from '@/components/Sidebar'

const projectId = 'p1'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

function ProjectReportRoutes({ initialEntry }: { initialEntry: string }) {
  return <AuthenticatedTestProvider userId="m1"><ReportsProvider><MembersProvider><ProjectsProvider><SprintsProvider><TasksProvider><MemoryRouter initialEntries={[initialEntry]}><RouteOutput /><Routes><Route path="/projects/:projectId" element={<ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><ProjectGuard><Outlet /></ProjectGuard></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider>}><Route path="reports" element={<ReportsPage />}><Route index element={<ReportsOverview />} /><Route path=":type" element={<ReportDetailPage />} /></Route></Route></Routes></MemoryRouter></TasksProvider></SprintsProvider></ProjectsProvider></MembersProvider></ReportsProvider></AuthenticatedTestProvider>
}

function RouteOutput() {
  const location = useLocation()
  return <output data-testid="project-route">{location.pathname}</output>
}

function ReportsMenuHarness() {
  const navigate = useNavigate()
  const location = useLocation()
  return <><output data-testid="route">{location.pathname}</output><ModuleContext activeId="reports" activeSprints={[]} onNavigate={(path) => navigate(path)} onProjectSelection={() => {}} currentProjectId={projectId} memberCount={0} pendingApprovalCount={0} /></>
}

function ReportsDrawerRoutes() {
  return <><Sidebar mobileOpen={false} onMobileClose={() => {}} /><RouteOutput /><Routes>
    <Route path="/projects" element={<div>Projects page</div>} />
    <Route path="/projects/:projectId" element={<ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><ProjectGuard><Outlet /></ProjectGuard></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider>}>
      <Route path="reports" element={<ReportsPage />}>
        <Route index element={<ReportsOverview />} />
        <Route path=":type" element={<ReportDetailPage />} />
      </Route>
    </Route>
  </Routes></>
}

function ProjectScopedReportsDrawerRoutes() {
  return <Routes><Route path="/projects/:projectId" element={<ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><ProjectGuard><><Sidebar mobileOpen={false} onMobileClose={() => {}} /><RouteOutput /><Outlet /></></ProjectGuard></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider>}>
    <Route path="board" element={<div>Board page</div>} />
    <Route path="backlog" element={<div>Backlog page</div>} />
    <Route path="timeline" element={<div>Timeline page</div>} />
    <Route path="tasks" element={<div>Tasks page</div>} />
    <Route path="settings" element={<div>Project settings page</div>} />
    <Route path="approvals" element={<div>Approvals page</div>} />
    <Route path="reports" element={<ReportsPage />}>
      <Route index element={<ReportsOverview />} />
      <Route path=":type" element={<ReportDetailPage />} />
    </Route>
    <Route path="backlog" element={<div>Backlog page</div>} />
    <Route path="board" element={<div>Board page</div>} />
    <Route path="timeline" element={<div>Timeline page</div>} />
    <Route path="tasks" element={<div>Tasks page</div>} />
    <Route path="settings" element={<div>Project settings page</div>} />
    <Route path="approvals" element={<div>Approvals page</div>} />
  </Route></Routes>
}

function ReportsDrawerApp({ initialEntry, projectScoped = false }: { initialEntry: string; projectScoped?: boolean }) {
  return <AuthenticatedTestProvider userId="m1"><ReportsProvider><MembersProvider><RolesProvider><ProjectsProvider><SprintsProvider><TasksProvider><ApprovalRequestsProvider><MemoryRouter initialEntries={[initialEntry]}><CurrentUserProvider>{projectScoped ? <ProjectScopedReportsDrawerRoutes /> : <ReportsDrawerRoutes />}</CurrentUserProvider></MemoryRouter></ApprovalRequestsProvider></TasksProvider></SprintsProvider></ProjectsProvider></RolesProvider></MembersProvider></ReportsProvider></AuthenticatedTestProvider>
}

afterEach(cleanup)
afterAll(() => vi.unstubAllGlobals())

describe('project reports navigation', () => {
  it('builds the reports module target from the current project id', () => {
    expect(resolveModulePath('reports', '/projects/:projectId/reports', projectId)).toBe(`/projects/${projectId}/reports`)
  })

  it('marks both the report list and detail routes as the active reports module', () => {
    expect(resolveActiveModule(`/projects/${projectId}/reports`).id).toBe('reports')
    expect(resolveActiveModule(`/projects/${projectId}/reports/burndown`).id).toBe('reports')
  })

  it.each([
    ['Burndown', '/report/burndown', `/projects/${projectId}/reports/burndown`],
    ['Velocity', '/report/velocity', `/projects/${projectId}/reports/velocity`],
    ['جریان تجمعی', '/report/cumulative', `/projects/${projectId}/reports/cumulative`],
    ['نمودار کنترل', '/report/control', `/projects/${projectId}/reports/control`],
    ['ایجادشده در برابر حل‌شده', '/report/created', `/projects/${projectId}/reports/created`],
  ])('navigates %s to its project-scoped detail URL', (label, sourcePath, targetPath) => {
    expect(resolveContextPath(sourcePath, projectId)).toBe(targetPath)
    render(<MemoryRouter initialEntries={[`/projects/${projectId}/reports`]}><ReportsMenuHarness /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getByTestId('route').textContent).toBe(targetPath)
  })

  it('renders the reports list inside a valid project route', () => {
    render(<ProjectReportRoutes initialEntry={`/projects/${projectId}/reports`} />)
    expect(screen.getAllByRole('heading', { name: 'گزارش‌ها' }).length).toBeGreaterThan(0)
  })

  it.each([
    ['burndown', 'نمودار Burndown'],
    ['velocity', 'Velocity'],
    ['cumulative', 'Cumulative Flow'],
    ['control', 'نمودار کنترل'],
    ['created', 'ایجاد شده vs حل شده'],
  ])('renders %s directly in the report detail route', (type, title) => {
    render(<ProjectReportRoutes initialEntry={`/projects/${projectId}/reports/${type}`} />)
    expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0)
  })

  it.each([
    ['burndown', 'line'],
    ['velocity', 'grouped-bar'],
    ['cumulative', 'stacked-area'],
    ['control', 'scatter'],
    ['created', 'line'],
  ])('%s mounts its own chart structure', (type, chartType) => {
    render(<ProjectReportRoutes initialEntry={`/projects/${projectId}/reports/${type}`} />)
    expect(screen.getByTestId('report-chart').getAttribute('data-chart-type')).toBe(chartType)
  })

  it.each([
    ['Burndown', 'burndown', 'نمودار Burndown', 'کار باقی‌مانده در طول اسپرینت'],
    ['Velocity', 'velocity', 'Velocity', 'Velocity اسپرینت‌ها'],
    ['جریان تجمعی', 'cumulative', 'Cumulative Flow', 'جریان تجمعی وضعیت‌ها'],
    ['نمودار کنترل', 'control', 'نمودار کنترل', 'Cycle Time هر وظیفه'],
    ['ایجادشده در برابر حل‌شده', 'created', 'ایجاد شده vs حل شده', 'روند ایجاد و حل وظایف'],
  ])('renders %s in the main Reports pane after navigation', (label, type, title, chartTitle) => {
    render(<ProjectReportRoutes initialEntry={`/projects/${projectId}/reports`} />)
    fireEvent.click(screen.getByRole('link', { name: label }))
    expect(screen.getByTestId('project-route').textContent).toBe(`/projects/${projectId}/reports/${type}`)
    expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: chartTitle }).length).toBeGreaterThan(0)
  })

  it('derives the selected report item from the current detail URL', () => {
    render(<ProjectReportRoutes initialEntry={`/projects/${projectId}/reports/velocity`} />)
    expect(screen.getByRole('link', { name: 'Velocity' }).className).toContain('active')
    expect(screen.getByRole('link', { name: 'Burndown' }).className).not.toContain('active')
    expect(screen.getByRole('link', { name: 'Velocity' }).className).not.toContain('primary')
    expect(document.querySelectorAll('.reports-navigation-item.active').length).toBe(1)
  })

  it('returns unknown report types to the Reports landing safely', () => {
    render(<ProjectReportRoutes initialEntry={`/projects/${projectId}/reports/unknown`} />)
    expect(screen.getAllByRole('heading', { name: 'گزارش‌ها' }).length).toBeGreaterThan(0)
  })

  it('keeps an invalid project safely guarded', () => {
    render(<ProjectReportRoutes initialEntry="/projects/missing/reports" />)
    expect(screen.getByText('پروژه پیدا نشد')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'گزارش‌ها' })).toBeNull()
  })

  it('keeps saved reports disabled without a supporting entity model', () => {
    render(<MemoryRouter initialEntries={[`/projects/${projectId}/reports`]}><ReportsMenuHarness /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'گزارش‌های ذخیره‌شده' }).hasAttribute('disabled')).toBe(true)
  })

  it.each([
    ['Burndown', 'burndown', 'نمودار Burndown'],
    ['Velocity', 'velocity', 'Velocity'],
    ['جریان تجمعی', 'cumulative', 'Cumulative Flow'],
    ['نمودار کنترل', 'control', 'نمودار کنترل'],
    ['ایجادشده در برابر حل‌شده', 'created', 'ایجاد شده vs حل شده'],
  ])('opens a project selector from /projects, then renders %s after selection', (label, type, title) => {
    render(<ReportsDrawerApp initialEntry="/projects" />)
    fireEvent.click(screen.getByRole('button', { name: 'گزارش‌ها' }))
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getByTestId('project-route').textContent).toBe('/projects')
    expect(screen.getByRole('heading', { name: 'پروژهٔ گزارش را انتخاب کنید' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /بازطراحی وب‌سایت/ }))
    expect(screen.getByTestId('project-route').textContent).toBe(`/projects/${projectId}/reports/${type}`)
    expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0)
  })

  it('navigates directly from a project route without opening the project selector', () => {
    render(<ReportsDrawerApp initialEntry={`/projects/${projectId}/board`} projectScoped />)
    fireEvent.click(screen.getByRole('button', { name: 'گزارش‌ها' }))
    fireEvent.click(screen.getByRole('button', { name: 'Velocity' }))
    expect(screen.getByTestId('project-route').textContent).toBe(`/projects/${projectId}/reports/velocity`)
    expect(screen.queryByRole('heading', { name: 'پروژهٔ گزارش را انتخاب کنید' })).toBeNull()
    expect(screen.getAllByRole('heading', { name: 'Velocity' }).length).toBeGreaterThan(0)
  })

  it.each([
    ['بک‌لاگ', 'آیتم‌های بک‌لاگ', 'پروژهٔ بک‌لاگ را انتخاب کنید', 'backlog'],
    ['بک‌لاگ', 'برد پروژه', 'پروژهٔ برد را انتخاب کنید', 'board'],
    ['بک‌لاگ', 'تایم‌لاین', 'پروژهٔ تایم‌لاین را انتخاب کنید', 'timeline'],
    ['وظایف من', 'محول‌شده به من', 'پروژهٔ وظایف را انتخاب کنید', 'tasks'],
    ['اسپرینت فعال', 'وظایف اسپرینت', 'پروژهٔ وظایف را انتخاب کنید', 'tasks'],
    ['اسپرینت فعال', 'گزارش اسپرینت', 'پروژهٔ گزارش را انتخاب کنید', 'reports'],
    ['تنظیمات', 'تنظیمات پروژه', 'پروژهٔ تنظیمات را انتخاب کنید', 'settings'],
    ['تنظیمات', 'تأییدها', 'پروژهٔ تأییدها را انتخاب کنید', 'approvals'],
  ])('continues the %s drawer action after selecting a project from /projects', (module, action, selectorTitle, destination) => {
    render(<ReportsDrawerApp initialEntry="/projects" />)
    fireEvent.click(screen.getByRole('button', { name: module }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action) }))
    expect(screen.getByRole('heading', { name: selectorTitle })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /بازطراحی وب‌سایت/ }))
    expect(screen.getByTestId('project-route').textContent).toBe(`/projects/${projectId}/${destination}`)
  })

  it('opens the actual active sprint board without choosing an unrelated project', () => {
    render(<ReportsDrawerApp initialEntry="/projects" />)
    fireEvent.click(screen.getByRole('button', { name: 'اسپرینت فعال' }))
    fireEvent.click(screen.getByRole('button', { name: /اسپرینت 4 - بخش کاربری/ }))
    expect(screen.getByTestId('project-route').textContent).toBe(`/projects/${projectId}/board`)
    expect(screen.queryByRole('heading', { name: /پروژه.*انتخاب کنید/ })).toBeNull()
  })

  it('does not navigate when the project selector is cancelled', () => {
    render(<ReportsDrawerApp initialEntry="/projects" />)
    fireEvent.click(screen.getByRole('button', { name: 'بک‌لاگ' }))
    fireEvent.click(screen.getByRole('button', { name: /آیتم‌های بک‌لاگ/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('project-route').textContent).toBe('/projects')
  })
})
