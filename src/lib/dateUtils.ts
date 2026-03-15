/**
 * Date utilities for Locustworks
 * All week calculations use Monday as the first day of the week.
 */

/**
 * Return the Monday of the ISO week containing `date`.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? -6 : 1 - day // shift so Mon = 0
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Return an array of 7 Date objects for Mon–Sun of the week starting on `weekStart`.
 */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

/**
 * Format a Date as "YYYY-MM-DD" (ISO date string, no time component).
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format a week range like "10–16 Mar 2026" or "28 Feb – 6 Mar 2026".
 */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()
  const startMonth = weekStart.toLocaleString('en-GB', { month: 'short' })
  const endMonth = weekEnd.toLocaleString('en-GB', { month: 'short' })
  const year = weekEnd.getFullYear()

  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${endMonth} ${year}`
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`
}

/**
 * Calculate gross minutes between two "HH:MM" or "HH:MM:SS" time strings.
 * Handles overnight shifts (end < start) by adding 24 hours.
 */
export function timeDiffMinutes(startTime: string, endTime: string): number {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  let diff = toMins(endTime) - toMins(startTime)
  if (diff < 0) diff += 24 * 60 // overnight
  return diff
}

/**
 * Format a shift duration as "Xh Ym" (net of break).
 * e.g. formatShiftDuration("09:00", "17:30", 30) → "8h 0m"
 */
export function formatShiftDuration(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): string {
  const gross = timeDiffMinutes(startTime, endTime)
  const net = Math.max(0, gross - breakMinutes)
  const h = Math.floor(net / 60)
  const m = net % 60
  return `${h}h ${m}m`
}

/**
 * Format a DB time string "HH:MM:SS" → "HH:MM".
 */
export function formatTime(time: string): string {
  return time.slice(0, 5)
}

/**
 * Format a Date or ISO date string as "Thu 13 Mar".
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Format minutes as "Xh Ym" (e.g. 90 → "1h 30m").
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Return true if two ISO date strings represent the same day as today.
 */
export function isToday(isoDate: string): boolean {
  return isoDate === toISODate(new Date())
}
