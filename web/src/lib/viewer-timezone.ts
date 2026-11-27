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
