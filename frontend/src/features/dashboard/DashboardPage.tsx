import { Link } from "react-router-dom"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading, Stat } from "@/components/app/shared"
import { ActivityFeed } from "@/features/dashboard/ActivityFeed"
import { TeamPanel } from "@/features/dashboard/TeamPanel"
import { ProjectCard } from "@/features/projects/components/ProjectCard"
import { RunRow } from "@/features/routines/RunProgress"
import { TaskRows } from "@/features/tasks/components/TaskRows"
import { TaskSheet } from "@/features/tasks/components/TaskSheet"
import { useAuth } from "@/lib/auth"
import { useDashboard, useRecentRuns, useTasks } from "@/lib/queries"

/**
 * "My work" for everyone; managers also see their team (work by person, what waits for review).
 * A manager with nothing assigned sees the team first instead of a row of zeros.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const dashboard = useDashboard()
  const runs = useRecentRuns()
  const dueSoon = useTasks({ assignee: "me", due: "week", sort: "due_date", per_page: 10 })
  const overdue = useTasks({ assignee: "me", due: "overdue", sort: "due_date", per_page: 10 })

  if (dashboard.isLoading) return <Loading />
  if (!dashboard.data) return <ErrorAlert error={dashboard.error} />
  const { counts, projects, activity, team } = dashboard.data
  const urgent = [...(overdue.data?.data ?? []), ...(dueSoon.data?.data ?? [])]
  const hasOwnWork = counts.open > 0 || counts.to_review > 0 || counts.completed_this_week > 0

  const myWork = (
    <section>
      <h2 className="mb-2 text-sm font-semibold">My work</h2>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatLink to="/my-tasks" label="Open tasks" value={counts.open} />
        <StatLink to="/my-tasks?due=overdue" label="Overdue" value={counts.overdue} tone={counts.overdue ? "danger" : undefined} />
        <StatLink to="/my-tasks?due=today" label="Due today" value={counts.due_today} tone={counts.due_today ? "warning" : undefined} />
        <StatLink to="/my-tasks?due=week" label="Due in 7 days" value={counts.due_this_week} />
        <StatLink to="/my-tasks?tab=review" label="Waiting for my review" value={counts.to_review} tone={counts.to_review ? "warning" : undefined} />
        <Stat label="Completed this week" value={counts.completed_this_week} />
      </div>
      {urgent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing of yours is overdue or due in the next 7 days.</p>
      ) : (
        <TaskRows tasks={urgent} />
      )}
    </section>
  )

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name?.split(" ")[0] ?? ""}`}
        description={team ? "Your work and your team's, across every project." : "Your tasks across every project."}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {(hasOwnWork || !team) && myWork}
          {team && <TeamPanel team={team} />}

          <section>
            <h2 className="mb-2 text-sm font-semibold">Projects</h2>
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
        </div>

        <aside className="flex flex-col gap-6">
          {(runs.data?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Periods</h2>
              <div className="flex flex-col divide-y rounded-lg border">
                {runs.data?.slice(0, 6).map((run) => (
                  <RunRow key={run.id} run={run} showProject />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
            <ActivityFeed entries={activity} />
          </section>
        </aside>
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
