import { useMutation } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Task } from "@/lib/types"

export type TaskPatch = Partial<Pick<Task, "title" | "description" | "priority" | "start_date" | "due_date">> & {
  assignee_id?: number | null
  reviewer_id?: number | null
  tag_ids?: number[]
}

/** PUT /tasks/{id} with only the changed fields. */
export function useUpdateTask(taskId: number) {
  return useMutation({
    mutationFn: async (patch: TaskPatch) => (await api.put<{ data: Task }>(`/tasks/${taskId}`, patch)).data.data,
  })
}

