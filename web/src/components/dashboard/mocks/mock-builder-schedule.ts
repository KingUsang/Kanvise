// The builder's schedule inputs (datetime-local, date, time) are wall-clock values
// in the browser's time zone, and saving converts them with `new Date(local)`.
// Loading must use the same local reading or every edit shifts the schedule by
// the UTC offset (DEV-QUIZ-029).
const pad = (value: number) => String(value).padStart(2, '0')

export function toLocalDateInput(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toLocalTimeInput(iso: string) {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toLocalDateTimeInput(iso: string) {
  return `${toLocalDateInput(iso)}T${toLocalTimeInput(iso)}`
}
