import { useTable } from "@tanstack/react-table"

import { DataTable } from "@/components/app/data-table"
import { columnHelper, features } from "@/components/app/data-table-columns"
import { DueDate, PriorityMark, StatusBadge, UserName } from "@/features/tasks/components/badges"
import { useOpenTask } from "@/features/tasks/lib/use-open-task"
import { priorities } from "@/lib/labels"
import type { Task } from "@/lib/types"

const helper = columnHelper<Task>()

const columns = helper.columns([
  helper.accessor("number", {
    header: "Task",
    meta: { mobile: "subtitle", className: "w-24 font-mono text-xs text-muted-foreground" },
    cell: (info) => info.row.original.reference,
  }),
  helper.accessor("title", {
    header: "Title",
    meta: { mobile: "title" },
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  helper.accessor((task) => task.status?.position ?? 0, {
    id: "status",
    header: "Status",
    cell: (info) => <StatusBadge status={info.row.original.status} />,
  }),
  helper.accessor((task) => task.assignee?.name ?? "", {
    id: "assignee",
    header: "Assignee",
    cell: (info) => <UserName user={info.row.original.assignee} />,
  }),
  helper.accessor((task) => priorities.indexOf(task.priority), {
    id: "priority",
    header: "Priority",
    cell: (info) => <PriorityMark priority={info.row.original.priority} showLabel />,
  }),
  helper.accessor((task) => task.due_date ?? "9999", {
    id: "due",
    header: "Due",
    cell: (info) => <DueDate date={info.row.original.due_date} done={info.row.original.status?.type === "done"} />,
  }),
])

/** Tasks as a sortable table (cards on phones). Click a row to open the task. */
export function TaskList({ tasks, emptyMessage = "No tasks match." }: { tasks: Task[]; emptyMessage?: string }) {
  const openTask = useOpenTask()
  const table = useTable({
    features,
    columns,
    data: tasks,
    getRowId: (task) => String(task.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 50 }, sorting: [{ id: "status", desc: false }] },
  })

  return <DataTable table={table} onRowClick={(task) => openTask(task.id)} emptyMessage={emptyMessage} />
}
