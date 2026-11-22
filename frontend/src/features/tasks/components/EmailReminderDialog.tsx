import * as React from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { Task } from "@/lib/types"

/** "Email reminder": emails the assignee (optionally the reviewer) now. Once per task per 10 minutes. */
export function EmailReminderDialog({ task, open, onOpenChange }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [note, setNote] = React.useState("")
  const [includeReviewer, setIncludeReviewer] = React.useState(false)
  const send = useMutation({
    mutationFn: async () =>
      (await api.post<{ message: string }>(`/tasks/${task.id}/email-reminder`, { note: note || null, include_reviewer: includeReviewer })).data,
    onSuccess: (data) => {
      toast.success("Reminder sent", data.message)
      setNote("")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email a reminder</DialogTitle>
          <DialogDescription>
            {task.assignee ? `Sends ${task.assignee.name} an email about ${task.reference} now.` : "This task has no assignee to remind."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="reminder-note">Note (optional)</FieldLabel>
          <Textarea id="reminder-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. The client needs this by Friday" />
        </Field>
        {task.reviewer && task.reviewer.id !== task.assignee?.id && (
          <div className="flex items-center gap-2">
            <Checkbox id="reminder-reviewer" checked={includeReviewer} onCheckedChange={(checked) => setIncludeReviewer(checked === true)} />
            <Label htmlFor="reminder-reviewer">Also email the reviewer ({task.reviewer.name})</Label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => send.mutate()} disabled={!task.assignee || send.isPending}>
            {send.isPending && <Spinner />} Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
