import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { AdminLoginView } from '../AdminLoginView'

const ADMIN_COOKIE = 'admin_auth'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [cookieStore, sp] = await Promise.all([cookies(), searchParams])

  if (verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }

  return <AdminLoginView error={sp.error} />
}
