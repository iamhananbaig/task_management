import * as React from "react"
import { WarningIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { FileDrop, FileList } from "@/features/tasks/components/Attachments"
import { useTickChecklist } from "@/features/tasks/lib/use-checklist"
import { useMoveTask } from "@/features/tasks/lib/use-move"
import { useAuth } from "@/lib/auth"
import { useTask } from "@/lib/queries"
import type { AvailableTransition, Task } from "@/lib/types"

/**
 * One step for a workflow move: pick the move (when a board drop matches several), tick what's
 * left on the checklist, attach the evidence and leave a note — then move. Opened for moves that
 * need a reason or a document, hand-overs for review, and finishing with open checklist items.
 */
export function MoveDialog({
  task: listTask,
  choices,
  onClose,
}: {
  task: Task
  /** The moves to choose from (usually one). */
  choices: AvailableTransition[]
  onClose: () => void
}) {
  const { user } = useAuth()
  // List rows carry only counts: load the full task for its checklist and files
  const detail = useTask(listTask.id)
  const task = detail.data ?? listTask
  const [selectedId, setSelectedId] = React.useState(choices[0]?.id)
  const [comment, setComment] = React.useState("")
  const move = useMoveTask()
  const tick = useTickChecklist(task.id)

  const selected = choices.find((choice) => choice.id === selectedId) ?? choices[0]
  const needsComment = !!selected?.requires_comment
  const files = task.attachments ?? []
  const fileTotal = task.attachments?.length ?? task.attachments_count ?? 0
  const needsFile = !!selected?.requires_attachment && fileTotal === 0
  const handingOver = selected?.to_type === "review" || selected?.to_type === "done"
  const showFiles = !!selected?.requires_attachment || selected?.to_type === "review"
  const openItems = handingOver ? (task.checklist ?? []).filter((item) => !item.is_done) : []
  const canTick = !!task.can?.update || task.assignee?.id === user?.id
  const blocked = (needsComment && !comment.trim()) || needsFile

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || blocked) return
    move.mutate({ task, transition: selected, comment }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
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

          {openItems.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
                <WarningIcon weight="fill" /> {openItems.length} checklist {openItems.length === 1 ? "item is" : "items are"} not ticked
              </p>
              <ul className="flex flex-col gap-1.5">
                {openItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.is_done}
                      disabled={!canTick}
                      onCheckedChange={(checked) => tick.mutate({ id: item.id, is_done: checked === true })}
                      aria-label={item.title}
                    />
                    {item.title}
                  </li>
                ))}
              </ul>
              {canTick && <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Tick them here, or go ahead if they don't apply.</p>}
            </div>
          )}

          {showFiles && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">
                Supporting documents{" "}
                {selected?.requires_attachment ? (
                  <span className="font-normal text-muted-foreground">(required)</span>
                ) : (
                  <span className="font-normal text-muted-foreground">(optional)</span>
                )}
              </div>
              {files.length > 0 && <FileList task={task} files={files} />}
              {task.can?.comment && <FileDrop taskId={task.id} compact />}
              {needsFile && <p className="text-xs text-destructive">Attach at least one document to {selected?.label.toLowerCase()}.</p>}
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="move-comment">{needsComment ? "Reason (required)" : "Note (optional)"}</FieldLabel>
            <Textarea
              id="move-comment"
              autoFocus={needsComment}
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(event)
              }}
              placeholder={needsComment ? "What needs to change?" : "Anything the reviewer should know"}
              required={needsComment}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={move.isPending || blocked}>
              {move.isPending && <Spinner />} {selected?.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
