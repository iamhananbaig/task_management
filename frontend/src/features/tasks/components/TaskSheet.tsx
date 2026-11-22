import { useSearchParams } from "react-router-dom"

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { TaskDetail } from "@/features/tasks/components/TaskDetail"

/**
 * Task detail in a side sheet, driven by ?task=<id> so it can be linked, refreshed and closed
 * with Back. Any list page can open a task with setSearchParams({ task: id }).
 */
export function TaskSheet() {
  const [params, setParams] = useSearchParams()
  const taskId = Number(params.get("task")) || null

  const close = () => {
    const next = new URLSearchParams(params)
    next.delete("task")
    setParams(next, { replace: true })
  }

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-4 data-[side=right]:sm:max-w-2xl sm:p-6">
        <SheetTitle className="sr-only">Task</SheetTitle>
        <SheetDescription className="sr-only">Task details, workflow moves, checklist and comments</SheetDescription>
        {taskId && <TaskDetail taskId={taskId} inSheet onDeleted={close} />}
      </SheetContent>
    </Sheet>
  )
}
