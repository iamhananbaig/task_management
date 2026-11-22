import { Link } from "react-router-dom"

import type { AuditEntry } from "@/lib/types"
import { timeAgo } from "@/lib/utils"

/** Recent changes, one block per task: a task's back-to-back changes are shown together. */
export function ActivityFeed({ entries, limit = 12 }: { entries: AuditEntry[]; limit?: number }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>

  const groups: { taskId: number | null; label: string | null; items: AuditEntry[] }[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.taskId === entry.task_id) last.items.push(entry)
    else groups.push({ taskId: entry.task_id, label: entry.subject_label, items: [entry] })
  }

  return (
    <ol className="flex flex-col divide-y rounded-lg border">
      {groups.slice(0, limit).map((group) => (
        <li key={group.items[0].id} className="px-3 py-2 text-sm">
          <Link to={`?task=${group.taskId}`} className="block truncate font-medium hover:underline">
            {group.label}
          </Link>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {group.items.slice(0, 3).map((entry) => (
              <li key={entry.id} className="text-xs text-muted-foreground">
                {entry.user_name ?? "System"} · {entry.summary} · {timeAgo(entry.created_at)}
              </li>
            ))}
            {group.items.length > 3 && <li className="text-xs text-muted-foreground">and {group.items.length - 3} more</li>}
          </ul>
        </li>
      ))}
    </ol>
  )
}
