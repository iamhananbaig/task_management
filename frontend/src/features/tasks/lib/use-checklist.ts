import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api, apiErrorMessage } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { Task } from "@/lib/types"

/** Ticks / unticks a checklist item, showing the change at once (rolled back if the server refuses). */
export function useTickChecklist(taskId: number) {
  const queryClient = useQueryClient()
  const key = ["task", taskId]

  return useMutation({
    mutationFn: async ({ id, is_done }: { id: number; is_done: boolean }) => api.put(`/checklist-items/${id}`, { is_done }),
    onMutate: async ({ id, is_done }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Task>(key)
      if (before?.checklist) {
        queryClient.setQueryData<Task>(key, {
          ...before,
          checklist: before.checklist.map((item) => (item.id === id ? { ...item, is_done } : item)),
        })
      }
      return { before }
    },
    onError: (error, _vars, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before)
      toast.error(apiErrorMessage(error))
    },
  })
}
