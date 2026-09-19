import { WorkspaceHub } from '@/components/dashboard/workspace-hub'

export default function TeachingPage() {
  return <WorkspaceHub
    title="Plan and follow up"
    description="Prepare materials, set work, and see how your learners are doing."
    sections={[
      { title: 'Teach', links: [
        { label: 'Materials', description: 'Share notes and study resources by subject.', href: '/dashboard/notes', icon: 'description' },
        { label: 'Assignments', description: 'Set work and review learner submissions.', href: '/dashboard/assignments', icon: 'assignment' },
      ] },
    ]}
  />
}
