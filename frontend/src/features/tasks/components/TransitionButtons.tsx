import * as React from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { MoveDialog } from "@/features/tasks/components/MoveDialog"
import { needsMoveDialog } from "@/features/tasks/lib/move-rules"
import { useMoveTask } from "@/features/tasks/lib/use-move"
import type { AvailableTransition, Task } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Words that mark a move as going backwards, shown as a secondary button. */
const BACKWARD = /back|reopen|reject|return/i

/**
 * The workflow moves the signed-in user may make on this task, as buttons. Simple moves happen at
 * once; moves that need a reason, a document or a hand-over note open the move dialog.
 */
export function TransitionButtons({
  task,
  size = "default",
  className,
  emptyText = "No moves available to you at this step.",
}: {
  task: Task
  size?: "sm" | "default" | "lg"
  className?: string
  emptyText?: string | null
}) {
  const [asking, setAsking] = React.useState<AvailableTransition | null>(null)
  const move = useMoveTask()
  const transitions = task.available_transitions ?? []

  if (transitions.length === 0) {
    return emptyText ? <p className={cn("text-xs text-muted-foreground", className)}>{emptyText}</p> : null
  }

  // Forward moves last, so the main action sits on the right like a dialog's confirm button
  const ordered = [...transitions].sort((a, b) => Number(!BACKWARD.test(a.label)) - Number(!BACKWARD.test(b.label)))

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ordered.map((transition) => (
        <Button
          key={transition.id}
          size={size}
          variant={BACKWARD.test(transition.label) ? "outline" : "default"}
          disabled={move.isPending}
          onClick={(event) => {
            event.stopPropagation()
            if (needsMoveDialog(task, transition)) setAsking(transition)
            else move.mutate({ task, transition })
          }}
        >
          {move.isPending && move.variables?.transition.id === transition.id && <Spinner />}
          {transition.label}
        </Button>
      ))}
      {asking && (
        // The dialog is portalled, but its events still bubble to React parents such as a clickable row
        <span className="contents" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <MoveDialog task={task} choices={[asking]} onClose={() => setAsking(null)} />
        </span>
      )}
    </div>
  )
}
