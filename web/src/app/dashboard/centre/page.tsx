import { WorkspaceHub } from '@/components/dashboard/workspace-hub'

export default function CentrePage() {
  return <WorkspaceHub
    title="Run your centre"
    description="Set up learning, support your people, and keep the centre running."
    sections={[
      { title: 'People', links: [
        { label: 'Students', description: 'Invite and manage your learner roster.', href: '/dashboard/students', icon: 'face' },
        { label: 'Tutors', description: 'Invite tutors and manage who teaches.', href: '/dashboard/tutors', icon: 'groups_3' },
      ] },
      { title: 'Learning setup', links: [
        { label: 'Programmes & subjects', description: 'Organise what your centre teaches.', href: '/dashboard/programmes', icon: 'library_books' },
        { label: 'Centre profile', description: 'Update your name, logo and public details.', href: '/dashboard/school-setup', icon: 'settings_applications' },
      ] },
      { title: 'Money', links: [
        { label: 'Payments', description: 'See payments and manage payout details.', href: '/dashboard/payments', icon: 'payments' },
      ] },
    ]}
  />
}
