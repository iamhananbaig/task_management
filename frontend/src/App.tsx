import { lazy, Suspense } from "react"
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom"

import { AppLayout } from "@/components/app/app-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import LoginPage from "@/features/auth/pages/LoginPage"
import { apiErrorMessage } from "@/lib/api"
import { httpStatus } from "@/lib/errors"
import { useAuth } from "@/lib/auth"
import { AuthProvider } from "@/lib/auth-provider"
import { toast } from "@/lib/toast"

// Pages load on demand (one small file per screen)
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"))
const MyTasksPage = lazy(() => import("@/features/tasks/pages/MyTasksPage"))
const TaskPage = lazy(() => import("@/features/tasks/pages/TaskPage"))
const BinPage = lazy(() => import("@/features/tasks/pages/BinPage"))
const ProjectsPage = lazy(() => import("@/features/projects/pages/ProjectsPage"))
const ProjectPage = lazy(() => import("@/features/projects/pages/ProjectPage"))
const ProjectSettingsPage = lazy(() => import("@/features/projects/pages/ProjectSettingsPage"))
const NotificationsPage = lazy(() => import("@/features/notifications/NotificationsPage"))
const UsersPage = lazy(() => import("@/features/admin/pages/UsersPage"))
const RolesPage = lazy(() => import("@/features/admin/pages/RolesPage"))
const WorkflowTemplatesPage = lazy(() => import("@/features/admin/pages/WorkflowTemplatesPage"))
const RoutinesPage = lazy(() => import("@/features/routines/RoutinesPage"))
const RoutineEditorPage = lazy(() => import("@/features/routines/RoutineEditorPage"))
const RunPage = lazy(() => import("@/features/routines/RunPage"))
const TagsPage = lazy(() => import("@/features/admin/pages/TagsPage"))
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"))
const AuditLogPage = lazy(() => import("@/features/admin/pages/AuditLogPage"))

// Every successful change marks all cached data stale; failed changes without their own
// handler show the server's message (e.g. "Only the reviewer can …").
const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // No access / not found won't change on retry: show the message at once
      retry: (count, error) => {
        const status = httpStatus(error)
        return (status === undefined || status >= 500) && count < 2
      },
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (): Promise<void> => queryClient.invalidateQueries(),
    onError: (error: unknown, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return
      toast.error(apiErrorMessage(error))
      // A refused move may mean the task changed meanwhile: reload what is shown
      void queryClient.invalidateQueries()
    },
  }),
})

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
          <Route path="/projects/:id/routines" element={<RoutinesPage />} />
          <Route path="/projects/:id/routines/:routineId" element={<RoutineEditorPage />} />
          <Route path="/runs/:id" element={<RunPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/bin" element={<BinPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/workflow-templates" element={<WorkflowTemplatesPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster>
              <Router>
                <AppRoutes />
              </Router>
            </Toaster>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
