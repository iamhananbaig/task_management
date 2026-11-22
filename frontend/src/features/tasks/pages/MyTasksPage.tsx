import { useSearchParams } from "react-router-dom"

import { PageHeader } from "@/components/app/app-layout"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskList } from "@/features/projects/components/TaskList"
import { TaskSheet } from "@/features/tasks/components/TaskSheet"
import { useTasks, type TaskFilters } from "@/lib/queries"
import { cn } from "@/lib/utils"

const dueChips = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No due date" },
]

/** Tasks assigned to me, or waiting for my review, across projects. */
export default function MyTasksPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "review" ? "review" : "assigned"
  const due = params.get("due") ?? ""
  const includeDone = params.get("done") === "1"

  const filters: TaskFilters =
    tab === "review"
      ? { reviewer: "me", status_type: "review", per_page: 200 }
      : { assignee: "me", due: due || undefined, include_done: includeDone, sort: "due_date", per_page: 200 }
  const tasks = useTasks(filters)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete("task")
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="My tasks" description="Assigned to you, or waiting for your review, in every project." />
      <Tabs value={tab} onValueChange={(value) => setParam("tab", value === "review" ? "review" : "")}>
        <TabsList>
          <TabsTrigger value="assigned">Assigned to me</TabsTrigger>
          <TabsTrigger value="review">To review</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "assigned" && (
        <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {dueChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setParam("due", chip.value)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-medium",
                due === chip.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <Checkbox id="include-done" checked={includeDone} onCheckedChange={(checked) => setParam("done", checked ? "1" : "")} />
            <Label htmlFor="include-done" className="text-xs font-normal">
              Show completed
            </Label>
          </div>
        </div>
      )}

      <div className="mt-4">
        <ErrorAlert error={tasks.error} />
        {tasks.isLoading ? <Loading /> : <TaskList tasks={tasks.data?.data ?? []} emptyMessage={tab === "review" ? "Nothing is waiting for your review." : "No tasks here."} />}
      </div>
      <TaskSheet />
    </>
  )
}
