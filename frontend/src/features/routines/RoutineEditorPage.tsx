import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { DatePickerInput } from "@/components/ui/date-picker"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { RunRow } from "@/features/routines/RunProgress"
import { api } from "@/lib/api"
import { fieldErrors } from "@/lib/errors"
import { describeDueRule, dueRuleLabels, frequencyLabels, priorities, priorityLabels } from "@/lib/labels"
import { useMembers, useProject, useRoutine, useTagGroups } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { DueRule, Frequency, Priority, Routine, RoutineItem, UserSummary } from "@/lib/types"
import { formatDate } from "@/lib/utils"

const blankItem = (): RoutineItem => ({
  title: "",
  description: null,
  priority: "medium",
  assignee_id: null,
  reviewer_id: null,
  checklist: [],
  tag_ids: [],
  due_rule: "days_after_end",
  due_value: 3,
})

/** Create or edit a routine and its tasks (/projects/:id/routines/new or /:routineId). */
export default function RoutineEditorPage() {
  const { id, routineId } = useParams()
  const isNew = routineId === "new"
  const project = useProject(id)
  const routine = useRoutine(isNew ? undefined : routineId)

  if (project.isLoading || (!isNew && routine.isLoading)) return <Loading />
  if (!project.data) return <ErrorAlert error={project.error} />
  if (!isNew && !routine.data) return <ErrorAlert error={routine.error} />

  return <Editor key={routine.data?.id ?? "new"} projectId={project.data.id} projectName={project.data.name} routine={routine.data} canManage={isNew ? !!project.data.can?.manage : !!routine.data?.can_manage} />
}

