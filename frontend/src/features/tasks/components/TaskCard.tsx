import { ChatCircleIcon, CheckSquareIcon, PaperclipIcon } from "@phosphor-icons/react"

import { DueDate, PriorityMark, UserAvatar } from "@/features/tasks/components/badges"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"

/** A task on the board: reference, title, priority, due date, counts and assignee. */
export function TaskCard({ task, onOpen, dragging, className }: { task: Task; onOpen?: () => void; dragging?: boolean; className?: string }) {
  const done = task.status?.type === "done"
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen?.()
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-2.5 text-sm shadow-xs outline-none hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/40",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("leading-snug font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
        <PriorityMark priority={task.priority} />
      </div>
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <span className="font-mono">{task.reference}</span>
        <DueDate date={task.due_date} done={done} />
        {!!task.checklist_total && (
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <CheckSquareIcon className="size-3.5" /> {task.checklist_done ?? 0}/{task.checklist_total}
          </span>
        )}
        {!!task.comments_count && (
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <ChatCircleIcon className="size-3.5" /> {task.comments_count}
          </span>
        )}
        {!!task.attachments_count && (
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <PaperclipIcon className="size-3.5" /> {task.attachments_count}
          </span>
        )}
        <span className="ml-auto">
          <UserAvatar user={task.assignee} />
        </span>
      </div>
    </div>
  )
}
