/**
 * Centralized UTC date/time utilities.
 * All timestamps in Onion Flow are stored as Unix milliseconds (UTC).
 * Display formatting uses UTC to ensure consistency across timezones.
 */

/** Returns current UTC timestamp in milliseconds. Wraps Date.now() for testability. */
export function nowUTC(): number {
  return Date.now()
}

/** Formats a timestamp as "YYYY.MM.DD HH:mm" in UTC. */
export function formatDateUTC(ts: number): string {
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${h}:${min}`
}

/** Returns a Korean relative time string (e.g. "방금 전", "5분 전"). Falls back to absolute UTC format. */
export function formatRelativeTime(ts: number): string {
  const diff = nowUTC() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return formatDateUTC(ts)
}

/** Returns ISO date string "YYYY-MM-DD" in UTC. */
export function toISODateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}
