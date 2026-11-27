/** Name of the viewer's current timezone, e.g. "WAT" or "GMT+1", for labelling schedule times. */
export function viewerTimeZoneLabel(at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-NG', { timeZoneName: 'short' }).formatToParts(at).find(item => item.type === 'timeZoneName')
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return [part?.value, zone].filter(Boolean).join(' · ')
  } catch {
    return ''
  }
}

/** Label for a wall-clock time that is governed by an IANA zone (recurring slots), e.g. "WAT · Africa/Lagos". Falls back to the viewer's zone when the zone is null or invalid. */
export function governingTimeZoneLabel(timezone: string | null | undefined, at: Date = new Date()): string {
  if (!timezone) return viewerTimeZoneLabel(at)
  try {
    const part = new Intl.DateTimeFormat('en-NG', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(at).find(item => item.type === 'timeZoneName')
    return [part?.value, timezone].filter(Boolean).join(' · ')
  } catch {
    return viewerTimeZoneLabel(at)
  }
}

/** Label for an instant shown in the viewer's zone. Names the series zone too when it differs; viewer zone alone when null (one-off Sessions). */
export function instantTimeZoneLabel(timezone: string | null | undefined, at: Date = new Date()): string {
  const viewer = viewerTimeZoneLabel(at)
  if (!timezone) return viewer
  let viewerZone = ''
  try {
    viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // keep empty
  }
  return viewerZone === timezone ? viewer : `${viewer} (series timezone ${timezone})`
}
