import DirectAssignmentClient from './public-assignment'

export default async function DirectAssignmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <DirectAssignmentClient token={token} />
}
