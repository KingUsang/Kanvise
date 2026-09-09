import { redirect } from 'next/navigation'

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  redirect(`/dashboard/student/mocks/attempt/${attemptId}`)
}
