import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useMoveTask } from "@/features/tasks/lib/use-move"
import type { AvailableTransition, Task } from "@/lib/types"

/**
 * Confirms a workflow move. Shown when the move needs a comment (send back, reopen) or when a
 * drop on the board matches several moves; the comment is optional otherwise.
 */
export function MoveDialog({
  task,
  choices,
  onClose,
}: {
  task: Task
  /** The moves to choose from (usually one). */
  choices: AvailableTransition[]
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = React.useState(choices[0]?.id)
  const [comment, setComment] = React.useState("")
  const move = useMoveTask()
  const selected = choices.find((choice) => choice.id === selectedId) ?? choices[0]
  const needsComment = selected?.requires_comment

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || (needsComment && !comment.trim())) return
    move.mutate({ task, transition: selected, comment }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{choices.length > 1 ? "Choose the move" : selected?.label}</DialogTitle>
            <DialogDescription>
              {task.reference} · {task.title}
            </DialogDescription>
          </DialogHeader>

          {choices.length > 1 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Move">
              {choices.map((choice) => (
                <Button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={choice.id === selected?.id}
                  variant={choice.id === selected?.id ? "default" : "outline"}
                  onClick={() => setSelectedId(choice.id)}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="move-comment">{needsComment ? "Reason (required)" : "Comment (optional)"}</FieldLabel>
            <Textarea
              id="move-comment"
              autoFocus
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={needsComment ? "What needs to change?" : "Add a note for the team"}
              required={needsComment}
            />
            <FieldDescription>Saved as a comment on the task and shown in its activity.</FieldDescription>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={move.isPending || (needsComment && !comment.trim())}>
              {move.isPending && <Spinner />} {selected?.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
