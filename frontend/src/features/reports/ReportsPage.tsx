import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { DownloadSimpleIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading, Stat } from "@/components/app/shared"
import { TagFilter } from "@/components/app/tag-filter"
import { Button } from "@/components/ui/button"
import { DatePickerInput } from "@/components/ui/date-picker"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MonthChart } from "@/features/reports/MonthChart"
import { monthLabel } from "@/features/reports/month-label"
import { RunRow } from "@/features/routines/RunProgress"
import { api } from "@/lib/api"
import { exportExcel } from "@/lib/exporters"
import { useProjects, useUserOptions } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Run } from "@/lib/types"
import { cn } from "@/lib/utils"

type OnTimeCounts = { due: number; on_time: number; late: number; overdue: number; pending: number; on_time_pct: number | null }
type Report = {
  from: string
  to: string
  on_time: {
    total: OnTimeCounts
    by_person: (OnTimeCounts & { user_id: number | null; name: string })[]
    by_month: (OnTimeCounts & { month: string })[]
  }
  review_time: { by_reviewer: { user_id: number | null; name: string; reviews: number; avg_hours: number | null; max_hours: number | null; waiting_now: number }[] }
  overdue: { month: string; overdue: number; as_of: string }[]
  runs: Run[]
}

const pct = (value: number | null) => (value === null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`)
const hours = (value: number | null) => (value === null ? "—" : value < 48 ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} h` : `${(value / 24).toLocaleString(undefined, { maximumFractionDigits: 1 })} d`)

