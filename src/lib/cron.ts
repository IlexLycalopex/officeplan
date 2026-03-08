/**
 * Simple cron parser/builder for 5-field expressions (minute hour dom month dow).
 * We only support the subset used in OfficePlan: specific minute, specific hour, * dom, * month, day list or *.
 */

export interface CronParts {
  minute: number   // 0-59
  hour: number     // 0-23
  days: number[]   // 0=Sun … 6=Sat; empty means * (every day)
}

/** Parse a 5-field cron string into CronParts (best-effort). */
export function parseCron(expr: string): CronParts {
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return { minute: 0, hour: 8, days: [1] }

  const [minuteStr, hourStr, , , dowStr] = parts

  const minute = parseInt(minuteStr, 10)
  const hour   = parseInt(hourStr, 10)

  let days: number[] = []
  if (dowStr !== '*') {
    // Handle "1-5", "1,3", "1" etc.
    const segments = dowStr.split(',')
    for (const seg of segments) {
      if (seg.includes('-')) {
        const [from, to] = seg.split('-').map(Number)
        for (let d = from; d <= to; d++) days.push(d)
      } else {
        const n = parseInt(seg, 10)
        if (!isNaN(n)) days.push(n)
      }
    }
  }

  return {
    minute: isNaN(minute) ? 0 : minute,
    hour:   isNaN(hour)   ? 8 : hour,
    days,
  }
}

/** Build a 5-field cron string from CronParts. */
export function buildCron({ minute, hour, days }: CronParts): string {
  const dow = days.length === 0 ? '*' : days.sort((a, b) => a - b).join(',')
  return `${minute} ${hour} * * ${dow}`
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Return a human-readable description of a CronParts. */
export function describeCron({ minute, hour, days }: CronParts): string {
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  if (days.length === 0) return `Every day at ${timeStr}`
  if (days.length === 7) return `Every day at ${timeStr}`

  const sorted = [...days].sort((a, b) => a - b)
  const dayNames = sorted.map(d => DAY_NAMES[d] ?? String(d))

  // Check for weekdays / weekends shorthand
  const weekdays = [1, 2, 3, 4, 5]
  const weekend  = [0, 6]
  if (JSON.stringify(sorted) === JSON.stringify(weekdays)) return `Weekdays at ${timeStr}`
  if (JSON.stringify(sorted) === JSON.stringify(weekend))  return `Weekends at ${timeStr}`

  return `Every ${dayNames.join(', ')} at ${timeStr}`
}
