import { ProgrammesClient } from '@/components/dashboard/programmes/programmes-client'

// The database still calls this aggregate a programme. The product calls it a
// Class; keeping the adapter at the route boundary avoids a destructive rename.
export default function ClassesPage() {
  return <ProgrammesClient />
}
