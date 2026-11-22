const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "14-Nov-2026 09:42" in local time. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
