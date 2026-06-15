import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { WithdrawAccountForm } from '@/components/WithdrawAccountForm'

export default async function WithdrawPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login?next=/mypage/withdraw')

  return (
    <main className="mx-auto w-full max-w-[1100px] px-3 py-4">
      <div className="w-full border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">退会</h1>
        </div>
        <div className="p-4">
          <WithdrawAccountForm />
        </div>
      </div>
    </main>
  )
}
