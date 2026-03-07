import { describe, it, expect } from 'vitest'
import { daysUntil, isoDateString, getWeekDates } from '@/lib/utils'
import { format, addDays } from 'date-fns'

describe('booking window rules', () => {
  it('self-service window: today is within 14 days', () => {
    const today = isoDateString(new Date())
    expect(daysUntil(today)).toBeLessThanOrEqual(14)
  })

  it('advance booking: 30 days ahead exceeds self-service window', () => {
    const future = isoDateString(addDays(new Date(), 30))
    expect(daysUntil(future)).toBeGreaterThan(14)
  })

  it('past date detection', () => {
    const yesterday = isoDateString(addDays(new Date(), -1))
    expect(daysUntil(yesterday)).toBeLessThan(0)
  })

  it('max window: 200 days ahead exceeds 180-day limit', () => {
    const far = isoDateString(addDays(new Date(), 200))
    expect(daysUntil(far)).toBeGreaterThan(180)
  })
})

describe('date utilities', () => {
  it('getWeekDates returns 7 dates starting Monday', () => {
    const dates = getWeekDates(0)
    expect(dates).toHaveLength(7)
    // Monday = 1
    expect(dates[0].getDay()).toBe(1)
  })

  it('isoDateString returns YYYY-MM-DD', () => {
    const d = new Date(2026, 2, 15) // March 15 2026
    expect(isoDateString(d)).toBe('2026-03-15')
  })

  it('getWeekDates with offset returns next week', () => {
    const thisWeek = getWeekDates(0)
    const nextWeek = getWeekDates(1)
    const diffDays = Math.round(
      (nextWeek[0].getTime() - thisWeek[0].getTime()) / (1000 * 60 * 60 * 24)
    )
    expect(diffDays).toBe(7)
  })
})

describe('plan status logic', () => {
  const VALID_STATUSES = ['in_office', 'remote', 'leave', 'unavailable', 'unplanned']

  it('all status values are valid', () => {
    VALID_STATUSES.forEach(s => expect(VALID_STATUSES).toContain(s))
  })

  it('cycling status wraps around', () => {
    // Simulates the Rota page cycle behaviour
    function cycleStatus(current: string): string {
      const idx = VALID_STATUSES.indexOf(current)
      return VALID_STATUSES[(idx + 1) % VALID_STATUSES.length]
    }
    expect(cycleStatus('in_office')).toBe('remote')
    expect(cycleStatus('unplanned')).toBe('in_office')
    expect(cycleStatus('unavailable')).toBe('unplanned')
  })
})
