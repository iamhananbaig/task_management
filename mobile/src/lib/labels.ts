// Same labels as frontend/src/lib/labels.ts (keep in step). Colours: lib/theme.ts.

import type { DueRule, Frequency, Priority, StatusType, TransitionActor } from "@/lib/types"

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

export const frequencyLabels: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly (fiscal year)",
}

export const dueRuleLabels: Record<DueRule, string> = {
  days_after_end: "days after period end",
  day_of_next_month: "of the month after period end",
  days_before_end: "days before period end",
}

/** "3 days after period end", "18th of the month after period end". */
export function describeDueRule(rule: DueRule, value: number): string {
  if (rule === "day_of_next_month") {
    const suffix = value % 10 === 1 && value !== 11 ? "st" : value % 10 === 2 && value !== 12 ? "nd" : value % 10 === 3 && value !== 13 ? "rd" : "th"
    return `${value}${suffix} ${dueRuleLabels[rule]}`
  }
  if (rule === "days_after_end" && value === 0) return "On the last day of the period"
  return `${value} ${value === 1 ? dueRuleLabels[rule].replace("days", "day") : dueRuleLabels[rule]}`
}
