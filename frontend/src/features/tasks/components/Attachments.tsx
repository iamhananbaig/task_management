import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { DownloadSimpleIcon, PaperclipIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { saveDownload } from "@/lib/download"
import { toast } from "@/lib/toast"
import { apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Attachment, Task } from "@/lib/types"
import { fileSize, timeAgo } from "@/lib/utils"

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.heic,.zip"

export function Attachments({ task }: { task: Task }) {
  const { user } = useAuth()
  const input = React.useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return api.post(`/tasks/${task.id}/attachments`, form)
    },
  })
  const remove = useMutation({ mutationFn: async (id: number) => api.delete(`/attachments/${id}`) })

  const download = async (attachment: Attachment) => {
    try {
      const res = await api.get<Blob>(`/attachments/${attachment.id}/download`, { responseType: "blob" })
      saveDownload(res, attachment.original_name)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not download the file."))
    }
  }

  const files = task.attachments ?? []

  return (
    <div className="flex flex-col gap-3">
      {files.length === 0 && <p className="text-sm text-muted-foreground">No files attached.</p>}
      <ul className="flex flex-col divide-y rounded-md border empty:hidden">
        {files.map((file) => (
          <li key={file.id} className="flex items-center gap-3 px-3 py-2">
            <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <button type="button" className="block max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => download(file)}>
                {file.original_name}
              </button>
              <div className="text-xs text-muted-foreground">
                {fileSize(file.size)} · {file.user?.name ?? "—"} · {timeAgo(file.created_at)}
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Download ${file.original_name}`} onClick={() => download(file)}>
              <DownloadSimpleIcon />
            </Button>
            {(task.can?.delete || (file.user?.id === user?.id && task.can?.comment)) && (
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.original_name}`} onClick={() => remove.mutate(file.id)}>
                <TrashIcon />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {task.can?.comment && (
        <div>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) upload.mutate(file)
              event.target.value = ""
            }}
          />
          <Button variant="outline" onClick={() => input.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Spinner /> : <UploadSimpleIcon />} Attach a file
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">PDF, Office, images, text or zip, up to 20 MB.</p>
        </div>
      )}
    </div>
  )
}
