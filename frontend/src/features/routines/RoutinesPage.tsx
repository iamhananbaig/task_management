import { useMutation } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { PlayIcon, PlusIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { tones } from "@/components/app/tones"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { frequencyLabels } from "@/lib/labels"
import { useProject, useRoutines } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Routine, Run } from "@/lib/types"
import { cn, formatDate } from "@/lib/utils"

/** A project's routines: recurring tasks and period close checklists. */
export default function RoutinesPage() {
  const { id } = useParams()
  const project = useProject(id)
  const routines = useRoutines(project.data?.id)
  const canManage = !!project.data?.can?.manage

  if (project.isLoading) return <Loading />
  if (!project.data) return <ErrorAlert error={project.error} />
  const p = project.data

  return (
    <>
      <PageHeader
        title={`${p.name} · Routines`}
        description="Work that repeats every period. Each routine creates its tasks automatically before the period ends — one task, or a whole close checklist."
        back={{ to: `/projects/${p.id}`, label: p.name }}
      >
        {canManage && (
          <Button render={<Link to={`/projects/${p.id}/routines/new`} />}>
            <PlusIcon /> New routine
          </Button>
        )}
      </PageHeader>
      <ErrorAlert error={routines.error} />
      {routines.isLoading && <Loading />}
      {routines.data?.length === 0 && (
        <EmptyState
          title="No routines yet"
          description="For example a monthly close with bank reconciliations, accruals and tax returns, or a quarterly advance-tax payment."
          action={canManage ? <Button render={<Link to={`/projects/${p.id}/routines/new`} />}><PlusIcon /> New routine</Button> : undefined}
        />
      )}
      <ul className="flex flex-col divide-y rounded-lg border empty:hidden">
        {routines.data?.map((routine) => <RoutineRow key={routine.id} routine={routine} canManage={canManage} />)}
      </ul>
    </>
  )
}

function RoutineRow({ routine, canManage }: { routine: Routine; canManage: boolean }) {
  const start = useMutation({
    mutationFn: async () => (await api.post<{ data: Run }>(`/routines/${routine.id}/start`)).data.data,
    onSuccess: (run) => toast.success("Run started", `${run.name}: ${run.progress.total} task(s) created`),
  })
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/projects/${routine.project_id}/routines/${routine.id}`} className="font-medium hover:underline">
          {routine.name}
        </Link>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>{frequencyLabels[routine.frequency]}</span>
          <span>{routine.items_count} task(s)</span>
          {routine.is_active ? (
            <span>
              Next: {routine.next_period_name}, created {formatDate(routine.next_run_on)}
            </span>
          ) : (
            <span className={cn("rounded px-1", tones.muted)}>Paused</span>
          )}
          {routine.last_run && (
            <Link to={`/runs/${routine.last_run.id}`} className="hover:text-foreground hover:underline">
              Last: {routine.last_run.name}
            </Link>
          )}
        </div>
      </div>
      {canManage && routine.is_active && (
        <Button variant="outline" onClick={() => start.mutate()} disabled={start.isPending} title={`Create the ${routine.next_period_name} tasks now`}>
          <PlayIcon /> Start {routine.next_period_name} now
        </Button>
      )}
    </li>
  )
}
