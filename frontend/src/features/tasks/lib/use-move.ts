import { useMutation } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { AvailableTransition, Task } from "@/lib/types"

/** POST /tasks/{id}/transitions/{transition}: one workflow move, with an optional comment. */
export function useMoveTask() {
  return useMutation({
    mutationFn: async ({ task, transition, comment }: { task: Task; transition: AvailableTransition; comment?: string }) =>
      (await api.post<{ data: Task }>(`/tasks/${task.id}/transitions/${transition.id}`, { comment: comment || null })).data.data,
    onSuccess: (task, { transition }) => toast.success(transition.label, `${task.reference} is now ${task.status?.name ?? "moved"}.`),
  })
}
