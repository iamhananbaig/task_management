import { Stat } from "@/components/app/shared"
import { TaskRows } from "@/features/tasks/components/TaskRows"
import type { Dashboard } from "@/lib/queries"
import { cn, initials } from "@/lib/utils"

/** A manager's view: totals, open work by person (most overdue first) and the review queue. */
export function TeamPanel({ team }: { team: NonNullable<Dashboard["team"]> }) {
  const busiest = Math.max(1, ...team.people.map((person) => person.open))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">My team</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Open tasks" value={team.counts.open} />
        <Stat label="Overdue" value={team.counts.overdue} tone={team.counts.overdue ? "danger" : undefined} />
        <Stat label="In review" value={team.counts.in_review} tone={team.counts.in_review ? "warning" : undefined} />
        <Stat label="Unassigned" value={team.counts.unassigned} tone={team.counts.unassigned ? "warning" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Open work by person</h3>
          {team.people.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No open tasks are assigned.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {team.people.map((person) => (
                <li key={person.user.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium">
                    {initials(person.user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{person.user.name}</div>
                    {/* Bar: share of the busiest person's load; red part = overdue */}
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="bg-destructive" style={{ width: `${(person.overdue / busiest) * 100}%` }} />
                      <div className="bg-primary/60" style={{ width: `${((person.open - person.overdue) / busiest) * 100}%` }} />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-3 text-xs tabular-nums">
                    <span title="Open">{person.open} open</span>
                    <span className={cn("w-16", person.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{person.overdue} overdue</span>
                    <span className="hidden w-16 text-muted-foreground sm:inline">{person.in_review} in review</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Waiting longest for review</h3>
          <TaskRows tasks={team.waiting_review} grouped={false} showAssignee emptyTitle="Nothing in review" emptyMessage="Submitted tasks show up here." />
        </div>
      </div>
    </section>
  )
}
