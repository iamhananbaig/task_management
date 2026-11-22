import type { AvailableTransition, Task } from "@/lib/types"

/** Files on the task (detail has the list, list rows only the count). */
export function fileCount(task: Task): number {
  return task.attachments?.length ?? task.attachments_count ?? 0
}

/** Checklist items not yet ticked. */
export function openChecklistCount(task: Task): number {
  if (task.checklist) return task.checklist.filter((item) => !item.is_done).length
  return Math.max(0, (task.checklist_total ?? 0) - (task.checklist_done ?? 0))
}

/**
 * Whether a move should open the move dialog instead of happening at once: a required reason or
 * document, every hand-over for review (room for a note and evidence), and finishing with open
 * checklist items (so nobody completes a task by accident).
 */
export function needsMoveDialog(task: Task, transition: AvailableTransition): boolean {
  if (transition.requires_comment) return true
  if (transition.requires_attachment && fileCount(task) === 0) return true
  if (transition.to_type === "review") return true
  if (transition.to_type === "done" && openChecklistCount(task) > 0) return true
  return false
}
