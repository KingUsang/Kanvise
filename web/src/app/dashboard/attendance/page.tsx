import { AttendanceClient } from '@/components/dashboard/attendance/attendance-client'

export const metadata = {
  title: 'Attendance | Kanvise',
}

// The dashboard layout already verifies the session and redirects signed-out visitors.
export default function AttendancePage() {
  return (
    <div className="animate-in fade-in duration-500">
      <AttendanceClient />
    </div>
  )
}
