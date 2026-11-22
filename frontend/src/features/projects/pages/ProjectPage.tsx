import * as React from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowsClockwiseIcon, GearSixIcon, LockSimpleIcon, KanbanIcon, ListBulletsIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { TagFilter } from "@/components/app/tag-filter"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Board } from "@/features/projects/components/Board"
import { TaskList } from "@/features/projects/components/TaskList"
import { ColorDot } from "@/features/tasks/components/badges"
import { NewTaskDialog } from "@/features/tasks/components/NewTaskDialog"
import { TaskSheet } from "@/features/tasks/components/TaskSheet"
import { useOpenTask } from "@/features/tasks/lib/use-open-task"
import { useDebounced } from "@/hooks/use-debounced"
import { priorities, priorityLabels } from "@/lib/labels"
import { useBoard, useProject } from "@/lib/queries"
import { useShortcut } from "@/lib/shortcuts"

/** One project: board (default) or list, with filters. ?view=list, ?task=<id> opens a task. */
export default function ProjectPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const project = useProject(id)
  const openTask = useOpenTask()
  const [creating, setCreating] = React.useState(false)

  const view = params.get("view") === "list" ? "list" : "board"
  const assignee = params.get("assignee") ?? ""
  const priority = params.get("priority") ?? ""
  const tag = params.get("tag") ?? ""
  const [search, setSearch] = React.useState(params.get("q") ?? "")
  const debounced = useDebounced(search, 300)

  const filters = { assignee: assignee || undefined, priority: priority || undefined, tag_ids: tag ? [Number(tag)] : undefined, search: debounced || undefined, all: view === "list" ? 1 : undefined }
  const tasks = useBoard(id, filters)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const canCreate = !!project.data?.can?.create_tasks
  useShortcut("n", () => setCreating(true), canCreate)

  if (project.isLoading) return <Loading />
  if (project.error || !project.data) return <ErrorAlert error={project.error ?? "Project not found."} />
  const p = project.data

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ColorDot color={p.color} className="size-2.5" />
            {p.name}
            <span className="font-mono text-sm font-normal text-muted-foreground">{p.key}</span>
            {p.is_restricted && <LockSimpleIcon className="size-4 text-muted-foreground" aria-label="Restricted project" />}
          </span>
        }
        description={p.description ?? undefined}
        back={{ to: "/projects", label: "Projects" }}
      >
        <Button variant="outline" render={<Link to={`/projects/${p.id}/routines`} />}>
          <ArrowsClockwiseIcon /> Routines
        </Button>
        {p.can?.manage && (
          <Button variant="outline" render={<Link to={`/projects/${p.id}/settings`} />}>
            <GearSixIcon /> Settings
          </Button>
        )}
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> New task
          </Button>
        )}
      </PageHeader>

      {p.archived_at && (
        <Alert className="mb-4">
          <AlertDescription>This project is archived: tasks are read-only. A project manager can unarchive it in Settings.</AlertDescription>
        </Alert>
      )}

      <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <ToggleGroup value={[view]} onValueChange={(value) => value[0] && setParam("view", value[0] === "list" ? "list" : "")} variant="outline" size="sm">
          <ToggleGroupItem value="board" aria-label="Board">
            <KanbanIcon /> Board
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List">
            <ListBulletsIcon /> List
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="relative w-48 shrink-0 sm:w-64">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search tasks"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setParam("q", event.target.value)
            }}
            aria-label="Search tasks"
          />
        </div>
        <NativeSelect className="shrink-0" value={assignee} onChange={(event) => setParam("assignee", event.target.value)} aria-label="Assignee">
          <NativeSelectOption value="">Everyone</NativeSelectOption>
          <NativeSelectOption value="me">Assigned to me</NativeSelectOption>
          <NativeSelectOption value="none">Unassigned</NativeSelectOption>
          {p.members?.map((member) => (
            <NativeSelectOption key={member.id} value={member.id}>
              {member.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect className="shrink-0" value={priority} onChange={(event) => setParam("priority", event.target.value)} aria-label="Priority">
          <NativeSelectOption value="">Any priority</NativeSelectOption>
          {priorities.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {priorityLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <TagFilter className="shrink-0" value={tag} onChange={(value) => setParam("tag", value)} />
      </div>

      <ErrorAlert error={tasks.error} />
      {tasks.isLoading ? (
        <Loading />
      ) : view === "board" ? (
        <>
          <Board statuses={p.statuses ?? []} tasks={tasks.data ?? []} onAdd={canCreate ? () => setCreating(true) : undefined} />
          <p className="text-xs text-muted-foreground">Drag a card to another column to move it; only the moves the workflow allows you are possible. Completed tasks older than 30 days are in the List view.</p>
        </>
      ) : (
        <TaskList tasks={tasks.data ?? []} />
      )}

      {canCreate && <NewTaskDialog project={p} open={creating} onOpenChange={setCreating} onCreated={(task) => openTask(task.id)} />}
      <TaskSheet />
    </>
  )
}
