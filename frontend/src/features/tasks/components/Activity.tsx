import { Loading } from "@/components/app/shared"
import { useActivity } from "@/lib/queries"
import type { AuditEntry } from "@/lib/types"
import { timeAgo } from "@/lib/utils"

const fieldLabels: Record<string, string> = {
  assignee_id: "assignee",
  reviewer_id: "reviewer",
  due_date: "due date",
  start_date: "start date",
}

/** The task's history from the audit trail, newest first. */
export function Activity({ taskId }: { taskId: number }) {
  const activity = useActivity(taskId)
  if (activity.isLoading) return <Loading />
  if (!activity.data?.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>

  return (
    <ol className="relative flex flex-col gap-3 border-l pl-4">
      {activity.data.map((entry) => (
        <li key={entry.id} className="text-sm">
          <span className="absolute -left-[4.5px] mt-1.5 size-2 rounded-full bg-border" aria-hidden="true" />
          <div>
            <span className="font-medium">{entry.user_name ?? "System"}</span> <span className="text-muted-foreground">· {timeAgo(entry.created_at)}</span>
          </div>
          <div className="text-muted-foreground">{describe(entry)}</div>
        </li>
      ))}
    </ol>
  )
}

function describe(entry: AuditEntry): string {
  if (entry.action === "created") return "Created the task"
  if (entry.action === "updated" && entry.changes) {
    return Object.entries(entry.changes)
      .map(([field, [from, to]]) => {
        const label = fieldLabels[field] ?? field.replace(/_/g, " ")
        // ids are shown as "changed" (names are in the task itself)
        if (field.endsWith("_id")) return `Changed the ${label}`
        if (field === "description") return "Edited the description"
        return `${label}: ${show(from)} → ${show(to)}`
      })
      .join(" · ")
  }
  return entry.summary
}

const show = (value: unknown) => (value === null || value === undefined || value === "" ? "none" : String(value))
