import PublicClassroom from './public-classroom'

export default async function LiveLinkPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params
  return <PublicClassroom shareToken={shareToken} />
}
