import { ChatCircleIcon, CheckSquareIcon, PaperclipIcon } from "@phosphor-icons/react"

import { EmptyState } from "@/components/app/shared"
import { ColorDot, DueDate, PriorityMark, StatusBadge, UserAvatar } from "@/features/tasks/components/badges"
import { TagChips } from "@/features/tasks/components/TaskTags"
import { TransitionButtons } from "@/features/tasks/components/TransitionButtons"
import { groupByDue } from "@/features/tasks/lib/due-groups"
import { useOpenTask } from "@/features/tasks/lib/use-open-task"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Tasks as rows with their next move on the right, optionally in due-date groups (Overdue, Today,
 * Next 7 days…). Click a row to open the task; the move buttons act without opening it.
 */
export function TaskRows({
  tasks,
  grouped = true,
  showAssignee = false,
  emptyTitle = "Nothing here",
  emptyMessage,
}: {
  tasks: Task[]
  grouped?: boolean
  showAssignee?: boolean
  emptyTitle?: string
  emptyMessage?: string
}) {
  if (tasks.length === 0) return <EmptyState title={emptyTitle} description={emptyMessage} />

  const groups = grouped ? groupByDue(tasks) : [{ key: "all", label: "", tasks }]

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key}>
          {group.label && (
            <h2
              className={cn(
                "mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                group.key === "overdue" && "text-destructive",
              )}
            >
              {group.label} <span className="font-normal tabular-nums">{group.tasks.length}</span>
            </h2>
          )}
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} showAssignee={showAssignee} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function TaskRow({ task, showAssignee }: { task: Task; showAssignee: boolean }) {
  const openTask = useOpenTask()
  const done = task.status?.type === "done"

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={() => openTask(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) openTask(task.id)
      }}
      className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 outline-none hover:bg-muted/40 focus-visible:bg-muted/60 sm:flex-nowrap"
    >
      <PriorityMark priority={task.priority} className="shrink-0" />
      <div className="min-w-0 flex-1 basis-60">
        <div className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{task.reference}</span>
          <span className="inline-flex items-center gap-1">
            <ColorDot color={task.project.color} /> {task.project.name}
          </span>
          {!!task.checklist_total && (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <CheckSquareIcon /> {task.checklist_done ?? 0}/{task.checklist_total}
            </span>
          )}
          {!!task.attachments_count && (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <PaperclipIcon /> {task.attachments_count}
            </span>
          )}
          {!!task.comments_count && (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <ChatCircleIcon /> {task.comments_count}
            </span>
          )}
          <TagChips tags={task.tags} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={task.status} />
        <DueDate date={task.due_date} done={done} className="w-20" />
        {showAssignee && <UserAvatar user={task.assignee} />}
      </div>
      <TransitionButtons task={task} size="sm" emptyText={null} className="shrink-0 max-sm:w-full max-sm:justify-end" />
    </li>
  )
}
