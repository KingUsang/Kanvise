import { redirect } from 'next/navigation'

// The old More page is retired (14-old-flows-inventory, 16-responsive R-02):
// on phones More is now a sheet in the bottom bar.
export default function MorePage() {
  redirect('/dashboard')
}
