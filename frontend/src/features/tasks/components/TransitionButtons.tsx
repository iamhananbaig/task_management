import * as React from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { MoveDialog } from "@/features/tasks/components/MoveDialog"
import { useMoveTask } from "@/features/tasks/lib/use-move"
import type { AvailableTransition, Task } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Words that mark a move as going backwards, shown as a secondary button. */
const BACKWARD = /back|reopen|reject|return/i

/** The workflow moves the signed-in user may make on this task, as buttons. */
export function TransitionButtons({ task, className }: { task: Task; className?: string }) {
  const [asking, setAsking] = React.useState<AvailableTransition | null>(null)
  const move = useMoveTask()
  const transitions = task.available_transitions ?? []

  if (transitions.length === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>No moves available to you at this step.</p>
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {transitions.map((transition) => (
        <Button
          key={transition.id}
          size="lg"
          variant={BACKWARD.test(transition.label) ? "outline" : "default"}
          disabled={move.isPending}
          onClick={() => (transition.requires_comment ? setAsking(transition) : move.mutate({ task, transition }))}
        >
          {move.isPending && move.variables?.transition.id === transition.id && <Spinner />}
          {transition.label}
        </Button>
      ))}
      {asking && <MoveDialog task={task} choices={[asking]} onClose={() => setAsking(null)} />}
    </div>
  )
}
