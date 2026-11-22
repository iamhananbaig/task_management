import { Link, useParams } from "react-router-dom"

import { PageHeader } from "@/components/app/app-layout"
import { ErrorAlert, Loading, Stat } from "@/components/app/shared"
import { Progress } from "@/components/ui/progress"
import { TaskList } from "@/features/projects/components/TaskList"
import { TaskSheet } from "@/features/tasks/components/TaskSheet"
import { useRun, useTasks } from "@/lib/queries"
import { formatDate } from "@/lib/utils"

/** One period of a routine: progress and its tasks. */
export default function RunPage() {
  const { id } = useParams()
  const run = useRun(id)
  const tasks = useTasks({ routine_run_id: Number(id), per_page: 200, sort: "due_date" })

  if (run.isLoading) return <Loading />
  if (!run.data) return <ErrorAlert error={run.error} />
  const r = run.data
  const { total, done, review, overdue, on_time } = r.progress

  return (
    <>
      <PageHeader
        title={r.name}
        description={
          <>
            {r.project?.name} · period {formatDate(r.period_start)} – {formatDate(r.period_end)} ·{" "}
            <Link to={`/projects/${r.project_id}/routines/${r.routine_id}`} className="hover:underline">
              routine
            </Link>
          </>
        }
        back={{ to: `/projects/${r.project_id}/routines`, label: "Routines" }}
      />
      <Progress value={total ? (done / total) * 100 : 0} className="mb-3" aria-label="Done" />
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Tasks" value={total} />
        <Stat label="Done" value={`${done} / ${total}`} />
        <Stat label="In review" value={review} tone={review ? "warning" : undefined} />
        <Stat label="Overdue" value={overdue} tone={overdue ? "danger" : undefined} />
        <Stat label="Done on time" value={done ? `${Math.round((on_time / done) * 100)}%` : "—"} />
      </div>
      <ErrorAlert error={tasks.error} />
      {tasks.isLoading ? <Loading /> : <TaskList tasks={tasks.data?.data ?? []} />}
      <TaskSheet />
    </>
  )
}
