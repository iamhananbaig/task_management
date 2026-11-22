import * as React from "react"
import { cn } from "cn"

/** Header, footer (and first column) stay put while a long or wide table scrolls inside its box. */
const STICKY =
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th]:bg-card [&_thead_th]:shadow-[inset_0_-1px_0_var(--border)] " +
  "[&_tfoot_td]:sticky [&_tfoot_td]:bottom-0 [&_tfoot_td]:z-20 [&_tfoot_td]:bg-muted [&_tfoot_td]:shadow-[inset_0_1px_0_var(--border)]"
const STICKY_FIRST =
  "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:z-10 [&_tbody_tr>*:first-child]:bg-card " +
  "[&_tbody_tr:hover>*:first-child]:bg-muted [&_thead_tr>*:first-child]:z-30 [&_tfoot_tr>*:first-child]:z-30 " +
  "[&_tr>*:first-child]:shadow-[inset_-1px_0_0_var(--border)]"

function Table({
  className,
  sticky,
  stickyFirst,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & {
  /** Keep the header and footer visible: the table scrolls inside a box at most ~the window height. */
  sticky?: boolean
  /** Also keep the first column visible when scrolling sideways. */
  stickyFirst?: boolean
  containerClassName?: string
}) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        sticky && "max-h-[calc(100svh-11rem)] overflow-y-auto overscroll-contain",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs", sticky && STICKY, stickyFirst && STICKY_FIRST, className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
