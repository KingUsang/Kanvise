/**
 * One display policy for assignment deadlines across the Tutor list, the Learner page and the
 * public share-link page: a fixed locale, date and time, and the viewer's timezone abbreviation so
 * the due time is never ambiguous for people in other timezones.
 */
const deadlineFormatter = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

export function formatDeadline(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : deadlineFormatter.format(date)
}
