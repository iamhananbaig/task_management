// Export report tables to Excel (.xlsx). The library loads only when someone exports
// (same approach as mess_soft).

export interface ExportColumn<T> {
  header: string
  /** Cell value. Numbers stay numbers in Excel (sortable, summable). */
  value: (row: T) => string | number | null | undefined
  type?: "text" | "number" | "percent"
  width?: number
}

export interface ExportTable<T> {
  /** Sheet name. */
  title: string
  columns: ExportColumn<T>[]
  rows: T[]
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "report"
const sheetName = (s: string) => s.replace(/[[\]*?/\\:]/g, " ").slice(0, 31) || "Sheet"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportExcel(filename: string, tables: ExportTable<any>[]): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser")

  const sheets = tables.map((table) => {
    const header = table.columns.map((column) => ({ value: column.header, fontWeight: "bold" as const }))
    const body = table.rows.map((row) =>
      table.columns.map((column) => {
        const value = column.value(row)
        if (value === null || value === undefined || value === "") return null
        if (column.type === "number" || column.type === "percent") {
          const number = typeof value === "number" ? value : Number(value)
          return Number.isFinite(number)
            ? { type: Number, value: column.type === "percent" ? number / 100 : number, format: column.type === "percent" ? "0.0%" : "#,##0.##" }
            : { type: String, value: String(value) }
        }
        return { type: String, value: String(value) }
      })
    )
    return {
      data: [header, ...body],
      columns: table.columns.map((column) => ({ width: Math.max(10, Math.min(40, column.width ?? column.header.length + 4)) })),
      sheet: sheetName(table.title),
    }
  })

  const blob = await writeXlsxFile(sheets.map((sheet) => ({ data: sheet.data, sheet: sheet.sheet, columns: sheet.columns }))).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${safeName(filename)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
