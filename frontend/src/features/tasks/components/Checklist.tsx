import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useTickChecklist } from "@/features/tasks/lib/use-checklist"
import { api, apiErrorMessage } from "@/lib/api"
import { toast } from "@/lib/toast"
import { useAuth } from "@/lib/auth"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Subtasks. Editors add / rename / remove; the assignee may also tick items. */
export function Checklist({ task }: { task: Task }) {
  const { user } = useAuth()
  const items = task.checklist ?? []
  const canEdit = !!task.can?.update
  const canTick = canEdit || task.assignee?.id === user?.id
  const [title, setTitle] = React.useState("")

  // Cleared at once so several items can be typed in a row (Enter after each)
  const add = useMutation({
    mutationFn: async (value: string) => api.post(`/tasks/${task.id}/checklist`, { title: value }),
    onMutate: () => setTitle(""),
    onError: (error, value) => {
      setTitle(value)
      toast.error(apiErrorMessage(error))
    },
  })
  const tick = useTickChecklist(task.id)
  const remove = useMutation({ mutationFn: async (id: number) => api.delete(`/checklist-items/${id}`) })

  const done = items.filter((item) => item.is_done).length
  if (!canEdit && items.length === 0) return null

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Checklist</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done} / {items.length}
          </span>
        )}
      </div>
      {items.length > 0 && <Progress value={(done / items.length) * 100} className="mb-2" aria-label="Checklist progress" />}
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="group flex min-h-9 items-center gap-2.5 rounded-md px-1 hover:bg-muted/50">
            <Checkbox
              checked={item.is_done}
              disabled={!canTick}
              onCheckedChange={(checked) => tick.mutate({ id: item.id, is_done: checked === true })}
              aria-label={item.title}
            />
            <span className={cn("flex-1 text-sm", item.is_done && "text-muted-foreground line-through")}>{item.title}</span>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                aria-label={`Remove ${item.title}`}
                onClick={() => remove.mutate(item.id)}
              >
                <TrashIcon />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="mt-1 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (title.trim()) add.mutate(title.trim())
          }}
        >
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add an item" aria-label="New checklist item" />
          <Button type="submit" variant="outline" disabled={!title.trim()}>
            <PlusIcon /> Add
          </Button>
        </form>
      )}
    </section>
  )
}
