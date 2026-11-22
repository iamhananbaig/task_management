import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowSquareOutIcon,
  BellRingingIcon,
  BellSlashIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  LinkSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react"

import { ErrorAlert, Loading } from "@/components/app/shared"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Activity } from "@/features/tasks/components/Activity"
import { Attachments } from "@/features/tasks/components/Attachments"
import { ColorDot, DueDate, StatusBadge } from "@/features/tasks/components/badges"
import { Checklist } from "@/features/tasks/components/Checklist"
import { Comments } from "@/features/tasks/components/Comments"
import { EmailReminderDialog } from "@/features/tasks/components/EmailReminderDialog"
import { TaskFields } from "@/features/tasks/components/TaskFields"
import { TransitionButtons } from "@/features/tasks/components/TransitionButtons"
import { useUpdateTask } from "@/features/tasks/lib/use-update-task"
import { api } from "@/lib/api"
import { useTask } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Everything about one task. Used in the board's side sheet and on /tasks/:id. */
export function TaskDetail({ taskId, inSheet, onDeleted }: { taskId: number; inSheet?: boolean; onDeleted?: () => void }) {
  const task = useTask(taskId)

  if (task.isLoading) return <Loading />
  if (task.error || !task.data) return <ErrorAlert error={task.error ?? "Task not found."} />

  return <TaskDetailBody task={task.data} inSheet={inSheet} onDeleted={onDeleted} />
}

function TaskDetailBody({ task, inSheet, onDeleted }: { task: Task; inSheet?: boolean; onDeleted?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        {/* In the sheet, leave room for its close button (top right) */}
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", inSheet && "pr-8")}>
          <ColorDot color={task.project.color} />
          <Link to={`/projects/${task.project.id}`} className="hover:text-foreground hover:underline">
            {task.project.name}
          </Link>
          <span>·</span>
          <span className="font-mono">{task.reference}</span>
          <div className="ml-auto flex items-center gap-1">
            {inSheet && (
              <Button variant="ghost" size="icon-sm" aria-label="Open as a page" render={<Link to={`/tasks/${task.id}`} />}>
                <ArrowSquareOutIcon />
              </Button>
            )}
            <TaskMenu task={task} onDeleted={onDeleted} />
          </div>
        </div>
        <EditableTitle task={task} />
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={task.status} />
          <DueDate date={task.due_date} done={task.status?.type === "done"} />
          {task.completed_at && <span className="text-xs text-muted-foreground">Completed {new Date(task.completed_at).toLocaleDateString()}</span>}
        </div>
      </header>

      <TransitionButtons task={task} />
      <TaskFields task={task} />
      <EditableDescription task={task} />
      <Checklist task={task} />

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">Comments{task.comments_count ? ` (${task.comments_count})` : ""}</TabsTrigger>
          <TabsTrigger value="files">Files{task.attachments?.length ? ` (${task.attachments.length})` : ""}</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="pt-3">
          <Comments task={task} />
        </TabsContent>
        <TabsContent value="files" className="pt-3">
          <Attachments task={task} />
        </TabsContent>
        <TabsContent value="activity" className="pt-3">
          <Activity taskId={task.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EditableTitle({ task }: { task: Task }) {
  const update = useUpdateTask(task.id)
  const [value, setValue] = React.useState(task.title)
  const [prev, setPrev] = React.useState(task.title)
  if (task.title !== prev) {
    setPrev(task.title)
    setValue(task.title)
  }

  if (!task.can?.update) return <h2 className="text-lg leading-snug font-semibold">{task.title}</h2>

  const commit = () => {
    const next = value.trim()
    if (!next) setValue(task.title)
    else if (next !== task.title) update.mutate({ title: next })
  }

  return (
    <textarea
      aria-label="Title"
      rows={1}
      value={value}
      onChange={(event) => setValue(event.target.value.replace(/\n/g, ""))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      className="field-sizing-content -mx-1 resize-none rounded-md border border-transparent bg-transparent px-1 text-lg leading-snug font-semibold outline-none hover:border-border focus:border-ring"
    />
  )
}

function EditableDescription({ task }: { task: Task }) {
  const update = useUpdateTask(task.id)
  const [value, setValue] = React.useState(task.description ?? "")
  const [prev, setPrev] = React.useState(task.description)
  if (task.description !== prev) {
    setPrev(task.description)
    setValue(task.description ?? "")
  }

  if (!task.can?.update) {
    return task.description ? (
      <section>
        <h3 className="mb-1 text-sm font-semibold">Description</h3>
        <p className="text-sm whitespace-pre-wrap">{task.description}</p>
      </section>
    ) : null
  }

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Description</h3>
      <Textarea
        aria-label="Description"
        value={value}
        rows={3}
        placeholder="Add details, links or acceptance criteria…"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => value !== (task.description ?? "") && update.mutate({ description: value || null })}
      />
    </section>
  )
}

function TaskMenu({ task, onDeleted }: { task: Task; onDeleted?: () => void }) {
  const navigate = useNavigate()
  const [reminding, setReminding] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const watch = useMutation({
    mutationFn: async () => (task.is_watching ? api.delete(`/tasks/${task.id}/watch`) : api.post(`/tasks/${task.id}/watch`)),
  })
  const remove = useMutation({
    mutationFn: async () => (await api.delete<{ message: string }>(`/tasks/${task.id}`)).data,
    onSuccess: (data) => {
      toast.success("Moved to the bin", data.message)
      if (onDeleted) onDeleted()
      else navigate(`/projects/${task.project.id}`)
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Task actions" />}>
          <DotsThreeIcon weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => watch.mutate()}>
            {task.is_watching ? <BellSlashIcon /> : <BellRingingIcon />}
            {task.is_watching ? "Stop watching" : "Watch for changes"}
          </DropdownMenuItem>
          {task.can?.remind && (
            <DropdownMenuItem onClick={() => setReminding(true)} disabled={!task.assignee}>
              <EnvelopeSimpleIcon /> Email reminder…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/tasks/${task.id}`)
              toast.success("Link copied")
            }}
          >
            <LinkSimpleIcon /> Copy link
          </DropdownMenuItem>
          {task.can?.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <TrashIcon /> Move to bin
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EmailReminderDialog task={task} open={reminding} onOpenChange={setReminding} />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {task.reference} to the bin?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from the board and lists. You can restore it from the Bin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Move to bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
