import { Link } from "react-router-dom"

import { Progress } from "@/components/ui/progress"
import { ColorDot } from "@/features/tasks/components/badges"
import type { Run } from "@/lib/types"
import { cn, formatDate } from "@/lib/utils"

/** A run (period) as a row: name, done / total bar, review and overdue counts. */
export function RunRow({ run, showProject }: { run: Run; showProject?: boolean }) {
  const { total, done, review, overdue } = run.progress
  return (
    <Link to={`/runs/${run.id}`} className="flex flex-col gap-1.5 px-3 py-2.5 hover:bg-muted/50">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {showProject && run.project && <ColorDot color={run.project.color} />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{run.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{total} done
        </span>
      </div>
      <Progress value={total ? (done / total) * 100 : 0} aria-label={`${run.name}: ${done} of ${total} done`} />
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {showProject && run.project && <span>{run.project.name}</span>}
        <span>Period end {formatDate(run.period_end)}</span>
        {review > 0 && <span className="text-amber-700 dark:text-amber-400">{review} in review</span>}
        <span className={cn(overdue > 0 && "font-medium text-destructive")}>{overdue} overdue</span>
      </div>
    </Link>
  )
}
