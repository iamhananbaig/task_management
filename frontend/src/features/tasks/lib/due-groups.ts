import type { Task } from "@/lib/types"
import { daysFromToday } from "@/lib/utils"

export type DueGroupKey = "overdue" | "today" | "week" | "later" | "none" | "done"

export const dueGroupLabels: Record<DueGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "Next 7 days",
  later: "Later",
  none: "No due date",
  done: "Completed",
}

const ORDER: DueGroupKey[] = ["overdue", "today", "week", "later", "none", "done"]

export function dueGroupOf(task: Task): DueGroupKey {
  if (task.status?.type === "done") return "done"
  if (!task.due_date) return "none"
  const days = daysFromToday(task.due_date)
  if (days < 0) return "overdue"
  if (days === 0) return "today"
  if (days <= 7) return "week"
  return "later"
}

/** Tasks in due-date groups (overdue first), each sorted by due date then priority. Empty groups are left out. */
export function groupByDue(tasks: Task[]): { key: DueGroupKey; label: string; tasks: Task[] }[] {
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as const
  const sorted = [...tasks].sort(
    (a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || rank[a.priority] - rank[b.priority] || a.id - b.id,
  )
  return ORDER.map((key) => ({ key, label: dueGroupLabels[key], tasks: sorted.filter((task) => dueGroupOf(task) === key) })).filter(
    (group) => group.tasks.length > 0,
  )
}
