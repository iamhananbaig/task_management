import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { ColorDot, StatusBadge } from "@/features/tasks/components/badges"
import { api } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { Paginated, Task } from "@/lib/types"
import { timeAgo } from "@/lib/utils"

/** Deleted tasks; restore puts them back where they were. */
export default function BinPage() {
  const bin = useQuery({ queryKey: ["tasks", "bin"], queryFn: async () => (await api.get<Paginated<Task>>("/tasks/bin")).data })
  const restore = useMutation({
    mutationFn: async (task: Task) => api.post(`/tasks/${task.id}/restore`),
    onSuccess: (_data, task) => toast.success("Restored", task.reference),
  })

  return (
    <>
      <PageHeader title="Bin" description="Deleted tasks from projects you can see. Restoring puts a task back in its project and status." />
      <ErrorAlert error={bin.error} />
      {bin.isLoading && <Loading />}
      {bin.data?.data.length === 0 && <EmptyState title="The bin is empty" />}
      <ul className="divide-y rounded-lg border empty:hidden">
        {bin.data?.data.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{task.title}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ColorDot color={task.project.color} /> {task.project.name} · <span className="font-mono">{task.reference}</span> · deleted {task.deleted_at && timeAgo(task.deleted_at)}
              </div>
            </div>
            <StatusBadge status={task.status} />
            <Button variant="outline" onClick={() => restore.mutate(task)} disabled={restore.isPending}>
              <ArrowCounterClockwiseIcon /> Restore
            </Button>
          </li>
        ))}
      </ul>
    </>
  )
}
