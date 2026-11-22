import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { ErrorAlert } from "@/components/app/shared"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { ColorDot } from "@/features/tasks/components/badges"
import { api } from "@/lib/api"
import { fieldErrors } from "@/lib/errors"
import { actorLabels, colorNames, statusTypeLabels } from "@/lib/labels"
import { toast } from "@/lib/toast"
import type { Status, StatusType, Transition, TransitionActor, WorkflowDefinition } from "@/lib/types"

type EditStatus = WorkflowDefinition["statuses"][number] & { tasks_count?: number }
type EditTransition = WorkflowDefinition["transitions"][number]

/** A status without its task count, as the API expects it. */
const plain = (status: EditStatus) => ({ key: status.key, name: status.name, color: status.color, type: status.type })

const actors = Object.keys(actorLabels) as TransitionActor[]
const types = Object.keys(statusTypeLabels) as StatusType[]

function fromServer(statuses: Status[], transitions: Transition[]) {
  return {
    statuses: statuses.map((status) => ({ key: String(status.id), name: status.name, color: status.color, type: status.type, tasks_count: status.tasks_count })),
    transitions: transitions.map((transition) => ({
      from: String(transition.from_status_id),
      to: String(transition.to_status_id),
      label: transition.label,
      actors: transition.actors,
      requires_comment: transition.requires_comment,
    })),
  }
}

/**
 * Edit a project's statuses (board columns) and the moves between them. Saved as a whole
 * (PUT /projects/{id}/workflow); removing a status that still has tasks asks where they go.
 */
