// Same helpers as frontend/src/lib/utils.ts (keep in step).

const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-11-22" → "22-Nov-2026". */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const parts = dateStr.slice(0, 10).split("-")
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  return `${d.padStart(2, "0")}-${monthsShort[parseInt(m, 10) - 1]}-${y}`
}

/** "22 Nov" (this year) or "22 Nov 2025". */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.slice(0, 10).split("-")
  const label = `${parseInt(d, 10)} ${monthsShort[parseInt(m, 10) - 1]}`
  return Number(y) === new Date().getFullYear() ? label : `${label} ${y}`
}

/** Today as Y-m-d in local time. */
export function todayYmd(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Whole days from today to the date (negative = past). */
export function daysFromToday(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number)
  const target = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`
  return formatDate(iso)
}

/** "Ali Member" → "AM". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

/** 1536 → "1.5 KB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
