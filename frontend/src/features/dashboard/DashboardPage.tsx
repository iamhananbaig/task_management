import { Link } from "react-router-dom"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading, Stat } from "@/components/app/shared"
import { ProjectCard } from "@/features/projects/components/ProjectCard"
import { TaskList } from "@/features/projects/components/TaskList"
import { TaskSheet } from "@/features/tasks/components/TaskSheet"
import { useAuth } from "@/lib/auth"
import { useDashboard, useTasks } from "@/lib/queries"
import { timeAgo } from "@/lib/utils"

/** "My work": counts, what is due, projects and recent activity. */
export default function DashboardPage() {
  const { user } = useAuth()
  const dashboard = useDashboard()
  const dueSoon = useTasks({ assignee: "me", due: "week", sort: "due_date", per_page: 10 })
  const overdue = useTasks({ assignee: "me", due: "overdue", sort: "due_date", per_page: 10 })

  if (dashboard.isLoading) return <Loading />
  if (!dashboard.data) return <ErrorAlert error={dashboard.error} />
  const { counts, projects, activity } = dashboard.data
  const urgent = [...(overdue.data?.data ?? []), ...(dueSoon.data?.data ?? [])]

  return (
    <>
      <PageHeader title={`Hello, ${user?.name?.split(" ")[0] ?? ""}`} description="Your tasks across every project." />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatLink to="/my-tasks" label="Open tasks" value={counts.open} />
        <StatLink to="/my-tasks?due=overdue" label="Overdue" value={counts.overdue} tone={counts.overdue ? "danger" : undefined} />
        <StatLink to="/my-tasks?due=today" label="Due today" value={counts.due_today} tone={counts.due_today ? "warning" : undefined} />
        <StatLink to="/my-tasks?due=week" label="Due in 7 days" value={counts.due_this_week} />
        <StatLink to="/my-tasks?tab=review" label="Waiting for my review" value={counts.to_review} tone={counts.to_review ? "warning" : undefined} />
        <Stat label="Completed this week" value={counts.completed_this_week} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <section className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold">Overdue and due this week</h2>
          {urgent.length === 0 ? (
            <EmptyState title="Nothing due" description="No open tasks of yours are overdue or due in the next 7 days." />
          ) : (
            <TaskList tasks={urgent} />
          )}

          <h2 className="mt-6 mb-2 text-sm font-semibold">Projects</h2>
          {projects.length === 0 ? (
            <EmptyState title="No projects" description="Ask a manager to add you to a project." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ol className="flex flex-col divide-y rounded-lg border">
              {activity.map((entry) => (
                <li key={entry.id} className="px-3 py-2 text-sm">
                  <Link to={`?task=${entry.task_id}`} className="block hover:underline">
                    <span className="font-medium">{entry.subject_label}</span>
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {entry.user_name ?? "System"} · {entry.summary} · {timeAgo(entry.created_at)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <TaskSheet />
    </>
  )
}

function StatLink({ to, ...stat }: { to: string } & React.ComponentProps<typeof Stat>) {
  return (
    <Link to={to} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&>div]:hover:border-ring/60">
      <Stat {...stat} />
    </Link>
  )
}
