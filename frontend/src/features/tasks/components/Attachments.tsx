import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { DownloadSimpleIcon, PaperclipIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ATTACHMENT_ACCEPT, useUploadAttachment } from "@/features/tasks/lib/use-upload"
import { api, apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { saveDownload } from "@/lib/download"
import { toast } from "@/lib/toast"
import type { Attachment, Task } from "@/lib/types"
import { cn, fileSize, timeAgo } from "@/lib/utils"

/** The task's files with download / remove, and a drop zone to add more. */
export function Attachments({ task }: { task: Task }) {
  const files = task.attachments ?? []

  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 && <FileList task={task} files={files} />}
      {task.can?.comment ? (
        <FileDrop taskId={task.id} />
      ) : (
        files.length === 0 && <p className="text-sm text-muted-foreground">No files attached.</p>
      )}
    </div>
  )
}

export function FileList({ task, files }: { task: Task; files: Attachment[] }) {
  const { user } = useAuth()
  const remove = useMutation({ mutationFn: async (id: number) => api.delete(`/attachments/${id}`) })

  const download = async (attachment: Attachment) => {
    try {
      const res = await api.get<Blob>(`/attachments/${attachment.id}/download`, { responseType: "blob" })
      saveDownload(res, attachment.original_name)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not download the file."))
    }
  }

  return (
    <ul className="flex flex-col divide-y rounded-md border">
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
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${file.original_name}`}
              disabled={remove.isPending && remove.variables === file.id}
              onClick={() => remove.mutate(file.id)}
            >
              <TrashIcon />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Click or drop one or more files; each is uploaded in turn. */
export function FileDrop({ taskId, compact }: { taskId: number; compact?: boolean }) {
  const input = React.useRef<HTMLInputElement>(null)
  const upload = useUploadAttachment(taskId)
  const [busy, setBusy] = React.useState(0)
  const [over, setOver] = React.useState(false)

  const send = async (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    setBusy(files.length)
    for (const file of files) {
      try {
        await upload.mutateAsync(file)
      } catch {
        // the shared error toast has already shown the server's message
      }
      setBusy((left) => left - 1)
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        void send(event.dataTransfer.files)
      }}
      className={cn(
        "flex items-center gap-3 rounded-md border border-dashed px-3 text-sm text-muted-foreground transition-colors",
        compact ? "py-2" : "py-3",
        over && "border-primary bg-primary/5 text-foreground",
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void send(event.target.files)
          event.target.value = ""
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy > 0}>
        {busy > 0 ? <Spinner /> : <UploadSimpleIcon />} {busy > 0 ? `Uploading ${busy}…` : "Attach files"}
      </Button>
      <span className="min-w-0 truncate">or drop them here · PDF, Office, images, zip · up to 20 MB each</span>
    </div>
  )
}
