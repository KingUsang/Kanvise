import { AddClassSubjectClient } from '@/components/dashboard/classes/add-class-subject-client'

export default async function AddClassSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AddClassSubjectClient classId={id} />
}
