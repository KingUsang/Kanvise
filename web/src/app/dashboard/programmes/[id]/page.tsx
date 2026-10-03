import { redirect } from 'next/navigation'

export default async function ManageProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/classes/${id}`)
}
