import {
  CalendarBlankIcon,
  CaretDoubleUpIcon,
  CaretDownIcon,
  CaretUpIcon,
  EqualsIcon,
} from "@phosphor-icons/react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { priorityLabels, swatch } from "@/lib/labels"
import type { Priority, Status, UserSummary } from "@/lib/types"
import { cn, daysFromToday, formatDate, formatShortDate, initials } from "@/lib/utils"

/** A project status as a coloured pill. */
export function StatusBadge({ status, className }: { status?: Pick<Status, "name" | "color"> | null; className?: string }) {
  if (!status) return null
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded px-1.5 text-[0.7rem] font-semibold whitespace-nowrap",
        swatch(status.color).badge,
        className
      )}
    >
      {status.name}
    </span>
  )
}

/** Small coloured dot (status / project colour). */
export function ColorDot({ color, className }: { color: string | null | undefined; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", swatch(color).dot, className)} aria-hidden="true" />
}

const priorityIcon = {
  urgent: { icon: CaretDoubleUpIcon, className: "text-destructive" },
  high: { icon: CaretUpIcon, className: "text-orange-600 dark:text-orange-400" },
  medium: { icon: EqualsIcon, className: "text-amber-600 dark:text-amber-400" },
  low: { icon: CaretDownIcon, className: "text-sky-600 dark:text-sky-400" },
} as const

/** Priority as an icon (with tooltip), or icon + label. */
export function PriorityMark({ priority, showLabel, className }: { priority: Priority; showLabel?: boolean; className?: string }) {
  const { icon: Icon, className: tone } = priorityIcon[priority]
  const mark = (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <Icon weight="bold" className={cn("size-3.5", tone)} aria-label={`${priorityLabels[priority]} priority`} />
      {showLabel && priorityLabels[priority]}
    </span>
  )
  if (showLabel) return mark
  return (
    <Tooltip>
      <TooltipTrigger render={mark} />
      <TooltipContent>{priorityLabels[priority]} priority</TooltipContent>
    </Tooltip>
  )
}

/** Due date: red when overdue, amber when due within 2 days, muted once done. */
export function DueDate({ date, done, className }: { date: string | null; done?: boolean; className?: string }) {
  if (!date) return null
  const days = daysFromToday(date)
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : formatShortDate(date)
  return (
    <span
      title={`Due ${formatDate(date)}`}
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
        done
          ? "text-muted-foreground"
          : days < 0
            ? "font-medium text-destructive"
            : days <= 2
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground",
        className
      )}
    >
      <CalendarBlankIcon className="size-3.5" />
      {label}
    </span>
  )
}

/** Initials avatar with the user's name in a tooltip. */
export function UserAvatar({ user, size = "sm", className }: { user?: UserSummary | null; size?: "sm" | "default"; className?: string }) {
  if (!user) return null
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Avatar size={size} className={className}>
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
        }
      />
      <TooltipContent>{user.name}</TooltipContent>
    </Tooltip>
  )
}

/** Avatar and name in one line ("Unassigned" when empty). */
export function UserName({ user, empty = "Unassigned" }: { user?: UserSummary | null; empty?: string }) {
  if (!user) return <span className="text-muted-foreground">{empty}</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar size="sm">
        <AvatarFallback>{initials(user.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{user.name}</span>
    </span>
  )
}
