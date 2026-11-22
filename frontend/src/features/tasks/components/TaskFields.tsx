import { DatePickerInput } from "@/components/ui/date-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { PriorityMark, UserName } from "@/features/tasks/components/badges"
import { useUpdateTask, type TaskPatch as Patch } from "@/features/tasks/lib/use-update-task"
import { priorities, priorityLabels } from "@/lib/labels"
import { useMembers } from "@/lib/queries"
import type { Priority, Task } from "@/lib/types"
import { formatDate } from "@/lib/utils"

/** Assignee, reviewer, priority and dates. Read-only text when the user cannot edit. */
export function TaskFields({ task }: { task: Task }) {
  const editable = !!task.can?.update
  const members = useMembers(editable ? task.project.id : undefined)
  const update = useUpdateTask(task.id)
  const save = (patch: Patch) => update.mutate(patch)

  if (!editable) {
    return (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <ReadOnly label="Assignee" value={<UserName user={task.assignee} />} />
        <ReadOnly label="Reviewer" value={<UserName user={task.reviewer} empty="No reviewer" />} />
        <ReadOnly label="Priority" value={<PriorityMark priority={task.priority} showLabel />} />
        <ReadOnly label="Start" value={formatDate(task.start_date)} />
        <ReadOnly label="Due" value={formatDate(task.due_date)} />
        <ReadOnly label="Created by" value={<UserName user={task.creator} empty="—" />} />
      </dl>
    )
  }

  const people = members.data ?? []
  const personSelect = (id: string, label: string, value: number | undefined, field: "assignee_id" | "reviewer_id", empty: string) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        value={value ? String(value) : ""}
        onChange={(event) => save({ [field]: event.target.value ? Number(event.target.value) : null })}
      >
        <NativeSelectOption value="">{empty}</NativeSelectOption>
        {/* Keep the current person listed even if they have left the project */}
        {value && !people.some((person) => person.id === value) && (
          <NativeSelectOption value={value}>{(field === "assignee_id" ? task.assignee : task.reviewer)?.name}</NativeSelectOption>
        )}
        {people.map((person) => (
          <NativeSelectOption key={person.id} value={person.id}>
            {person.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {personSelect("task-assignee", "Assignee", task.assignee?.id, "assignee_id", "Unassigned")}
      {personSelect("task-reviewer", "Reviewer", task.reviewer?.id, "reviewer_id", "No reviewer")}
      <Field>
        <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
        <NativeSelect
          id="task-priority"
          className="w-full"
          value={task.priority}
          onChange={(event) => save({ priority: event.target.value as Priority })}
        >
          {priorities.map((priority) => (
            <NativeSelectOption key={priority} value={priority}>
              {priorityLabels[priority]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <DatePickerInput id="task-start" label="Start" value={task.start_date ?? ""} onChange={(value) => save({ start_date: value || null })} />
      <DatePickerInput id="task-due" label="Due" value={task.due_date ?? ""} onChange={(value) => save({ due_date: value || null })} />
      <ReadOnly label="Created by" value={<UserName user={task.creator} empty="—" />} />
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm">{value}</dd>
    </div>
  )
}
