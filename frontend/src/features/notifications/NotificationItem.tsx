import { BellIcon, ChatCircleIcon, ClockIcon, UserPlusIcon, WarningIcon, ArrowsLeftRightIcon } from "@phosphor-icons/react"

import type { AppNotification } from "@/lib/types"
import { cn, timeAgo } from "@/lib/utils"

const icons: Record<string, typeof BellIcon> = {
  assigned: UserPlusIcon,
  review_assigned: UserPlusIcon,
  moved: ArrowsLeftRightIcon,
  commented: ChatCircleIcon,
  due_soon: ClockIcon,
  overdue: WarningIcon,
}

export function NotificationItem({ notification, onOpen, compact }: { notification: AppNotification; onOpen: () => void; compact?: boolean }) {
  const Icon = icons[notification.data.kind] ?? BellIcon
  const unread = !notification.read_at
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn("flex w-full gap-3 px-3 text-left hover:bg-muted/50", compact ? "py-2" : "py-3", unread && "bg-primary/5")}>
        <Icon className={cn("mt-0.5 size-4 shrink-0", notification.data.kind === "overdue" ? "text-destructive" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm", unread && "font-semibold")}>{notification.data.title}</div>
          <div className={cn("text-xs text-muted-foreground", compact && "line-clamp-2")}>{notification.data.body}</div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">{timeAgo(notification.created_at)}</div>
        </div>
        {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>
    </li>
  )
}
