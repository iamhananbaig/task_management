import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ChecksIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { NotificationItem } from "@/features/notifications/NotificationItem"
import { api } from "@/lib/api"
import { useNotifications } from "@/lib/queries"

export default function NotificationsPage() {
  const navigate = useNavigate()
  const notifications = useNotifications()
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
      {notifications.data?.data.length === 0 && <EmptyState title="No notifications" />}
      <ul className="divide-y rounded-lg border empty:hidden">
        {notifications.data?.data.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onOpen={() => {
              if (!notification.read_at) read.mutate(notification.id)
              navigate(`/tasks/${notification.data.task_id}`)
            }}
          />
        ))}
      </ul>
    </>
  )
}
