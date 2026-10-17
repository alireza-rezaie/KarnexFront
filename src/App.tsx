import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import Layout from './components/Layout'
import { ProjectGuard, ProjectProvider } from './contexts/ProjectContext'
import { TaskRouteGuard } from './components/TaskRouteGuard'
import { ProjectStatusProvider } from './contexts/ProjectStatusContext'
import { ProjectWorkflowProvider } from './contexts/ProjectWorkflowContext'
import { ProjectTaskProvider } from './contexts/ProjectTaskContext'
import { TasksProvider } from './contexts/TasksContext'
import { CurrentUserProvider } from './contexts/CurrentUserContext'
import { ProjectsProvider } from './contexts/ProjectsContext'
import { SprintsProvider } from './contexts/SprintsContext'
import { OrganizationProvider } from './contexts/OrganizationContext'
import { RolesProvider } from './contexts/RolesContext'
import { MembersProvider } from './contexts/MembersContext'
import { TeamsProvider } from './contexts/TeamsContext'
import { PlansProvider } from './contexts/PlansContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { ApprovalRequestsProvider } from './contexts/ApprovalRequestsContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { NotificationFeedProvider } from './contexts/NotificationFeedContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SecurityProvider } from './contexts/SecurityContext'
import { FilesProvider } from './contexts/FilesContext'
import { CalendarProvider } from './contexts/CalendarContext'
import { ReportsProvider } from './contexts/ReportsContext'
import { BillingProvider } from './contexts/BillingContext'
import { TaskCollaborationProvider } from './contexts/TaskCollaborationContext'
import { WorkflowCatalogProvider } from './contexts/WorkflowCatalogContext'
import { ProjectBoardProvider } from './contexts/ProjectBoardContext'
import { TaskTransitionProvider } from './contexts/TaskTransitionContext'
import { TerminalStatusPolicyProvider } from './contexts/TerminalStatusPolicyContext'
import LandingPage from './pages/LandingPage'
import PricingPage from './pages/PricingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OTPPage from './pages/OTPPage'
import OnboardingPage from './pages/OnboardingPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const ProjectOverviewPage = lazy(() => import('./pages/ProjectOverviewPage'))
const BacklogPage = lazy(() => import('./pages/BacklogPage'))
const BoardPage = lazy(() => import('./pages/BoardPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const AllTasksPage = lazy(() => import('./pages/AllTasksPage'))
const TaskDetailPage = lazy(() => import('./pages/TaskDetailPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const ReportsOverview = lazy(() => import('./pages/ReportsPage').then(({ ReportsOverview: Page }) => ({ default: Page })))
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const RolesPage = lazy(() => import('./pages/RolesPage'))
const FilesPage = lazy(() => import('./pages/FilesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ProjectSettingsPage = lazy(() => import('./pages/ProjectSettingsPage'))
const WorkflowPage = lazy(() => import('./pages/WorkflowPage'))
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'))
const PlansManagementPage = lazy(() => import('./pages/PlansManagementPage'))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'))
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'))

function RouteLoadingFallback() {
  return <main className="flex min-h-[16rem] items-center justify-center" dir="rtl" aria-live="polite"><p className="text-sm text-muted-foreground">در حال بارگذاری…</p></main>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
}

export function SystemAdminRoute({ children }: { children: ReactNode }) {
  const { isSystemAdmin } = useAuth()
  return isSystemAdmin ? children : <Navigate to="/dashboard" replace />
}

function AuthenticatedRoute() {
  const { authenticated } = useAuth()
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
    <SecurityProvider>
    <FilesProvider>
    <CalendarProvider>
    <ReportsProvider>
    <BillingProvider>
    <TaskCollaborationProvider>
    <MembersProvider>
      <TeamsProvider>
        <NotificationsProvider>
        <NotificationFeedProvider>
        <PlansProvider>
          <SubscriptionProvider>
          <OrganizationProvider>
          <ProjectsProvider>
          <RolesProvider>
            <SprintsProvider>
              <TasksProvider>
        <WorkflowCatalogProvider>
        <ProjectBoardProvider>
        <TerminalStatusPolicyProvider>
        <ApprovalRequestsProvider>
        <Routes>
      <Route element={<CurrentUserProvider><Layout /></CurrentUserProvider>}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/otp" element={<OTPPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      <Route element={<AuthenticatedRoute />}>
      <Route element={<CurrentUserProvider><Layout /></CurrentUserProvider>}>
        <Route path="/dashboard" element={<LazyRoute><DashboardPage /></LazyRoute>} />
        <Route path="/projects" element={<LazyRoute><ProjectsPage /></LazyRoute>} />
        <Route path="/tasks" element={<LazyRoute><AllTasksPage /></LazyRoute>} />
        <Route path="/calendar" element={<LazyRoute><CalendarPage /></LazyRoute>} />
        <Route path="/members" element={<LazyRoute><MembersPage /></LazyRoute>} />
        <Route path="/roles" element={<LazyRoute><RolesPage /></LazyRoute>} />
        <Route path="/files" element={<LazyRoute><FilesPage /></LazyRoute>} />
        <Route path="/settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
        <Route path="/subscription" element={<LazyRoute><SubscriptionPage /></LazyRoute>} />
        <Route path="/admin/users" element={<SystemAdminRoute><LazyRoute><UserManagementPage /></LazyRoute></SystemAdminRoute>} />
        <Route path="/admin/plans" element={<SystemAdminRoute><LazyRoute><PlansManagementPage /></LazyRoute></SystemAdminRoute>} />
      </Route>

      <Route path="/projects/:projectId" element={<CurrentUserProvider><ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><TaskTransitionProvider><Layout /></TaskTransitionProvider></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider></CurrentUserProvider>}>
        <Route element={<ProjectGuard><Outlet /></ProjectGuard>}>
          <Route path="overview" element={<LazyRoute><ProjectOverviewPage /></LazyRoute>} />
          <Route path="backlog" element={<LazyRoute><BacklogPage /></LazyRoute>} />
          <Route path="board" element={<LazyRoute><BoardPage /></LazyRoute>} />
          <Route path="tasks" element={<LazyRoute><TasksPage /></LazyRoute>} />
          <Route path="tasks/:taskId" element={<TaskRouteGuard><LazyRoute><TaskDetailPage /></LazyRoute></TaskRouteGuard>} />
          <Route path="timeline" element={<LazyRoute><TimelinePage /></LazyRoute>} />
          <Route path="reports" element={<LazyRoute><ReportsPage /></LazyRoute>}>
            <Route index element={<LazyRoute><ReportsOverview /></LazyRoute>} />
            <Route path=":type" element={<LazyRoute><ReportDetailPage /></LazyRoute>} />
          </Route>
          <Route path="settings" element={<LazyRoute><ProjectSettingsPage /></LazyRoute>} />
          <Route path="roles" element={<LazyRoute><RolesPage /></LazyRoute>} />
          <Route path="workflow" element={<LazyRoute><WorkflowPage /></LazyRoute>} />
          <Route path="approvals" element={<LazyRoute><ApprovalsPage /></LazyRoute>} />
        </Route>
      </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ApprovalRequestsProvider>
        </TerminalStatusPolicyProvider>
        </ProjectBoardProvider>
        </WorkflowCatalogProvider>
              </TasksProvider>
            </SprintsProvider>
          </RolesProvider>
          </ProjectsProvider>
          </OrganizationProvider>
          </SubscriptionProvider>
        </PlansProvider>
        </NotificationFeedProvider>
        </NotificationsProvider>
      </TeamsProvider>
    </MembersProvider>
    </TaskCollaborationProvider>
    </BillingProvider>
    </ReportsProvider>
    </CalendarProvider>
    </FilesProvider>
    </SecurityProvider>
    </AuthProvider>
  )
}
