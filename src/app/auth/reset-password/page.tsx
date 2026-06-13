import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    redirect('/auth/forgot-password?error=session_expired')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">新しいパスワードの設定</h1>
        </div>
        <div className="space-y-4 p-4">
          <ResetPasswordForm />
          <Link
            href="/login"
            className="block w-full rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
          >
            ログインへ戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
