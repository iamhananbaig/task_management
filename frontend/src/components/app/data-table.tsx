import * as React from "react"
import { type RowData } from "@tanstack/react-table"
import { type AppTable, type ColumnMeta } from "@/components/app/data-table-columns"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsDownUpIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function meta(value: unknown): ColumnMeta {
  return (value as ColumnMeta | undefined) ?? {}
}


export function DataTable<TData extends RowData>({
  table,
  onRowClick,
  footer,
  pagination = true,
  total,
  emptyMessage = "No rows.",
  rowClassName,
  sticky,
}: {
  table: AppTable<TData>
  /** Header, totals and first column stay visible while scrolling (long / wide tables) */
  sticky?: boolean
  onRowClick?: (row: TData) => void
  footer?: React.ReactNode
  pagination?: boolean
  /** Total rows on the server, when pagination happens server-side. */
  total?: number
  emptyMessage?: string
  rowClassName?: (row: TData) => string | undefined
}) {
  const rows = table.getRowModel().rows
  const columnCount = table.getAllLeafColumns().length

  return (
    <div>
      <MobileCards
        table={table}
        onRowClick={onRowClick}
        emptyMessage={emptyMessage}
        footer={footer}
      />
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table sticky={sticky} stickyFirst={sticky}>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const columnMeta = meta(header.column.columnDef.meta)
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        columnMeta.align === "right" && "text-right",
                        columnMeta.className
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            columnMeta.align === "right" && "flex-row-reverse"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUpIcon className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3" />
                          ) : (
                            <ArrowsDownUpIcon className="size-3 opacity-30" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row.original)
                )}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getAllCells().map((cell) => {
                  const columnMeta = meta(cell.column.columnDef.meta)
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        columnMeta.align === "right" && "text-right",
                        columnMeta.className
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
          {footer && <TableFooter>{footer}</TableFooter>}
        </Table>
      </div>
      {pagination && <TablePager table={table} total={total} />}
    </div>
  )
}

function headerLabel(header: unknown, fallback: string): string {
  return typeof header === "string" ? header : fallback
}

function MobileCards<TData extends RowData>({
  table,
  onRowClick,
  emptyMessage,
  footer,
}: {
  table: AppTable<TData>
  onRowClick?: (row: TData) => void
  emptyMessage: string
  footer?: React.ReactNode
}) {
  const rows = table.getRowModel().rows
  const sortable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanSort())
  const sorting = table.state.sorting?.[0]

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {sortable.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Sort by
          <NativeSelect
            size="sm"
            value={
              sorting ? `${sorting.id}:${sorting.desc ? "desc" : "asc"}` : ""
            }
            onChange={(event) => {
              const [id, direction] = event.target.value.split(":")
              table.setSorting(id ? [{ id, desc: direction === "desc" }] : [])
            }}
            aria-label="Sort by"
          >
            <NativeSelectOption value="">Default</NativeSelectOption>
            {sortable.flatMap((column) => {
              const label = headerLabel(column.columnDef.header, column.id)
              return [
                <NativeSelectOption
                  key={`${column.id}:desc`}
                  value={`${column.id}:desc`}
                >
                  {label} ↓
                </NativeSelectOption>,
                <NativeSelectOption
                  key={`${column.id}:asc`}
                  value={`${column.id}:asc`}
                >
                  {label} ↑
                </NativeSelectOption>,
              ]
            })}
          </NativeSelect>
        </div>
      )}
      {rows.length === 0 && (
        <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
      {rows.map((row) => {
        const cells = row.getAllCells()
        const role = (cell: (typeof cells)[number]) =>
          meta(cell.column.columnDef.meta).mobile
        const select = cells.find((cell) => role(cell) === "select")
        const title =
          cells.find((cell) => role(cell) === "title") ??
          cells.find((cell) => !role(cell))
        const subtitle = cells.filter((cell) => role(cell) === "subtitle")
        const details = cells.filter((cell) => cell !== title && !role(cell))
        return (
          <div
            key={row.id}
            className={cn(
              "rounded-lg border bg-card p-3 text-sm",
              row.getIsSelected() && "border-primary/50 bg-primary/5",
              onRowClick && "cursor-pointer active:bg-muted/50"
            )}
            onClick={onRowClick ? () => onRowClick(row.original) : undefined}
          >
            <div className="flex items-start gap-2.5">
              {select && (
                <div
                  className="pt-0.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <table.FlexRender cell={select} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <div className="font-medium [&_*]:max-w-none">
                    <table.FlexRender cell={title} />
                  </div>
                )}
                {subtitle.map((cell) => (
                  <div
                    key={cell.id}
                    className="mt-0.5 text-xs text-muted-foreground"
                  >
                    <table.FlexRender cell={cell} />
                  </div>
                ))}
              </div>
            </div>
            {details.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-2 text-xs">
                {details.map((cell) => {
                  const wide =
                    meta(cell.column.columnDef.meta).align !== "right"
                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        "min-w-0",
                        wide && details.length > 2 && "col-span-2"
                      )}
                    >
                      <dt className="text-muted-foreground">
                        {headerLabel(
                          cell.column.columnDef.header,
                          cell.column.id
                        )}
                      </dt>
                      <dd className="min-w-0 [&_*]:max-w-none">
                        <table.FlexRender cell={cell} />
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
        )
      })}
      {footer && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableFooter>{footer}</TableFooter>
          </Table>
        </div>
      )}
    </div>
  )
}

function TablePager<TData extends RowData>({
  table,
  total,
}: {
  table: AppTable<TData>
  total?: number
}) {
  const { pageIndex, pageSize } = table.state.pagination
  const selected = Object.keys(table.state.rowSelection ?? {}).length

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted-foreground max-md:sticky max-md:bottom-0 max-md:bg-background/95 max-md:pb-2 max-md:backdrop-blur">
      <span>
        {(total ?? table.getRowCount()).toLocaleString()} total
        {selected > 0 && ` · ${selected.toLocaleString()} selected`}
      </span>
      <div className="flex items-center gap-2">
        <NativeSelect
          size="sm"
          value={String(pageSize)}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
          aria-label="Rows per page"
        >
          {[25, 50, 100, 250].map((size) => (
            <NativeSelectOption key={size} value={size}>
              {size} / page
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label="Previous page"
        >
          <CaretLeftIcon />
        </Button>
        <span className="tabular-nums">
          {pageIndex + 1} / {Math.max(1, table.getPageCount())}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label="Next page"
        >
          <CaretRightIcon />
        </Button>
      </div>
    </div>
  )
}
