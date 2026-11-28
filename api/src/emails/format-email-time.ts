/**
 * Times in emails (18 NTF-04, NTF-09): the account's timezone with the zone
 * named, plus the student's own time when it is different.
 *
 *   formatEmailTime(start, 'Africa/Lagos')                    -> '4:00 PM WAT'
 *   formatEmailTime(start, 'Africa/Lagos', 'Africa/Accra')    -> '4:00 PM WAT (3:00 PM your time)'
 *   formatEmailDateTime(start, 'Africa/Lagos')                -> 'Mon 1 Dec, 4:00 PM WAT'
 *   formatEmailDay(start, 'Africa/Lagos', now)                -> 'today' | 'tomorrow' | 'Mon 1 Dec'
 *
 * "Today", "tomorrow" and day names are worked out in the same zone as the
 * time beside them.
 */

export const DEFAULT_ACCOUNT_TIME_ZONE = 'Africa/Lagos'

/**
 * Accounts have no timezone setting yet (20 DM-14; 12 CFG-A ships in step 9),
 * so every account uses Kanvise's launch timezone. When the setting exists,
 * read it here; every email already goes through this function.
 */
export async function resolveAccountTimeZone(_schoolId: string): Promise<string> {
  return DEFAULT_ACCOUNT_TIME_ZONE
}

// Zones where Intl only offers 'GMT+1' style names. The names are the ones
// people in those places use.
const zoneNameOverrides: Record<string, string> = {
  'Africa/Lagos': 'WAT',
  'Africa/Abuja': 'WAT',
  'Africa/Douala': 'WAT',
  'Africa/Kinshasa': 'WAT',
  'Africa/Luanda': 'WAT',
  'Africa/Niamey': 'WAT',
  'Africa/Porto-Novo': 'WAT',
  'Africa/Accra': 'GMT',
  'Africa/Abidjan': 'GMT',
  'Africa/Dakar': 'GMT',
  'Africa/Freetown': 'GMT',
  'Africa/Monrovia': 'GMT',
  'Africa/Banjul': 'GMT',
  'Africa/Nairobi': 'EAT',
  'Africa/Kampala': 'EAT',
  'Africa/Dar_es_Salaam': 'EAT',
  'Africa/Addis_Ababa': 'EAT',
  'Africa/Mogadishu': 'EAT',
  'Africa/Kigali': 'CAT',
  'Africa/Lusaka': 'CAT',
  'Africa/Harare': 'CAT',
  'Africa/Maputo': 'CAT',
  'Africa/Blantyre': 'CAT',
  'Africa/Gaborone': 'CAT',
  'Africa/Windhoek': 'CAT',
  'Africa/Johannesburg': 'SAST',
  'Africa/Maseru': 'SAST',
  'Africa/Mbabane': 'SAST',
}

function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_ACCOUNT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
    return timeZone
  } catch {
    return DEFAULT_ACCOUNT_TIME_ZONE
  }
}

function shortZoneName(instant: Date, timeZone: string, locale: string): string {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
    .formatToParts(instant)
    .find((item) => item.type === 'timeZoneName')
  return part?.value ?? 'UTC'
}

/** 'WAT', 'GMT', 'BST', 'EST'. Falls back to 'GMT+1' style when nothing better exists. */
export function zoneName(instant: Date, timeZone: string): string {
  const zone = safeZone(timeZone)
  const override = zoneNameOverrides[zone]
  if (override) return override
  const offsetStyle = /^(GMT|UTC)[+-]/
  const us = shortZoneName(instant, zone, 'en-US')
  if (!offsetStyle.test(us)) return us
  const gb = shortZoneName(instant, zone, 'en-GB')
  return offsetStyle.test(gb) ? us : gb
}

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Email time must be a valid date')
  return date
}

function clockTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(instant)
    .replace(/\u202f|\u00a0/g, ' ')
}

/** 'Mon 1 Dec' in the zone. */
export function formatEmailDate(value: Date | string, timeZone: string): string {
  const instant = toDate(value)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone(timeZone), weekday: 'short', day: 'numeric', month: 'short',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}`
}

function calendarDay(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

/** 'today', 'tomorrow' or 'Mon 1 Dec', worked out in the zone. */
export function formatEmailDay(value: Date | string, timeZone: string, now: Date = new Date()): string {
  const instant = toDate(value)
  const zone = safeZone(timeZone)
  const day = calendarDay(instant, zone)
  if (day === calendarDay(now, zone)) return 'today'
  // Noon avoids daylight-saving edges when stepping a calendar day forward.
  const [year, month, date] = calendarDay(now, zone).split('-').map(Number)
  const tomorrow = new Date(Date.UTC(year, month - 1, date + 1, 12))
  if (day === tomorrow.toISOString().slice(0, 10)) return 'tomorrow'
  return formatEmailDate(instant, zone)
}

/**
 * '4:00 PM WAT', or '4:00 PM WAT (3:00 PM your time)' when the student's clock
 * shows a different time. When the student's day is different too, it is
 * named: '11:00 PM WAT (Tue 2 Dec, 12:00 AM your time)'.
 */
export function formatEmailTime(value: Date | string, accountTimeZone: string, studentTimeZone?: string | null): string {
  const instant = toDate(value)
  const zone = safeZone(accountTimeZone)
  const main = `${clockTime(instant, zone)} ${zoneName(instant, zone)}`
  if (!studentTimeZone) return main
  const studentZone = safeZone(studentTimeZone)
  const theirs = clockTime(instant, studentZone)
  const sameDay = calendarDay(instant, zone) === calendarDay(instant, studentZone)
  if (theirs === clockTime(instant, zone) && sameDay) return main
  return sameDay
    ? `${main} (${theirs} your time)`
    : `${main} (${formatEmailDate(instant, studentZone)}, ${theirs} your time)`
}

/** 'Mon 1 Dec, 4:00 PM WAT', with the student's time added as in formatEmailTime. */
export function formatEmailDateTime(value: Date | string, accountTimeZone: string, studentTimeZone?: string | null): string {
  return `${formatEmailDate(value, accountTimeZone)}, ${formatEmailTime(value, accountTimeZone, studentTimeZone)}`
}
