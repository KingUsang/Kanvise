export interface AttendanceEvent {
  id?: string
  student_id: string
  live_class_id: string
  joined_at?: string
  duration_seconds?: number | null
}

export function attendancePairKey(event: Pick<AttendanceEvent, 'student_id' | 'live_class_id'>) {
  return `${event.live_class_id}:${event.student_id}`
}

export function uniqueAttendancePairCount(events: AttendanceEvent[]) {
  return new Set(events.map(attendancePairKey)).size
}

export function summariseStudentEvents(events: AttendanceEvent[]) {
  const eventsWithArrival = events.filter(
    (event): event is AttendanceEvent & { joined_at: string } => Boolean(event.joined_at),
  )
  if (eventsWithArrival.length === 0) return null

  const earliest = eventsWithArrival.reduce((currentEarliest, event) => {
    return new Date(event.joined_at).getTime() < new Date(currentEarliest.joined_at).getTime()
      ? event
      : currentEarliest
  })

  return {
    earliest,
    totalDurationSeconds: eventsWithArrival.reduce(
      (total, event) => total + (event.duration_seconds || 0),
      0,
    ),
  }
}
