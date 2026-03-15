import { describe, it, expect } from 'vitest'
import {
  calculateBreakCompliance,
  describeRequiredBreak,
  complianceBadge,
  UK_DEFAULT_RULE,
  type BreakRule,
} from '@/lib/breakCompliance'

const UK = UK_DEFAULT_RULE // 6h trigger, 15m break

describe('calculateBreakCompliance — UK WTR 1998 default rule', () => {
  it('shift under 6h requires no break and is compliant', () => {
    // 5h 59m gross, 0 break → net 5h 59m = 0 full 6h blocks
    const result = calculateBreakCompliance('09:00', '14:59', 0, UK)
    expect(result.blocksWorked).toBe(0)
    expect(result.requiredBreakMinutes).toBe(0)
    expect(result.compliant).toBe(true)
  })

  it('exactly 6h net with no break is NOT compliant (1 full block)', () => {
    // 6h gross, 0 break → net 6h = 1 full block → need 15m
    const result = calculateBreakCompliance('09:00', '15:00', 0, UK)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(15)
    expect(result.shortfallMinutes).toBe(15)
    expect(result.compliant).toBe(false)
  })

  it('6h gross with 15m break is compliant (net 5h 45m = 0 full blocks)', () => {
    const result = calculateBreakCompliance('09:00', '15:00', 15, UK)
    expect(result.netHoursWorked).toBeCloseTo(5.75)
    expect(result.blocksWorked).toBe(0)
    expect(result.compliant).toBe(true)
  })

  it('8h shift with 30m break: net 7h 30m = 1 block → 15m required', () => {
    // 7.5h > 6h → 1 block → need 15m, have 30m → compliant
    const result = calculateBreakCompliance('09:00', '17:00', 30, UK)
    expect(result.netHoursWorked).toBeCloseTo(7.5)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(15)
    expect(result.compliant).toBe(true)
  })

  it('12h shift with 0 break: net 12h = 2 blocks → 30m required', () => {
    const result = calculateBreakCompliance('07:00', '19:00', 0, UK)
    expect(result.blocksWorked).toBe(2)
    expect(result.requiredBreakMinutes).toBe(30)
    expect(result.shortfallMinutes).toBe(30)
    expect(result.compliant).toBe(false)
  })

  it('12h shift with 15m break: net 11h 45m = 1 block → 15m required → compliant', () => {
    const result = calculateBreakCompliance('07:00', '19:00', 15, UK)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(15)
    expect(result.compliant).toBe(true)
  })

  it('12h shift with 30m break: net 11h 30m = 1 block → compliant', () => {
    const result = calculateBreakCompliance('07:00', '19:00', 30, UK)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(15)
    expect(result.compliant).toBe(true)
  })
})

describe('calculateBreakCompliance — overnight shifts', () => {
  it('overnight shift 23:00–07:00 (8h gross, 0 break): net 8h = 1 block', () => {
    const result = calculateBreakCompliance('23:00', '07:00', 0, UK)
    expect(result.netHoursWorked).toBeCloseTo(8)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(15)
    expect(result.compliant).toBe(false)
  })

  it('overnight 22:00–06:00 (8h) with 15m break: compliant', () => {
    const result = calculateBreakCompliance('22:00', '06:00', 15, UK)
    expect(result.netHoursWorked).toBeCloseTo(7.75)
    expect(result.blocksWorked).toBe(1)
    expect(result.compliant).toBe(true)
  })

  it('short overnight 23:30–02:00 (2.5h): no break needed', () => {
    const result = calculateBreakCompliance('23:30', '02:00', 0, UK)
    expect(result.netHoursWorked).toBeCloseTo(2.5)
    expect(result.blocksWorked).toBe(0)
    expect(result.compliant).toBe(true)
  })
})

describe('calculateBreakCompliance — custom rules', () => {
  const customRule: BreakRule = { trigger_hours: 4, break_duration_minutes: 20 }

  it('4h trigger, 20m break — 5h shift with 0 break: 1 block, 20m required', () => {
    const result = calculateBreakCompliance('09:00', '14:00', 0, customRule)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(20)
    expect(result.compliant).toBe(false)
  })

  it('4h trigger — 3h 59m shift: 0 blocks, compliant', () => {
    const result = calculateBreakCompliance('09:00', '12:59', 0, customRule)
    expect(result.blocksWorked).toBe(0)
    expect(result.compliant).toBe(true)
  })

  it('4h trigger — 8h shift with 20m break: net 7h 40m = 1 block → compliant', () => {
    const result = calculateBreakCompliance('09:00', '17:00', 20, customRule)
    expect(result.netHoursWorked).toBeCloseTo(7.667, 1)
    expect(result.blocksWorked).toBe(1)
    expect(result.requiredBreakMinutes).toBe(20)
    expect(result.compliant).toBe(true)
  })
})

describe('describeRequiredBreak', () => {
  it('uses UK default rule', () => {
    const desc = describeRequiredBreak(UK)
    expect(desc).toContain('15')
    expect(desc).toContain('6')
  })

  it('uses custom rule values', () => {
    const desc = describeRequiredBreak({ trigger_hours: 4, break_duration_minutes: 20 })
    expect(desc).toContain('20')
    expect(desc).toContain('4')
  })
})

describe('complianceBadge', () => {
  it('returns "No break required" when 0 blocks worked', () => {
    const result = calculateBreakCompliance('09:00', '12:00', 0, UK)
    expect(complianceBadge(result)).toBe('No break required')
  })

  it('returns "Break compliant" when sufficient break taken', () => {
    // 09:00–16:00 = 7h gross, -15m break → net 6h 45m = 1 block → 15m required, 15m taken
    const result = calculateBreakCompliance('09:00', '16:00', 15, UK)
    expect(complianceBadge(result)).toBe('Break compliant')
  })

  it('returns shortfall message when break insufficient', () => {
    const result = calculateBreakCompliance('09:00', '15:00', 0, UK)
    expect(complianceBadge(result)).toContain('shortfall')
    expect(complianceBadge(result)).toContain('15m')
  })
})
