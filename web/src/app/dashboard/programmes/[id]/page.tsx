import { ProgrammeBuilder } from '@/components/dashboard/programmes/programme-builder'

export default async function ManageProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProgrammeBuilder programmeId={id} />
}
