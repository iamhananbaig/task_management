import type { Priority, StatusType, TransitionActor } from "@/lib/types"

export const priorityLabels: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export const priorities: Priority[] = ["urgent", "high", "medium", "low"]

export const statusTypeLabels: Record<StatusType, string> = {
  open: "Not started",
  active: "In progress",
  review: "In review",
  done: "Done",
}

export const actorLabels: Record<TransitionActor, string> = {
  assignee: "Assignee",
  reviewer: "Reviewer",
  creator: "Creator",
  project_manager: "Project manager",
  any_editor: "Anyone who can edit",
}

/** Colours offered for statuses and projects (keys of `swatches`). */
export const colorNames = ["gray", "blue", "sky", "green", "amber", "orange", "red", "purple", "pink"] as const

/** Theme-aware colour classes: a soft badge and a solid dot, readable in light and dark mode. */
export const swatches: Record<string, { badge: string; dot: string }> = {
  gray: { badge: "bg-muted text-muted-foreground", dot: "bg-zinc-400" },
  blue: { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  sky: { badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  green: { badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  amber: { badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  orange: { badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  red: { badge: "bg-destructive/10 text-destructive dark:bg-destructive/20", dot: "bg-red-500" },
  purple: { badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  pink: { badge: "bg-pink-500/15 text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
}

export const swatch = (color: string | null | undefined) => swatches[color ?? "gray"] ?? swatches.gray
