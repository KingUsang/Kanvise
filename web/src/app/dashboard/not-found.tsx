import { NotAvailable } from '@/components/shell/not-available'

// Unknown /dashboard/* paths and notFound() calls render inside the shell (SH-14a).
export default function DashboardNotFound() {
  return <NotAvailable />
}
