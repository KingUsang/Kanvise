import PublicRecording from "./public-recording";

export default async function RecordingPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  return <PublicRecording shareToken={shareToken} />;
}
