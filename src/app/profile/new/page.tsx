import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { ProfileCreateForm } from './ProfileCreateForm'

export default async function NewProfilePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  if (!user) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    redirect('/')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">プロフィールを作る</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            表示名とURL IDを設定すると、プロフィールやランキング参加に使えるようになります。
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            アカウント作成後も、匿名でのスレッド作成・レス投稿はこれまで通り利用できます。
          </p>
        </div>

        <div className="grid gap-6 p-4 md:grid-cols-[1fr_260px]">
          <section>
            <ProfileCreateForm />
          </section>

          <aside className="rounded border border-yellow-200 bg-yellow-50 p-3 text-xs leading-relaxed text-yellow-900">
            <h2 className="mb-2 text-sm font-bold">注意</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>不適切な表示名・プロフィールは、運営側で修正または非表示にする場合があります。</li>
              <li>なりすましや権利侵害のおそれがある内容は禁止です。</li>
              <li>ランキング参加条件や表示内容は、試験運用中に変更される場合があります。</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  )
}
