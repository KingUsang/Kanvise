import { ClassRecordingViewer } from "@/components/student/class-recording-viewer";

export default async function StudentClassRecordingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ClassRecordingViewer sessionId={sessionId} />;
}
