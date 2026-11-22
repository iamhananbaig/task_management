import { useMutation } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import { BellIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { NotificationItem } from "@/features/notifications/NotificationItem"
import { api } from "@/lib/api"
import { useNotifications } from "@/lib/queries"

/** Top-bar bell: unread count and the latest notifications. */
export function NotificationBell() {
  const navigate = useNavigate()
  const notifications = useNotifications()
  const read = useMutation({ mutationFn: async (id: string) => api.post(`/notifications/${id}/read`) })
  const readAll = useMutation({ mutationFn: async () => api.post("/notifications/read-all") })
  const unread = notifications.data?.unread ?? 0
  const latest = notifications.data?.data.slice(0, 8) ?? []

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative" />}>
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-semibold text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => readAll.mutate()}>
              Mark all read
            </button>
          )}
        </div>
        {latest.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {latest.map((notification) => (
              <NotificationItem
                key={notification.id}
                compact
                notification={notification}
                onOpen={() => {
                  if (!notification.read_at) read.mutate(notification.id)
                  navigate(`/tasks/${notification.data.task_id}`)
                }}
              />
            ))}
          </ul>
        )}
        <Link to="/notifications" className="block border-t px-3 py-2 text-center text-xs text-muted-foreground hover:text-foreground">
          See all
        </Link>
      </PopoverContent>
    </Popover>
  )
}
