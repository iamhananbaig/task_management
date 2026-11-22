import { useMutation } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.heic,.zip"

/** POST /tasks/{id}/attachments, one file per call (several files: call once per file). */
export function useUploadAttachment(taskId: number) {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return api.post(`/tasks/${taskId}/attachments`, form)
    },
  })
}
