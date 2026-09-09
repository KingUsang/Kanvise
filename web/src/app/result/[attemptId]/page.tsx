import { redirect } from 'next/navigation'

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  redirect(`/dashboard/student/mocks/result/${attemptId}`)
}
