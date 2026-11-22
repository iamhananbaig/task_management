import * as React from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { DatePickerInput } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { fieldErrors } from "@/lib/errors"
import { priorities, priorityLabels } from "@/lib/labels"
import { useMembers, useProjects } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Priority, Project, Task } from "@/lib/types"

const empty = { title: "", description: "", priority: "medium" as Priority, assignee_id: "", reviewer_id: "", due_date: "" }

const LAST_PROJECT_KEY = "tasks.last-project"

function lastProjectId(): number | null {
  try {
    return Number(localStorage.getItem(LAST_PROJECT_KEY)) || null
  } catch {
    return null
  }
}

/**
 * New task. It starts in the project's first status. Without a `project` (quick add from the top
 * bar) the user picks one; the last project used is preselected.
 */
export function NewTaskDialog({
  project: fixedProject,
  open,
  onOpenChange,
  onCreated,
}: {
  project?: Pick<Project, "id" | "name">
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (task: Task) => void
}) {
  const { user } = useAuth()
  const projects = useProjects()
  const choices = (projects.data ?? []).filter((candidate) => candidate.can?.create_tasks)
  const [pickedId, setPickedId] = React.useState<number | null>(lastProjectId)
  const project = fixedProject ?? choices.find((candidate) => candidate.id === pickedId) ?? choices[0]
  const members = useMembers(open && project ? project.id : undefined)
  const [form, setForm] = React.useState(empty)
  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) => setForm((current) => ({ ...current, [key]: value }))

  const create = useMutation({
    mutationFn: async (keepOpen: boolean) => {
      if (!project) throw new Error("Choose a project.")
      const task = (
        await api.post<{ data: Task }>(`/projects/${project.id}/tasks`, {
          title: form.title.trim(),
          description: form.description || null,
          priority: form.priority,
          assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
          reviewer_id: form.reviewer_id ? Number(form.reviewer_id) : null,
          due_date: form.due_date || null,
        })
      ).data.data
      return { task, keepOpen }
    },
    onSuccess: ({ task, keepOpen }) => {
      try {
        localStorage.setItem(LAST_PROJECT_KEY, String(task.project.id))
      } catch {
        // private mode: just don't remember
      }
      toast.success("Task created", `${task.reference} · ${task.title}`)
      // "Create and add another" keeps the people and priority for the next one
      setForm((current) => ({ ...empty, priority: current.priority, assignee_id: current.assignee_id, reviewer_id: current.reviewer_id }))
      if (!keepOpen) {
        onOpenChange(false)
        onCreated?.(task)
      }
    },
  })
  const errors = fieldErrors(create.error)

  const submit = (event: React.FormEvent, keepOpen = false) => {
    event.preventDefault()
    if (form.title.trim()) create.mutate(keepOpen)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fixedProject ? `New task in ${fixedProject.name}` : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            {!fixedProject && (
              <Field>
                <FieldLabel htmlFor="new-project">Project</FieldLabel>
                <NativeSelect
                  id="new-project"
                  className="w-full"
                  value={project ? String(project.id) : ""}
                  onChange={(event) => {
                    setPickedId(Number(event.target.value))
                    // People belong to the project: pick them again
                    setForm((current) => ({ ...current, assignee_id: "", reviewer_id: "" }))
                  }}
                >
                  {choices.length === 0 && <NativeSelectOption value="">No project you can add tasks to</NativeSelectOption>}
                  {choices.map((candidate) => (
                    <NativeSelectOption key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field data-invalid={!!errors.title || undefined}>
              <FieldLabel htmlFor="new-title">Title</FieldLabel>
              <Input id="new-title" autoFocus value={form.title} onChange={(event) => set("title", event.target.value)} required maxLength={255} />
              <FieldError>{errors.title?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-description">Description</FieldLabel>
              <Textarea id="new-description" rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.assignee_id || undefined}>
                <FieldLabel htmlFor="new-assignee">Assignee</FieldLabel>
                <NativeSelect id="new-assignee" className="w-full" value={form.assignee_id} onChange={(event) => set("assignee_id", event.target.value)}>
                  <NativeSelectOption value="">Unassigned</NativeSelectOption>
                  {user && members.data?.some((member) => member.id === user.id) && <NativeSelectOption value={user.id}>Me ({user.name})</NativeSelectOption>}
                  {members.data
                    ?.filter((member) => member.id !== user?.id)
                    .map((member) => (
                      <NativeSelectOption key={member.id} value={member.id}>
                        {member.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
                <FieldError>{errors.assignee_id?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors.reviewer_id || undefined}>
                <FieldLabel htmlFor="new-reviewer">Reviewer</FieldLabel>
                <NativeSelect id="new-reviewer" className="w-full" value={form.reviewer_id} onChange={(event) => set("reviewer_id", event.target.value)}>
                  <NativeSelectOption value="">No reviewer</NativeSelectOption>
                  {members.data?.map((member) => (
                    <NativeSelectOption key={member.id} value={member.id}>
                      {member.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError>{errors.reviewer_id?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-priority">Priority</FieldLabel>
                <NativeSelect id="new-priority" className="w-full" value={form.priority} onChange={(event) => set("priority", event.target.value as Priority)}>
                  {priorities.map((priority) => (
                    <NativeSelectOption key={priority} value={priority}>
                      {priorityLabels[priority]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <DatePickerInput id="new-due" label="Due date" value={form.due_date} onChange={(value) => set("due_date", value)} />
            </div>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" disabled={create.isPending || !form.title.trim() || !project} onClick={(event) => submit(event, true)}>
              Create and add another
            </Button>
            <Button type="submit" disabled={create.isPending || !form.title.trim() || !project}>
              {create.isPending && <Spinner />} Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
