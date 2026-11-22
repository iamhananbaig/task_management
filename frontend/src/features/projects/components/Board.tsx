import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import {
  closestCorners,
  DndContext,
  pointerWithin,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PlusIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { ColorDot } from "@/features/tasks/components/badges"
import { MoveDialog } from "@/features/tasks/components/MoveDialog"
import { needsMoveDialog } from "@/features/tasks/lib/move-rules"
import { TaskCard } from "@/features/tasks/components/TaskCard"
import { useMoveTask } from "@/features/tasks/lib/use-move"
import { useOpenTask } from "@/features/tasks/lib/use-open-task"
import { api } from "@/lib/api"
import { useCan } from "@/lib/auth"
import { Permission } from "@/lib/permissions"
import { toast } from "@/lib/toast"
import type { AvailableTransition, Status, Task } from "@/lib/types"
import { cn } from "@/lib/utils"

type Columns = Record<number, Task[]>

/**
 * Where a card is dropped: what is under the mouse / finger — a card (to place it before) or else
 * the column. Falls back to the nearest target only when the pointer is outside every column.
 */
const dropTarget: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 0) {
    const card = hits.find((hit) => !String(hit.id).startsWith("status-"))
    return [card ?? hits[0]]
  }
  return closestCorners(args)
}

function group(statuses: Status[], tasks: Task[]): Columns {
  const columns: Columns = Object.fromEntries(statuses.map((status) => [status.id, [] as Task[]]))
  for (const task of tasks) {
    const statusId = task.status?.id
    if (statusId !== undefined && columns[statusId]) columns[statusId].push(task)
  }
  return columns
}

/**
 * Kanban board: one column per status. Dropping a card in another column makes the workflow move
 * that leads there (asking for a comment / a choice when needed); columns the card cannot move to
 * are dimmed while dragging. Dropping within a column changes the order.
 */
export function Board({ statuses, tasks, onAdd }: { statuses: Status[]; tasks: Task[]; onAdd?: () => void }) {
  const openTask = useOpenTask()
  const canReorder = useCan(Permission.EditTasks)
  const move = useMoveTask()
  const reorder = useMutation({
    mutationFn: async ({ taskId, position }: { taskId: number; position: number }) => api.put(`/tasks/${taskId}/position`, { position }),
  })

  // Local copy so a reorder shows at once; replaced whenever the server data changes
  const [columns, setColumns] = React.useState(() => group(statuses, tasks))
  const [source, setSource] = React.useState({ statuses, tasks })
  if (source.statuses !== statuses || source.tasks !== tasks) {
    setSource({ statuses, tasks })
    setColumns(group(statuses, tasks))
  }

  const [active, setActive] = React.useState<Task | null>(null)
  const [asking, setAsking] = React.useState<{ task: Task; choices: AvailableTransition[] } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Phones: press and hold to drag, so the board still scrolls sideways
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const statusName = (id: number) => statuses.find((status) => status.id === id)?.name ?? "?"

  const onDragStart = (event: DragStartEvent) => setActive((event.active.data.current?.task as Task) ?? null)

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null)
    const task = event.active.data.current?.task as Task | undefined
    const toStatusId = event.over?.data.current?.statusId as number | undefined
    if (!task || toStatusId === undefined || !task.status) return
    const fromStatusId = task.status.id

    if (toStatusId === fromStatusId) {
      if (!canReorder || event.over?.id === event.active.id) return
      const list = columns[fromStatusId]
      const from = list.findIndex((item) => item.id === task.id)
      const overIndex = list.findIndex((item) => item.id === event.over?.id)
      const to = overIndex === -1 ? list.length - 1 : overIndex
      if (from === to) return
      setColumns({ ...columns, [fromStatusId]: arrayMove(list, from, to) })
      reorder.mutate({ taskId: task.id, position: to })
      return
    }

    const choices = (task.available_transitions ?? []).filter((transition) => transition.to_status_id === toStatusId)
    if (choices.length === 0) {
      toast.warning("Move not allowed", `You can't move ${task.reference} from ${statusName(fromStatusId)} to ${statusName(toStatusId)}.`)
      return
    }
    if (choices.length === 1 && !needsMoveDialog(task, choices[0])) {
      move.mutate({ task, transition: choices[0] })
      return
    }
    setAsking({ task, choices })
  }

  const allowedTargets = new Set(active?.available_transitions?.map((transition) => transition.to_status_id) ?? [])

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={dropTarget} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
          {statuses.map((status, index) => (
            <Column
              key={status.id}
              status={status}
              tasks={columns[status.id] ?? []}
              onOpen={openTask}
              onAdd={index === 0 ? onAdd : undefined}
              dragState={!active ? "idle" : active.status?.id === status.id ? "source" : allowedTargets.has(status.id) ? "allowed" : "blocked"}
            />
          ))}
        </div>
        <DragOverlay>{active && <TaskCard task={active} dragging className="w-72" />}</DragOverlay>
      </DndContext>
      {asking && <MoveDialog task={asking.task} choices={asking.choices} onClose={() => setAsking(null)} />}
    </>
  )
}

function Column({
  status,
  tasks,
  onOpen,
  onAdd,
  dragState,
}: {
  status: Status
  tasks: Task[]
  onOpen: (id: number) => void
  onAdd?: () => void
  dragState: "idle" | "source" | "allowed" | "blocked"
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status-${status.id}`, data: { statusId: status.id } })

  return (
    <section
      ref={setNodeRef}
      aria-label={status.name}
      className={cn(
        "flex w-[82vw] max-w-80 shrink-0 snap-start flex-col rounded-xl bg-muted/50 transition-opacity sm:w-72",
        dragState === "blocked" && "opacity-40",
        dragState === "allowed" && "ring-2 ring-primary/30",
        dragState === "allowed" && isOver && "bg-primary/5 ring-primary/60"
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <ColorDot color={status.color} />
        <h2 className="truncate text-sm font-semibold">{status.name}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        {onAdd && (
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="New task" onClick={onAdd}>
            <PlusIcon />
          </Button>
        )}
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} onOpen={() => onOpen(task.id)} />
          ))}
          {tasks.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">No tasks</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task, statusId: task.status?.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  )
}
