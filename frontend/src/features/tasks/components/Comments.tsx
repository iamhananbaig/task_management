import * as React from "react"
import { useMutation } from "@tanstack/react-query"

import { Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/features/tasks/components/badges"
import { api } from "@/lib/api"
import { useComments } from "@/lib/queries"
import type { Comment, Task } from "@/lib/types"
import { timeAgo } from "@/lib/utils"

export function Comments({ task }: { task: Task }) {
  const comments = useComments(task.id)
  const [body, setBody] = React.useState("")
  const post = useMutation({
    mutationFn: async (text: string) => api.post(`/tasks/${task.id}/comments`, { body: text }),
    onSuccess: () => setBody(""),
  })

  return (
    <div className="flex flex-col gap-4">
      {comments.isLoading && <Loading />}
      {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ul className="flex flex-col gap-4">
        {comments.data?.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
      </ul>
      {task.can?.comment && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (body.trim()) post.mutate(body.trim())
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && body.trim()) post.mutate(body.trim())
            }}
            rows={3}
            placeholder="Write a comment… (Ctrl+Enter to send)"
            aria-label="New comment"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!body.trim() || post.isPending}>
              {post.isPending && <Spinner />} Comment
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function CommentItem({ comment }: { comment: Comment }) {
  const [editing, setEditing] = React.useState(false)
  const [body, setBody] = React.useState(comment.body)
  const save = useMutation({
    mutationFn: async () => api.put(`/comments/${comment.id}`, { body }),
    onSuccess: () => setEditing(false),
  })
  const remove = useMutation({ mutationFn: async () => api.delete(`/comments/${comment.id}`) })

  return (
    <li className="flex gap-3">
      <UserAvatar user={comment.user} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold">{comment.user?.name ?? "Deleted user"}</span>
          <span className="text-muted-foreground" title={new Date(comment.created_at).toLocaleString()}>
            {timeAgo(comment.created_at)}
            {comment.edited_at && " · edited"}
          </span>
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} aria-label="Edit comment" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={!body.trim() || save.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{comment.body}</p>
        )}
        {!editing && (comment.can?.update || comment.can?.delete) && (
          <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
            {comment.can?.update && (
              <button type="button" className="hover:text-foreground" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {comment.can?.delete && (
              <button type="button" className="hover:text-destructive" onClick={() => remove.mutate()}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
