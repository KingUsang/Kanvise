export type StudentRosterExportRow = {
  kanvise_user_id?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  enrolments?: unknown[] | null
}

const EXPORT_HEADERS = ['Kanvise ID', 'First Name', 'Last Name', 'Email', 'Enrolments Count']

export function clampRosterPage(currentPage: number, totalPages: number) {
  return Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1))
}

export function neutralizeSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: string | number) {
  const safeValue = neutralizeSpreadsheetFormula(String(value))
  return `"${safeValue.replace(/"/g, '""')}"`
}

export function serializeStudentRosterCsv(students: StudentRosterExportRow[]) {
  const rows = students.map((student) => [
    student.kanvise_user_id || '',
    student.first_name || '',
    student.last_name || '',
    student.email || '',
    student.enrolments?.length || 0,
  ])
  return [EXPORT_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function downloadStudentRosterCsv(students: StudentRosterExportRow[]) {
  if (!students.length) return false
  const url = URL.createObjectURL(new Blob([serializeStudentRosterCsv(students)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'student_roster.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}
