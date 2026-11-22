import { monthLabel } from "@/features/reports/month-label"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"


type Row = { month: string; value: number | null; detail?: string }

/**
 * One measure by month as columns (single series: no legend — the card title names it).
 * Thin columns with a rounded cap, hairline grid, a per-column tooltip; the same figures are
 * in the table beneath each chart.
 */
export function MonthChart({
  rows,
  color,
  format = (value) => String(value),
  domain,
  label,
}: {
  rows: Row[]
  color: string
  format?: (value: number) => string
  domain?: [number, number]
  label: string
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis domain={domain} allowDecimals={false} tickFormatter={(value: number) => format(value)} width={44} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined
              if (!active || !row) return null
              return (
                <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
                  <div className="font-semibold">{monthLabel(row.month)}</div>
                  <div className="tabular-nums">{row.value === null ? "No tasks due" : format(row.value)}</div>
                  {row.detail && <div className="text-muted-foreground">{row.detail}</div>}
                </div>
              )
            }}
          />
          <Bar dataKey="value" fill={color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
