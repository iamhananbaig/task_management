import * as React from "react"
import { WarningCircleIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <Alert variant="destructive" className="mb-4">
      <WarningCircleIcon />
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  )
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Spinner /> {label}
    </div>
  )
}

/** An empty list that says why, and what to do next. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <Empty className="border border-dashed py-10">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "warning" | "danger"
}) {
  return (
    <div
      className={cn(
        "@container min-w-0 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3",
        tone === "warning" && "border-amber-500/40",
        tone === "danger" && "border-destructive/40"
      )}
    >
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums @[10rem]:text-base @[13rem]:text-lg">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** Small label/value list for summaries ("Start date: 01-Jul-2024"). */
export function Description({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
