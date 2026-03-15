import { describe, it, expect } from 'vitest'
import {
  getWeekStart,
  getWeekDays,
  toISODate,
  formatWeekRange,
  timeDiffMinutes,
  formatShiftDuration,
  formatTime,
  formatMinutes,
} from '@/lib/dateUtils'

// Fixed reference date: Thursday 12 March 2026
const THU_12_MAR = new Date(2026, 2, 12) // month is 0-indexed
const MON_9_MAR = new Date(2026, 2, 9)
const SUN_15_MAR = new Date(2026, 2, 15)

describe('getWeekStart', () => {
  it('returns Monday for a Thursday', () => {
    const start = getWeekStart(THU_12_MAR)
    expect(toISODate(start)).toBe('2026-03-09')
    expect(start.getDay()).toBe(1)
  })

  it('returns Monday itself for a Monday', () => {
    const start = getWeekStart(MON_9_MAR)
    expect(toISODate(start)).toBe('2026-03-09')
  })

  it('returns the PREVIOUS Monday for a Sunday', () => {
    // Sun 15 Mar 2026 → Mon 9 Mar 2026
    const start = getWeekStart(SUN_15_MAR)
    expect(toISODate(start)).toBe('2026-03-09')
  })

  it('returns Monday for a Saturday', () => {
    const sat = new Date(2026, 2, 14) // Sat 14 Mar
    const start = getWeekStart(sat)
    expect(toISODate(start)).toBe('2026-03-09')
  })
})

describe('getWeekDays', () => {
  it('returns 7 days starting from Monday', () => {
    const days = getWeekDays(MON_9_MAR)
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(1) // Monday
    expect(days[6].getDay()).toBe(0) // Sunday
  })

  it('spans the correct date range', () => {
    const days = getWeekDays(MON_9_MAR)
    expect(toISODate(days[0])).toBe('2026-03-09')
    expect(toISODate(days[6])).toBe('2026-03-15')
  })

  it('each day is exactly 1 day apart', () => {
    const days = getWeekDays(MON_9_MAR)
    for (let i = 1; i < days.length; i++) {
      const diff = (days[i].getTime() - days[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      expect(diff).toBe(1)
    }
  })
})

describe('toISODate', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 2, 15))).toBe('2026-03-15')
  })

  it('zero-pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('formatWeekRange', () => {
  it('same-month range', () => {
    // Mon 9 – Sun 15 Mar 2026
    const result = formatWeekRange(MON_9_MAR)
    expect(result).toBe('9–15 Mar 2026')
  })

  it('cross-month range', () => {
    // Mon 30 Mar – Sun 5 Apr 2026
    const mon30 = new Date(2026, 2, 30)
    const result = formatWeekRange(mon30)
    expect(result).toContain('Mar')
    expect(result).toContain('Apr')
    expect(result).toContain('2026')
  })
})

describe('timeDiffMinutes', () => {
  it('simple daytime shift', () => {
    expect(timeDiffMinutes('09:00', '17:00')).toBe(480)
  })

  it('shift with minutes', () => {
    expect(timeDiffMinutes('08:30', '16:45')).toBe(495)
  })

  it('overnight shift', () => {
    // 23:00 → 07:00 = 8h
    expect(timeDiffMinutes('23:00', '07:00')).toBe(480)
  })

  it('short overnight', () => {
    // 23:30 → 01:00 = 1.5h = 90m
    expect(timeDiffMinutes('23:30', '01:00')).toBe(90)
  })

  it('same time returns 0', () => {
    expect(timeDiffMinutes('12:00', '12:00')).toBe(0)
  })
})

describe('formatShiftDuration', () => {
  it('8h with no break', () => {
    expect(formatShiftDuration('09:00', '17:00', 0)).toBe('8h 0m')
  })

  it('8h with 30m break = 7h 30m', () => {
    expect(formatShiftDuration('09:00', '17:00', 30)).toBe('7h 30m')
  })

  it('6h with 15m break = 5h 45m', () => {
    expect(formatShiftDuration('09:00', '15:00', 15)).toBe('5h 45m')
  })

  it('overnight 10h with 30m break = 9h 30m', () => {
    expect(formatShiftDuration('22:00', '08:00', 30)).toBe('9h 30m')
  })

  it('break longer than shift → 0 net', () => {
    expect(formatShiftDuration('09:00', '09:30', 60)).toBe('0h 0m')
  })
})

describe('formatTime', () => {
  it('strips seconds from HH:MM:SS', () => {
    expect(formatTime('09:00:00')).toBe('09:00')
  })

  it('keeps HH:MM unchanged', () => {
    expect(formatTime('17:30')).toBe('17:30')
  })
})

describe('formatMinutes', () => {
  it('less than 1 hour shows minutes only', () => {
    expect(formatMinutes(45)).toBe('45m')
  })

  it('exactly 1 hour shows hours only', () => {
    expect(formatMinutes(60)).toBe('1h')
  })

  it('1h 30m', () => {
    expect(formatMinutes(90)).toBe('1h 30m')
  })

  it('0 minutes', () => {
    expect(formatMinutes(0)).toBe('0m')
  })
})