function Editor({ projectId, projectName, routine, canManage }: { projectId: number; projectName: string; routine?: Routine; canManage: boolean }) {
  const navigate = useNavigate()
  const members = useMembers(projectId)
  const tagGroups = useTagGroups()
  const [name, setName] = React.useState(routine?.name ?? "")
  const [description, setDescription] = React.useState(routine?.description ?? "")
  const [frequency, setFrequency] = React.useState<Frequency>(routine?.frequency ?? "monthly")
  const [leadDays, setLeadDays] = React.useState(String(routine?.lead_days ?? 5))
  const [active, setActive] = React.useState(routine?.is_active ?? true)
  const [startPeriod, setStartPeriod] = React.useState("")
  const [items, setItems] = React.useState<RoutineItem[]>(routine?.items?.length ? routine.items : [blankItem()])
  const [deleting, setDeleting] = React.useState(false)

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        description: description || null,
        frequency,
        lead_days: Number(leadDays),
        is_active: active,
        next_period_end: startPeriod || null,
        items: items.map((item) => ({ ...item, checklist: item.checklist.filter((line) => line.trim()) })),
      }
      return routine
        ? (await api.put<{ data: Routine }>(`/routines/${routine.id}`, body)).data.data
        : (await api.post<{ data: Routine }>(`/projects/${projectId}/routines`, body)).data.data
    },
    onSuccess: (saved) => {
      toast.success("Routine saved", `Next: ${saved.next_period_name}, created ${formatDate(saved.next_run_on)}`)
      if (!routine) navigate(`/projects/${projectId}/routines/${saved.id}`, { replace: true })
    },
  })
  const remove = useMutation({
    mutationFn: async () => api.delete(`/routines/${routine?.id}`),
    onSuccess: () => {
      toast.success("Routine deleted", "Tasks already created are kept.")
      navigate(`/projects/${projectId}/routines`)
    },
  })
  const errors = fieldErrors(save.error)

  const update = (index: number, patch: Partial<RoutineItem>) => setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })

  return (
    <>
      <PageHeader title={routine ? routine.name : "New routine"} description={projectName} back={{ to: `/projects/${projectId}/routines`, label: "Routines" }}>
        {routine && canManage && (
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            <TrashIcon /> Delete
          </Button>
        )}
      </PageHeader>

      <form
        className="flex max-w-4xl flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <fieldset disabled={!canManage} className="contents">
          <FieldGroup className="max-w-2xl">
            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="routine-name">Name</FieldLabel>
              <Input id="routine-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Month-end close" />
              <FieldError>{errors.name?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="routine-description">Description</FieldLabel>
              <Textarea id="routine-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="routine-frequency">Repeats</FieldLabel>
                <NativeSelect id="routine-frequency" className="w-full" value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
                  {(Object.keys(frequencyLabels) as Frequency[]).map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {frequencyLabels[value]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>Quarters and years follow the Jul–Jun fiscal year.</FieldDescription>
              </Field>
              <Field data-invalid={!!errors.lead_days || undefined}>
                <FieldLabel htmlFor="routine-lead">Create tasks</FieldLabel>
                <NativeSelect id="routine-lead" className="w-full" value={leadDays} onChange={(event) => setLeadDays(event.target.value)}>
                  {[0, 1, 2, 3, 5, 7, 10, 14, 21, 30].map((days) => (
                    <NativeSelectOption key={days} value={days}>
                      {days === 0 ? "On the last day of the period" : `${days} day${days > 1 ? "s" : ""} before period end`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <DatePickerInput id="routine-start" label={routine ? "Move next period to" : "First period"} value={startPeriod} onChange={setStartPeriod} placeholder={routine ? routine.next_period_name : "The current period"} />
            </div>
            {routine && (
              <p className="text-sm text-muted-foreground">
                Next run: <strong>{routine.next_period_name}</strong>, created automatically on {formatDate(routine.next_run_on)}. Changes apply to future runs only.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Switch id="routine-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="routine-active">{active ? "Active — creates its tasks every period" : "Paused — no new runs"}</Label>
            </div>
          </FieldGroup>

          <section>
            <h2 className="text-sm font-semibold">Tasks in each run</h2>
            <p className="mb-3 text-sm text-muted-foreground">Each period gets a copy of these, named “… — June 2026”. Due dates count calendar days from the period end (a Sunday stays a Sunday).</p>
            {errors.items && <ErrorAlert error={errors.items[0]} />}
            <ol className="flex flex-col gap-3">
              {items.map((item, index) => (
                <ItemEditor
                  key={index}
                  index={index}
                  item={item}
                  count={items.length}
                  members={members.data ?? []}
                  tagGroups={tagGroups.data ?? []}
                  errors={errors}
                  onChange={(patch) => update(index, patch)}
                  onMove={(delta) => move(index, delta)}
                  onCopy={() => setItems((list) => [...list.slice(0, index + 1), { ...item, id: undefined, title: `${item.title} (copy)` }, ...list.slice(index + 1)])}
                  onRemove={() => setItems((list) => list.filter((_, i) => i !== index))}
                />
              ))}
            </ol>
            <Button type="button" variant="outline" className="mt-3" onClick={() => setItems((list) => [...list, blankItem()])}>
              <PlusIcon /> Add task
            </Button>
          </section>
        </fieldset>

        {save.error && !Object.keys(errors).length && <ErrorAlert error={save.error} />}
        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>Some fields need attention — see the messages above.</AlertDescription>
          </Alert>
        )}

        {canManage && (
          <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
            <Button type="submit" size="lg" disabled={save.isPending || !name.trim() || items.some((item) => !item.title.trim())}>
              {save.isPending && <Spinner />} Save routine
            </Button>
          </div>
        )}
      </form>

      {routine?.runs && routine.runs.length > 0 && (
        <section className="mt-8 max-w-4xl">
          <h2 className="mb-2 text-sm font-semibold">Runs</h2>
          <div className="flex flex-col divide-y rounded-lg border">
            {routine.runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </section>
      )}

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {routine?.name}?</AlertDialogTitle>
            <AlertDialogDescription>No more runs will be created. Tasks already created stay in the project. To stop it for a while, pause it instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ItemEditor({
  index,
  item,
  count,
  members,
  tagGroups,
  errors,
  onChange,
  onMove,
  onCopy,
  onRemove,
}: {
  index: number
  item: RoutineItem
  count: number
  members: UserSummary[]
  tagGroups: { id: number; name: string; tags: { id: number; name: string; is_active: boolean }[] }[]
  errors: Record<string, string[]>
  onChange: (patch: Partial<RoutineItem>) => void
  onMove: (delta: number) => void
  onCopy: () => void
  onRemove: () => void
}) {
  const error = (field: string) => errors[`items.${index}.${field}`]?.[0]
  const person = (field: "assignee_id" | "reviewer_id", label: string, empty: string) => (
    <Field data-invalid={!!error(field) || undefined}>
      <FieldLabel htmlFor={`item-${index}-${field}`}>{label}</FieldLabel>
      <NativeSelect id={`item-${index}-${field}`} className="w-full" value={item[field] ? String(item[field]) : ""} onChange={(event) => onChange({ [field]: event.target.value ? Number(event.target.value) : null })}>
        <NativeSelectOption value="">{empty}</NativeSelectOption>
        {members.map((member) => (
          <NativeSelectOption key={member.id} value={member.id}>
            {member.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldError>{error(field)}</FieldError>
    </Field>
  )

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 w-5 text-right text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
        <Field className="flex-1" data-invalid={!!error("title") || undefined}>
          <Input aria-label="Task title" value={item.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="e.g. Bank reconciliations" required />
          <FieldError>{error("title")}</FieldError>
        </Field>
        <div className="flex">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUpIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDownIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Duplicate" onClick={onCopy}>
            <CopyIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" disabled={count === 1} onClick={onRemove}>
            <TrashIcon />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 pl-7 sm:grid-cols-2 lg:grid-cols-4">
        {person("assignee_id", "Assignee", "Unassigned")}
        {person("reviewer_id", "Reviewer", "No reviewer")}
        <Field>
          <FieldLabel htmlFor={`item-${index}-priority`}>Priority</FieldLabel>
          <NativeSelect id={`item-${index}-priority`} className="w-full" value={item.priority} onChange={(event) => onChange({ priority: event.target.value as Priority })}>
            {priorities.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {priorityLabels[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={!!error("due_value") || undefined}>
          <FieldLabel htmlFor={`item-${index}-due`}>Due</FieldLabel>
          <div className="flex gap-1.5">
            <Input id={`item-${index}-due`} type="number" min={item.due_rule === "day_of_next_month" ? 1 : 0} max={item.due_rule === "day_of_next_month" ? 31 : 366} className="w-16" value={item.due_value} onChange={(event) => onChange({ due_value: Number(event.target.value) })} />
            <NativeSelect className="min-w-0 flex-1" value={item.due_rule} onChange={(event) => onChange({ due_rule: event.target.value as DueRule })} aria-label="Due rule">
              {(Object.keys(dueRuleLabels) as DueRule[]).map((rule) => (
                <NativeSelectOption key={rule} value={rule}>
                  {rule === "day_of_next_month" ? "day of next month" : dueRuleLabels[rule]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <FieldDescription>{describeDueRule(item.due_rule, item.due_value)}</FieldDescription>
          <FieldError>{error("due_value")}</FieldError>
        </Field>
      </div>
      {tagGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-3 pl-7 sm:grid-cols-3">
          {tagGroups.map((group) => {
            const selected = group.tags.find((tag) => item.tag_ids.includes(tag.id))
            return (
              <Field key={group.id}>
                <FieldLabel htmlFor={`item-${index}-tag-${group.id}`}>{group.name}</FieldLabel>
                <NativeSelect
                  id={`item-${index}-tag-${group.id}`}
                  className="w-full"
                  value={selected ? String(selected.id) : ""}
                  onChange={(event) => {
                    const others = item.tag_ids.filter((tagId) => !group.tags.some((tag) => tag.id === tagId))
                    onChange({ tag_ids: event.target.value ? [...others, Number(event.target.value)] : others })
                  }}
                >
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {group.tags
                    .filter((tag) => tag.is_active || tag.id === selected?.id)
                    .map((tag) => (
                      <NativeSelectOption key={tag.id} value={tag.id}>
                        {tag.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
            )
          })}
          {error("tag_ids") && <FieldError className="sm:col-span-3">{error("tag_ids")}</FieldError>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 pl-7 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`item-${index}-checklist`}>Checklist (one per line)</FieldLabel>
          <Textarea id={`item-${index}-checklist`} rows={3} value={item.checklist.join("\n")} onChange={(event) => onChange({ checklist: event.target.value.split("\n") })} placeholder={"Bank statements downloaded\nReconciliation sheet"} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`item-${index}-description`}>Instructions</FieldLabel>
          <Textarea id={`item-${index}-description`} rows={3} value={item.description ?? ""} onChange={(event) => onChange({ description: event.target.value || null })} />
        </Field>
      </div>
    </li>
  )
}
