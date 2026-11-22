import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ChecksIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { NotificationItem } from "@/features/notifications/NotificationItem"
import { api } from "@/lib/api"
import { useNotifications } from "@/lib/queries"
import type { AppNotification } from "@/lib/types"
import { daysFromToday } from "@/lib/utils"

/** "Today", "Yesterday", "Earlier this week", "Older": a heading per group. */
function dayGroup(iso: string): string {
  // Local calendar day of the timestamp (the API sends UTC)
  const at = new Date(iso)
  const days = -daysFromToday(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return "Earlier this week"
  return "Older"
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const notifications = useNotifications(unreadOnly)
  const groups: { label: string; items: AppNotification[] }[] = []
  for (const notification of notifications.data?.data ?? []) {
    const label = dayGroup(notification.created_at)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(notification)
    else groups.push({ label, items: [notification] })
  }
  const readAll = useMutation({ mutationFn: async () => api.post("/notifications/read-all") })
  const read = useMutation({ mutationFn: async (id: string) => api.post(`/notifications/${id}/read`) })

  return (
    <>
      <PageHeader title="Notifications" description="Assignments, workflow moves, comments and due-date reminders.">
        <Button variant="outline" disabled={!notifications.data?.unread} onClick={() => readAll.mutate()}>
          <ChecksIcon /> Mark all read
        </Button>
      </PageHeader>
      <ErrorAlert error={notifications.error} />
      {notifications.isLoading && <Loading />}
      <div className="mb-4 flex items-center gap-2">
        <Checkbox id="unread-only" checked={unreadOnly} onCheckedChange={(checked) => setUnreadOnly(checked === true)} />
        <Label htmlFor="unread-only" className="text-sm font-normal">
          Unread only
        </Label>
      </div>
      {notifications.data?.data.length === 0 && (
        <EmptyState title={unreadOnly ? "All caught up" : "No notifications"} description={unreadOnly ? "You have read everything." : undefined} />
      )}
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h2>
            <ul className="divide-y rounded-lg border">
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={() => {
                    if (!notification.read_at) read.mutate(notification.id)
                    navigate(notification.data.task_id ? `/tasks/${notification.data.task_id}` : `/runs/${notification.data.run_id}`)
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
