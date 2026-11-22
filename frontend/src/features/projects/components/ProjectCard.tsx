import { Link } from "react-router-dom"
import { UsersIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { Progress } from "@/components/ui/progress"
import { ColorDot } from "@/features/tasks/components/badges"
import type { Project } from "@/lib/types"

/** Project tile: name, key, overdue count, progress and members. */
export function ProjectCard({ project }: { project: Project }) {
  const open = project.open_tasks_count ?? 0
  const done = project.done_tasks_count ?? 0
  const total = open + done
  return (
    <Link to={`/projects/${project.id}`} className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-ring/60">
      <div className="flex items-start gap-2">
        <ColorDot color={project.color} className="mt-1.5 size-2.5" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{project.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{project.key}</div>
        </div>
        {!!project.overdue_tasks_count && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
            <WarningCircleIcon className="size-3.5" /> {project.overdue_tasks_count} overdue
          </span>
        )}
      </div>
      {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
      <div className="mt-auto flex flex-col gap-1.5">
        <Progress value={total ? (done / total) * 100 : 0} aria-label="Completed" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {done} of {total} done
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" /> {project.members_count ?? 0}
          </span>
        </div>
      </div>
    </Link>
  )
}
