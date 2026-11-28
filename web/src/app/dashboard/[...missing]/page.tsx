import { notFound } from 'next/navigation'

// Any /dashboard/* path that is not a real page shows the shell's Not
// available page (dashboard/not-found.tsx) instead of the site-wide 404.
export default function MissingDashboardPage() {
  notFound()
}
