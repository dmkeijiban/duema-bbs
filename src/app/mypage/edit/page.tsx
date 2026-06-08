import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import ProfileEditForm from './ProfileEditForm'

type EditableProfile = {
  display_name: string | null
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
}

async function getMyProfile(userId: string): Promise<EditableProfile | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('display_name, bio, x_url, youtube_url, profile_hidden, ranking_enabled')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch profile for edit:', error.message)
    return null
  }

  return data
}

export default async function MyPageEdit() {
  let user: User | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login?next=/mypage/edit')
  }

  if (!user) {
    redirect('/login?next=/mypage/edit')
  }

  const profile = await getMyProfile(user.id)

  if (!profile) {
    redirect('/profile/new')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <div className="mb-1 text-xs text-gray-500">
            <Link href="/mypage" className="text-blue-600 hover:underline">
              マイページ
            </Link>
            <span className="mx-2 text-gray-300">/</span>
            <span>プロフィール編集</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">プロフィール編集</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            表示名・自己紹介・SNSリンク・公開設定を変更できます。URL ID（slug）やアイコンはここでは変更できません。
          </p>
        </div>

        <div className="p-4">
          <ProfileEditForm
            initialDisplayName={profile.display_name ?? ''}
            initialBio={profile.bio ?? ''}
            initialXUrl={profile.x_url ?? ''}
            initialYoutubeUrl={profile.youtube_url ?? ''}
            initialProfileHidden={!!profile.profile_hidden}
            initialRankingEnabled={profile.ranking_enabled !== false}
          />
        </div>
      </div>
    </main>
  )
}
