// Reporting periods for dashboards (DEV-DSH-004). Boundaries are computed in an
// explicit IANA timezone instead of the API host's local zone.

export const DEFAULT_REPORTING_TIMEZONE = 'Africa/Lagos'

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** Requested zone if valid, else DASHBOARD_REPORTING_TIMEZONE, else Africa/Lagos. */
export function resolveReportingTimezone(requested?: string | null) {
  if (isValidTimezone(requested)) return requested
  const configured = process.env.DASHBOARD_REPORTING_TIMEZONE
  return isValidTimezone(configured) ? configured : DEFAULT_REPORTING_TIMEZONE
}

function zoneOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

function localDate(at: Date, timeZone: string) {
  const shifted = new Date(at.getTime() + zoneOffsetMs(at, timeZone))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() }
}

/** UTC instant of local midnight for a local calendar date (day may overflow the month). */
function localMidnight(year: number, month: number, day: number, timeZone: string) {
  const guess = Date.UTC(year, month, day)
  let result = guess - zoneOffsetMs(new Date(guess), timeZone)
  // A DST change between the guess and the result shifts the offset once more.
  const corrected = guess - zoneOffsetMs(new Date(result), timeZone)
  if (corrected !== result) result = corrected
  return new Date(result)
}

export function reportingPeriods(now: Date, timeZone: string) {
  const { year, month, day } = localDate(now, timeZone)
  const todayStart = localMidnight(year, month, day, timeZone)
  const tomorrowStart = localMidnight(year, month, day + 1, timeZone)
  return {
    timezone: timeZone,
    todayStart,
    todayEnd: new Date(tomorrowStart.getTime() - 1),
    monthStart: localMidnight(year, month, 1, timeZone),
    // End of the local day seven days from today, inclusive.
    sevenDayEnd: new Date(localMidnight(year, month, day + 8, timeZone).getTime() - 1),
  }
}
