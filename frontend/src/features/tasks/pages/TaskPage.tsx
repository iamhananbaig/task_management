import { useParams } from "react-router-dom"

import { TaskDetail } from "@/features/tasks/components/TaskDetail"

/** /tasks/:id — a task as its own page (links in emails and notifications). */
export default function TaskPage() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-3xl">
      <TaskDetail taskId={Number(id)} />
    </div>
  )
}
