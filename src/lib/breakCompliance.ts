/**
 * Break compliance calculations — mirrors Postgres fn_calculate_break_compliance().
 *
 * UK Working Time Regulations 1998 default:
 *   Every 6 continuous hours of work requires at least 15 minutes of rest.
 *   Additional 15 minutes is required for each additional 6-hour block.
 */

export interface BreakRule {
  trigger_hours: number
  break_duration_minutes: number
}

export interface ComplianceResult {
  /** Net hours worked (after deducting break) */
  netHoursWorked: number
  /** Number of 6-hour (or trigger-hour) blocks in the net worked time */
  blocksWorked: number
  /** Total break minutes required by the rule */
  requiredBreakMinutes: number
  /** How many minutes short the actual break is (0 if compliant) */
  shortfallMinutes: number
  /** True when actual break ≥ required break */
  compliant: boolean
}

/** UK WTR 1998 default rule used when no org-specific rule is configured */
export const UK_DEFAULT_RULE: BreakRule = {
  trigger_hours: 6,
  break_duration_minutes: 15,
}

/**
 * Calculate break compliance for a shift.
 *
 * @param startTime - "HH:MM" or "HH:MM:SS"
 * @param endTime   - "HH:MM" or "HH:MM:SS" (may be next day)
 * @param actualBreakMinutes - Minutes of break actually taken
 * @param rule - The break rule to apply (defaults to UK_DEFAULT_RULE)
 */
export function calculateBreakCompliance(
  startTime: string,
  endTime: string,
  actualBreakMinutes: number,
  rule: BreakRule = UK_DEFAULT_RULE,
): ComplianceResult {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  let grossMinutes = toMins(endTime) - toMins(startTime)
  if (grossMinutes < 0) grossMinutes += 24 * 60 // overnight shift

  // Net time = gross − break taken
  const netMinutes = Math.max(0, grossMinutes - actualBreakMinutes)
  const netHoursWorked = netMinutes / 60

  // How many complete trigger-hour blocks in net worked time?
  const blocksWorked = Math.floor(netHoursWorked / rule.trigger_hours)

  // Required break = blocks × break_duration_minutes
  const requiredBreakMinutes = blocksWorked * rule.break_duration_minutes

  const shortfallMinutes = Math.max(0, requiredBreakMinutes - actualBreakMinutes)
  const compliant = shortfallMinutes === 0

  return {
    netHoursWorked,
    blocksWorked,
    requiredBreakMinutes,
    shortfallMinutes,
    compliant,
  }
}

/**
 * Return a human-readable description of the break requirement.
 * e.g. "A 15-minute break is required for shifts over 6 hours"
 */
export function describeRequiredBreak(rule: BreakRule = UK_DEFAULT_RULE): string {
  return `A ${rule.break_duration_minutes}-minute break is required for shifts over ${rule.trigger_hours} hours`
}

/**
 * Return a badge label for a compliance result.
 */
export function complianceBadge(result: ComplianceResult): string {
  if (result.requiredBreakMinutes === 0) return 'No break required'
  if (result.compliant) return 'Break compliant'
  return `${result.shortfallMinutes}m break shortfall`
}