export function WorkflowEditor({ projectId, statuses: serverStatuses, transitions: serverTransitions }: { projectId: number; statuses: Status[]; transitions: Transition[] }) {
  const initial = React.useMemo(() => fromServer(serverStatuses, serverTransitions), [serverStatuses, serverTransitions])
  const [statuses, setStatuses] = React.useState<EditStatus[]>(initial.statuses)
  const [transitions, setTransitions] = React.useState<EditTransition[]>(initial.transitions)
  const [reassign, setReassign] = React.useState<Record<string, string>>({})
  const [prev, setPrev] = React.useState(initial)
  if (prev !== initial) {
    setPrev(initial)
    setStatuses(initial.statuses)
    setTransitions(initial.transitions)
    setReassign({})
  }
  const nextKey = React.useRef(1)

  const removedWithTasks = initial.statuses.filter((status) => (status.tasks_count ?? 0) > 0 && !statuses.some((current) => current.key === status.key))
  const dirty = JSON.stringify({ statuses: statuses.map(plain), transitions }) !== JSON.stringify({ statuses: initial.statuses.map(plain), transitions: initial.transitions })

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/projects/${projectId}/workflow`, {
        statuses: statuses.map(plain),
        transitions,
        reassign,
      }),
    onSuccess: () => toast.success("Workflow saved"),
  })
  const errors = fieldErrors(save.error)

  const updateStatus = (index: number, patch: Partial<EditStatus>) => setStatuses((list) => list.map((status, i) => (i === index ? { ...status, ...patch } : status)))
  const moveStatus = (index: number, delta: number) =>
    setStatuses((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  const removeStatus = (key: string) => {
    setStatuses((list) => list.filter((status) => status.key !== key))
    setTransitions((list) => list.filter((transition) => transition.from !== key && transition.to !== key))
  }
  const addStatus = () => setStatuses((list) => [...list, { key: `new-${nextKey.current++}`, name: "", color: "gray", type: "active" }])

  const updateTransition = (index: number, patch: Partial<EditTransition>) => setTransitions((list) => list.map((transition, i) => (i === index ? { ...transition, ...patch } : transition)))
  const addTransition = () =>
    setTransitions((list) => [...list, { from: statuses[0]?.key ?? "", to: statuses[1]?.key ?? statuses[0]?.key ?? "", label: "", actors: ["assignee"], requires_comment: false }])

  const statusLabel = (key: string) => statuses.find((status) => status.key === key)?.name || "(unnamed)"

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold">Statuses</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The board's columns, left to right. New tasks start in the first one. The type tells reports and reminders what a status means; at least one must be Done.
        </p>
        <ul className="flex flex-col gap-2">
          {statuses.map((status, index) => (
            <li key={status.key} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
              <div className="flex flex-col">
                <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={index === 0} onClick={() => moveStatus(index, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={index === statuses.length - 1} onClick={() => moveStatus(index, 1)}>
                  <ArrowDownIcon />
                </Button>
              </div>
              <ColorDot color={status.color} className="size-3" />
              <Input className="w-44 flex-1 sm:flex-none" value={status.name} placeholder="Status name" aria-label="Status name" maxLength={50} onChange={(event) => updateStatus(index, { name: event.target.value })} />
              <NativeSelect value={status.color} onChange={(event) => updateStatus(index, { color: event.target.value })} aria-label="Colour">
                {colorNames.map((color) => (
                  <NativeSelectOption key={color} value={color}>
                    {color}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect value={status.type} onChange={(event) => updateStatus(index, { type: event.target.value as StatusType })} aria-label="Type">
                {types.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {statusTypeLabels[type]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {index === 0 && <span className="text-xs text-muted-foreground">Start</span>}
              {!!status.tasks_count && <span className="text-xs text-muted-foreground">{status.tasks_count} task(s)</span>}
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Remove ${status.name}`} disabled={statuses.length === 1} onClick={() => removeStatus(status.key)}>
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="mt-2" onClick={addStatus}>
          <PlusIcon /> Add status
        </Button>
      </section>

      {removedWithTasks.length > 0 && (
        <Alert>
          <AlertDescription className="flex flex-col gap-2">
            <span>Removed statuses still have tasks. Choose where they go:</span>
            {removedWithTasks.map((status) => (
              <span key={status.key} className="flex flex-wrap items-center gap-2">
                {status.tasks_count} in <strong>{status.name}</strong> <ArrowRightIcon className="size-3.5" />
                <NativeSelect value={reassign[status.key] ?? ""} onChange={(event) => setReassign((current) => ({ ...current, [status.key]: event.target.value }))} aria-label={`Move ${status.name} tasks to`}>
                  <NativeSelectOption value="">Choose a status…</NativeSelectOption>
                  {statuses.map((target) => (
                    <NativeSelectOption key={target.key} value={target.key}>
                      {target.name || "(unnamed)"}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <section>
        <h2 className="text-sm font-semibold">Moves</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Each move is a button on the task (and a drop target on the board) for the people ticked. Ask for a comment on moves that send work back. Two moves between the same statuses can have different people — e.g. "Pull back" for the assignee and "Send back" for the reviewer.
        </p>
        <div className="flex flex-col gap-2">
          {transitions.map((transition, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field className="w-auto">
                  <FieldLabel>From</FieldLabel>
                  <NativeSelect value={transition.from} onChange={(event) => updateTransition(index, { from: event.target.value })} aria-label="From">
                    {statuses.map((status) => (
                      <NativeSelectOption key={status.key} value={status.key}>
                        {status.name || "(unnamed)"}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <ArrowRightIcon className="mb-1.5 size-4 text-muted-foreground" />
                <Field className="w-auto">
                  <FieldLabel>To</FieldLabel>
                  <NativeSelect value={transition.to} onChange={(event) => updateTransition(index, { to: event.target.value })} aria-label="To">
                    {statuses.map((status) => (
                      <NativeSelectOption key={status.key} value={status.key}>
                        {status.name || "(unnamed)"}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className="w-48 flex-1">
                  <FieldLabel>Button label</FieldLabel>
                  <Input value={transition.label} maxLength={50} placeholder={`e.g. Move to ${statusLabel(transition.to)}`} onChange={(event) => updateTransition(index, { label: event.target.value })} />
                </Field>
                <Button variant="ghost" size="icon-sm" className="mb-0.5" aria-label="Remove move" onClick={() => setTransitions((list) => list.filter((_, i) => i !== index))}>
                  <TrashIcon />
                </Button>
              </div>
              {transition.from === transition.to && <p className="text-xs text-destructive">A move must go to a different status.</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <span className="text-xs text-muted-foreground">Who:</span>
                {actors.map((actor) => {
                  const id = `t${index}-${actor}`
                  return (
                    <div key={actor} className="flex items-center gap-1.5">
                      <Checkbox
                        id={id}
                        checked={transition.actors.includes(actor)}
                        onCheckedChange={(checked) =>
                          updateTransition(index, { actors: checked ? [...transition.actors, actor] : transition.actors.filter((value) => value !== actor) })
                        }
                      />
                      <Label htmlFor={id} className="text-xs font-normal">
                        {actorLabels[actor]}
                      </Label>
                    </div>
                  )
                })}
                <div className="flex items-center gap-1.5 sm:ml-auto">
                  <Checkbox id={`t${index}-comment`} checked={transition.requires_comment} onCheckedChange={(checked) => updateTransition(index, { requires_comment: checked === true })} />
                  <Label htmlFor={`t${index}-comment`} className="text-xs font-normal">
                    Comment required
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-2" onClick={addTransition} disabled={statuses.length < 2}>
          <PlusIcon /> Add move
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Users with “override workflow” (managers, admins) can make any of these moves, whoever is ticked.</p>
      </section>

      {save.error && Object.keys(errors).length === 0 && <ErrorAlert error={save.error} />}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {Object.entries(errors).map(([key, messages]) => (
                <li key={key}>{messages[0]}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
        <Button
          size="lg"
          disabled={!dirty || save.isPending || removedWithTasks.some((status) => !reassign[status.key]) || statuses.some((status) => !status.name.trim()) || transitions.some((transition) => !transition.label.trim() || transition.actors.length === 0)}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Spinner />} Save workflow
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setStatuses(initial.statuses)
            setTransitions(initial.transitions)
            setReassign({})
          }}
        >
          Discard changes
        </Button>
      </div>
    </div>
  )
}
