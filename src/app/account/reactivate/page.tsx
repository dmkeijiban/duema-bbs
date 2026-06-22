import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { ReactivateAccountForm } from '@/components/ReactivateAccountForm'

export const dynamic = 'force-dynamic'

export default async function ReactivateAccountPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  if (!user) {
    redirect('/login?next=/account/reactivate')
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  // プロフィール未作成 → 通常の新規作成へ。
  if (!profile) {
    redirect('/profile/new')
  }

  // 退会済みでなければ再開画面は不要。マイページへ。
  if (!profile.withdrawn_at) {
    redirect('/mypage')
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-3 py-4">
      <div className="w-full border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">アカウントの再開</h1>
        </div>
        <div className="p-4">
          <ReactivateAccountForm />
        </div>
      </div>
    </main>
  )
}
