import { useQuery } from "@tanstack/react-query"
import { useTable } from "@tanstack/react-table"
import { Link, useSearchParams } from "react-router-dom"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { DataTable } from "@/components/app/data-table"
import { columnHelper, features } from "@/components/app/data-table-columns"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useDebounced } from "@/hooks/use-debounced"
import { api } from "@/lib/api"
import { formatTimestamp } from "@/lib/format-timestamp"
import type { AuditEntry, Paginated } from "@/lib/types"

const helper = columnHelper<AuditEntry>()
const columns = helper.columns([
  helper.accessor("created_at", { header: "When", meta: { mobile: "subtitle", className: "w-36 whitespace-nowrap" }, cell: (info) => formatTimestamp(info.getValue()) }),
  helper.accessor((entry) => entry.user_name ?? "System", { id: "user", header: "User" }),
  helper.accessor("subject_label", {
    header: "Record",
    meta: { mobile: "title" },
    cell: (info) => {
      const entry = info.row.original
      const to = entry.task_id ? `/tasks/${entry.task_id}` : entry.subject_type === "Project" && entry.subject_id ? `/projects/${entry.subject_id}` : null
      const label = info.getValue() ?? entry.subject_type
      return to ? (
        <Link to={to} className="font-medium hover:underline" onClick={(event) => event.stopPropagation()}>
          {label}
        </Link>
      ) : (
        <span className="font-medium">{label}</span>
      )
    },
  }),
  helper.accessor("summary", { header: "What", cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span> }),
])

const types = ["Task", "Project", "User", "Role", "Auth", "WorkflowTemplate"]
const empty: AuditEntry[] = []

export default function AuditLogPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const type = params.get("type") ?? ""
  const page = Number(params.get("page") ?? 1)
  const debounced = useDebounced(q, 300)
  const log = useQuery({
    queryKey: ["audit-log", debounced, type, page],
    queryFn: async () => (await api.get<Paginated<AuditEntry>>("/audit-log", { params: { search: debounced || undefined, subject_type: type || undefined, page } })).data,
  })
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== "page") next.delete("page")
    setParams(next, { replace: true })
  }
  const table = useTable({ features, columns, data: log.data?.data ?? empty, getRowId: (entry) => String(entry.id), initialState: { pagination: { pageIndex: 0, pageSize: 50 } } })

  return (
    <>
      <PageHeader title="Audit log" description="Every recorded change: tasks, workflow moves, projects, members, users, roles and sign-ins. Entries cannot be edited." />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search text, user or record" value={q} onChange={(event) => setParam("q", event.target.value)} aria-label="Search" />
        </div>
        <NativeSelect value={type} onChange={(event) => setParam("type", event.target.value)} aria-label="Record type">
          <NativeSelectOption value="">All records</NativeSelectOption>
          {types.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <ErrorAlert error={log.error} />
      {log.isLoading ? <Loading /> : <DataTable table={table} pagination={false} />}
      {log.data?.meta && log.data.meta.last_page > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
            Newer
          </button>
          <span className="tabular-nums">
            {page} / {log.data.meta.last_page}
          </span>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={page >= log.data.meta.last_page} onClick={() => setParam("page", String(page + 1))}>
            Older
          </button>
        </div>
      )}
    </>
  )
}
