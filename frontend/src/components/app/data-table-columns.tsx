import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  type ReactTable,
  type RowData,
} from "@tanstack/react-table"

import { Checkbox } from "@/components/ui/checkbox"

/** Features shared by every table in the app: sorting, row selection and client-side pagination. */
export const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
})

export type AppFeatures = typeof features
export type AppTable<TData extends RowData> = ReactTable<AppFeatures, TData>

export function columnHelper<TData extends RowData>() {
  return createColumnHelper<AppFeatures, TData>()
}

/**
 * Column meta understood by DataTable. On phones each row becomes a card: the "title" column heads it,
 * "subtitle" sits under the title, "select" holds the checkbox and "hide" columns are left out.
 */
export type ColumnMeta = {
  align?: "right"
  className?: string
  mobile?: "title" | "subtitle" | "select" | "hide"
}

/** Header and row checkboxes for tables with row selection. */
export function selectionColumn<TData extends RowData>() {
  return columnHelper<TData>().display({
    id: "select",
    enableSorting: false,
    meta: { mobile: "select" },
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={
          table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
        }
        onCheckedChange={(checked) =>
          table.toggleAllRowsSelected(checked === true)
        }
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select row"
      />
    ),
  })
}
