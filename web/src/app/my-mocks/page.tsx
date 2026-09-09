import { redirect } from 'next/navigation'

export default async function MyMocksPage() {
  redirect('/dashboard/student/mocks?view=unlocked')
}
