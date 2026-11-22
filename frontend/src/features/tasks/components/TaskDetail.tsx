import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  CaretDownIcon,
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
import { ColorDot, DueDate, PriorityMark, StatusBadge, UserName } from "@/features/tasks/components/badges"
import { Checklist } from "@/features/tasks/components/Checklist"
import { Comments } from "@/features/tasks/components/Comments"
import { EmailReminderDialog } from "@/features/tasks/components/EmailReminderDialog"
import { TaskFields } from "@/features/tasks/components/TaskFields"
import { TagChips, TaskTags } from "@/features/tasks/components/TaskTags"
import { TransitionButtons } from "@/features/tasks/components/TransitionButtons"
import { fileCount } from "@/features/tasks/lib/move-rules"
import { useUpdateTask } from "@/features/tasks/lib/use-update-task"
import { api } from "@/lib/api"
import { useTask } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Task } from "@/lib/types"
import { cn, formatDate } from "@/lib/utils"

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
          <DueDate date={task.due_date} done={task.status?.type === "done"} />
          {task.completed_at && <span className="text-xs text-muted-foreground">Completed {new Date(task.completed_at).toLocaleDateString()}</span>}
          {task.routine_run && (
            <Link to={`/runs/${task.routine_run.id}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Part of {task.routine_run.name}
            </Link>
          )}
        </div>
      </header>

      {/* Status and the moves stay in view while scrolling through checklist, files and comments */}
      <div
        className={cn(
          "sticky z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background py-2.5",
          // The sheet scrolls itself (padding p-4 / sm:p-6); a page scrolls under the 3rem top bar
          inSheet ? "-top-4 -mx-4 px-4 sm:-top-6 sm:-mx-6 sm:px-6" : "top-12",
        )}
      >
        <StatusBadge status={task.status} />
        <TransitionButtons task={task} className="ml-auto justify-end" emptyText={task.status?.type === "done" ? null : "Waiting for someone else"} />
      </div>

      <TaskDetails task={task} />
      <EditableDescription task={task} />
      <Checklist task={task} />

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Files {fileCount(task) > 0 && <span className="font-normal text-muted-foreground">({fileCount(task)})</span>}
        </h3>
        <Attachments task={task} />
      </section>

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">Comments{task.comments_count ? ` (${task.comments_count})` : ""}</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="pt-3">
          <Comments task={task} />
        </TabsContent>
        <TabsContent value="activity" className="pt-3">
          <Activity taskId={task.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const DETAILS_KEY = "tasks.details-open"

/**
 * People, priority, dates and tags as one readable line; opens into the editable fields. Stays
 * open or closed as the user last left it.
 */
function TaskDetails({ task }: { task: Task }) {
  const [open, setOpen] = React.useState(() => {
    try {
      return localStorage.getItem(DETAILS_KEY) === "1"
    } catch {
      return false
    }
  })
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(DETAILS_KEY, open ? "0" : "1")
    } catch {
      // private mode: just don't remember
    }
  }

  return (
    <section className="rounded-lg border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/50"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <UserName user={task.assignee} />
          {task.reviewer && (
            <>
              <ArrowRightIcon className="size-3 text-muted-foreground" aria-label="reviewed by" />
              <span className="text-muted-foreground">{task.reviewer.name}</span>
            </>
          )}
          <span className="text-muted-foreground">·</span>
          <PriorityMark priority={task.priority} showLabel />
          {task.start_date && <span className="text-muted-foreground">· Starts {formatDate(task.start_date)}</span>}
          <TagChips tags={task.tags} />
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? "Hide" : task.can?.update ? "Edit" : "Details"}</span>
        <CaretDownIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t px-3 py-3">
          <TaskFields task={task} />
          <TaskTags task={task} />
        </div>
      )}
    </section>
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