/** Team performance for a date range: on-time completion, review time, overdue trend, periods. */
export default function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const filters = {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    project_id: params.get("project") ?? "",
    tag_id: params.get("tag") ?? "",
    user_id: params.get("user") ?? "",
  }
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const projects = useProjects()
  const users = useUserOptions()
  const report = useQuery({
    queryKey: ["reports", filters],
    queryFn: async () => (await api.get<Report>("/reports", { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) })).data,
  })
  const [exporting, setExporting] = React.useState(false)

  const data = report.data
  const reviewed = data?.review_time.by_reviewer.filter((row) => row.reviews > 0) ?? []
  const avgReview = reviewed.length ? reviewed.reduce((sum, row) => sum + (row.avg_hours ?? 0) * row.reviews, 0) / reviewed.reduce((sum, row) => sum + row.reviews, 0) : null

  const exportAll = async () => {
    if (!data) return
    setExporting(true)
    try {
      await exportExcel(`Task report ${data.from} to ${data.to}`, [
        {
          title: "On time by person",
          rows: data.on_time.by_person,
          columns: [
            { header: "Person", value: (row) => row.name, width: 24 },
            { header: "Due", value: (row) => row.due, type: "number" },
            { header: "On time", value: (row) => row.on_time, type: "number" },
            { header: "Late", value: (row) => row.late, type: "number" },
            { header: "Open overdue", value: (row) => row.overdue, type: "number" },
            { header: "Not yet due", value: (row) => row.pending, type: "number" },
            { header: "On time %", value: (row) => row.on_time_pct, type: "percent" },
          ],
        },
        {
          title: "On time by month",
          rows: data.on_time.by_month,
          columns: [
            { header: "Month", value: (row) => row.month },
            { header: "Due", value: (row) => row.due, type: "number" },
            { header: "On time", value: (row) => row.on_time, type: "number" },
            { header: "Late", value: (row) => row.late, type: "number" },
            { header: "Open overdue", value: (row) => row.overdue, type: "number" },
            { header: "On time %", value: (row) => row.on_time_pct, type: "percent" },
          ],
        },
        {
          title: "Review time",
          rows: data.review_time.by_reviewer,
          columns: [
            { header: "Reviewer", value: (row) => row.name, width: 24 },
            { header: "Reviews", value: (row) => row.reviews, type: "number" },
            { header: "Average hours", value: (row) => row.avg_hours, type: "number" },
            { header: "Longest hours", value: (row) => row.max_hours, type: "number" },
            { header: "Waiting now", value: (row) => row.waiting_now, type: "number" },
          ],
        },
        {
          title: "Overdue at month end",
          rows: data.overdue,
          columns: [
            { header: "Month", value: (row) => row.month },
            { header: "As of", value: (row) => row.as_of },
            { header: "Open overdue", value: (row) => row.overdue, type: "number" },
          ],
        },
        {
          title: "Periods",
          rows: data.runs,
          columns: [
            { header: "Period", value: (row) => row.name, width: 36 },
            { header: "Project", value: (row) => row.project?.name, width: 24 },
            { header: "Period end", value: (row) => row.period_end },
            { header: "Tasks", value: (row) => row.progress.total, type: "number" },
            { header: "Done", value: (row) => row.progress.done, type: "number" },
            { header: "Done on time", value: (row) => row.progress.on_time, type: "number" },
            { header: "Overdue", value: (row) => row.progress.overdue, type: "number" },
          ],
        },
      ])
    } catch {
      toast.error("Could not create the Excel file.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader title="Reports" description="On-time completion, review time and overdue work for the projects you can see. Default range: the last 6 months.">
        <Button variant="outline" onClick={exportAll} disabled={!data || exporting}>
          {exporting ? <Spinner /> : <DownloadSimpleIcon />} Export to Excel
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <DatePickerInput id="report-from" label="From" className="w-40" value={filters.from || data?.from || ""} onChange={(value) => setParam("from", value)} />
        <DatePickerInput id="report-to" label="To" className="w-40" value={filters.to || data?.to || ""} onChange={(value) => setParam("to", value)} />
        <NativeSelect value={filters.project_id} onChange={(event) => setParam("project", event.target.value)} aria-label="Project">
          <NativeSelectOption value="">All projects</NativeSelectOption>
          {projects.data?.map((project) => (
            <NativeSelectOption key={project.id} value={project.id}>
              {project.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <TagFilter value={filters.tag_id} onChange={(value) => setParam("tag", value)} />
        <NativeSelect value={filters.user_id} onChange={(event) => setParam("user", event.target.value)} aria-label="Person">
          <NativeSelectOption value="">Everyone</NativeSelectOption>
          {users.data?.map((user) => (
            <NativeSelectOption key={user.id} value={user.id}>
              {user.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <ErrorAlert error={report.error} />
      {report.isLoading && <Loading />}
      {data && (
        <div className={cn("flex flex-col gap-6", report.isFetching && "opacity-60")}>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="Done on time" value={pct(data.on_time.total.on_time_pct)} hint={`${data.on_time.total.on_time} of ${data.on_time.total.on_time + data.on_time.total.late + data.on_time.total.overdue} due and decided`} />
            <Stat label="Done late" value={data.on_time.total.late} />
            <Stat label="Still open past due" value={data.on_time.total.overdue} tone={data.on_time.total.overdue ? "danger" : undefined} />
            <Stat label="Average time in review" value={hours(avgReview)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Done on time, by month due</h2>
              <p className="mb-2 text-xs text-muted-foreground">On time out of tasks due that month that are done or past due.</p>
              <MonthChart
                label="Percentage of tasks done on time by month"
                color="var(--series-1)"
                domain={[0, 100]}
                format={(value) => `${value}%`}
                rows={data.on_time.by_month.map((row) => ({ month: row.month, value: row.on_time_pct, detail: `${row.on_time} on time · ${row.late} late · ${row.overdue} overdue` }))}
              />
              <MonthTable rows={data.on_time.by_month.map((row) => [monthLabel(row.month), String(row.due), String(row.on_time), String(row.late), String(row.overdue), pct(row.on_time_pct)])} headers={["Month", "Due", "On time", "Late", "Overdue", "On time %"]} />
            </section>
            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Open overdue tasks at month end</h2>
              <p className="mb-2 text-xs text-muted-foreground">Tasks past their due date and not done on the last day of each month (this month: today).</p>
              <MonthChart label="Open overdue tasks at each month end" color="var(--series-2)" rows={data.overdue.map((row) => ({ month: row.month, value: row.overdue, detail: `as of ${row.as_of}` }))} />
              <MonthTable rows={data.overdue.map((row) => [monthLabel(row.month), String(row.overdue)])} headers={["Month", "Overdue"]} />
            </section>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">By person (assignee)</h2>
            {data.on_time.by_person.length === 0 ? (
              <EmptyState title="No tasks due in this range" />
            ) : (
              <SimpleTable
                headers={["Person", "Due", "On time", "Late", "Open overdue", "Not yet due", "On time %"]}
                rows={data.on_time.by_person.map((row) => [row.name, row.due, row.on_time, row.late, row.overdue, row.pending, pct(row.on_time_pct)])}
              />
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Review time (by reviewer)</h2>
            {data.review_time.by_reviewer.length === 0 ? (
              <EmptyState title="Nothing was submitted for review in this range" />
            ) : (
              <SimpleTable
                headers={["Reviewer", "Reviews", "Average wait", "Longest wait", "Waiting now"]}
                rows={data.review_time.by_reviewer.map((row) => [row.name, row.reviews, hours(row.avg_hours), hours(row.max_hours), row.waiting_now])}
              />
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Periods (routine runs)</h2>
            {data.runs.length === 0 ? (
              <EmptyState title="No routine periods ended in this range" />
            ) : (
              <div className="flex flex-col divide-y rounded-lg border">
                {data.runs.map((run) => (
                  <RunRow key={run.id} run={run} showProject />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}

/** The chart's figures as a table (collapsed). */
function MonthTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Table</summary>
      <SimpleTable headers={headers} rows={rows} className="mt-2" />
    </details>
  )
}

function SimpleTable({ headers, rows, className }: { headers: string[]; rows: (string | number)[][]; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={header} className={cn(index > 0 && "text-right")}>
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, index) => (
                <TableCell key={index} className={cn(index > 0 && "text-right tabular-nums", index === 0 && "font-medium")}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
