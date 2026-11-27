import { redirect } from 'next/navigation'

// The unlocked-Quiz library was retired with standalone Quizzes. Quizzes now live inside a Class.
export default async function MyMocksPage() {
  redirect('/dashboard/student/mocks')
}
