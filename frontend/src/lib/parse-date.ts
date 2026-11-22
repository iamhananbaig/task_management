const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const pad = (n: number) => String(n).padStart(2, "0")
export const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`


/**
 * Parse typed text to Y-m-d. Accepts 2024-07-01, 01-Jul-2024, 1 Jul 24 and DAY-FIRST 01/07/2024.
 * Returns null when the text is not a real date.
 */
export function parseTypedDate(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  let y: number, m: number, d: number
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text)
  if (match) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else if ((match = /^(\d{1,2})[-/.\s]+([a-z]{3,})[-/.\s,]+(\d{2,4})$/i.exec(text))) {
    const idx = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase())
    if (idx < 0) return null
    ;[d, m, y] = [Number(match[1]), idx + 1, Number(match[3])]
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(text))) {
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else {
    return null
  }
  if (y < 100) y += 2000
  const check = new Date(y, m - 1, d)
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null
  return toYmd(y, m, d)
}
