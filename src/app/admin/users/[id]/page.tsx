import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { RankExcludedForm } from './RankExcludedForm'

type AdminUserProfile = {
  id: string
  display_name: string | null
  profile_slug: string | null
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  created_at: string | null
  updated_at: string | null
  last_login_at: string | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
  rank_excluded: boolean | null
  account_suspended: boolean | null
  withdrawn_at: string | null
}

type UserThreadRow = {
  id: number
  title: string | null
  post_count: number | null
  created_at: string | null
}

type UserPostRow = {
  id: number
  thread_id: number
  post_number: number | null
  body: string | null
  created_at: string | null
  threads: { title: string | null } | null
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminCookie)) {
    redirect('/admin')
  }
}

function formatDateTime(value: string | null) {
  if (!value) return '-'

  return new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function excerpt(value: string | null, max = 80) {
  if (!value) return '(本文なし)'
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

function safeExternalLink(value: string | null, allowedHosts: string[]) {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (!allowedHosts.includes(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

async function getProfile(id: string): Promise<AdminUserProfile | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, display_name, profile_slug, bio, x_url, youtube_url, created_at, updated_at, last_login_at, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch admin user profile:', error.message)
    return null
  }

  return data as AdminUserProfile | null
}

async function getUserThreads(id: string): Promise<UserThreadRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('threads')
    .select('id, title, post_count, created_at')
    .eq('user_id', id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch admin user threads:', error.message)
    return []
  }
  return (data ?? []) as UserThreadRow[]
}

async function getUserPosts(id: string): Promise<UserPostRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('posts')
    .select('id, thread_id, post_number, body, created_at, threads!inner(title, is_archived)')
    .eq('user_id', id)
    .eq('is_deleted', false)
    .eq('threads.is_archived', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch admin user posts:', error.message)
    return []
  }
  return (data ?? []) as unknown as UserPostRow[]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <div className="mt-0.5 text-sm text-gray-800 break-words">{children}</div>
    </div>
  )
}

function BoolTag({ value }: { value: boolean | null }) {
  return value ? (
    <span className="inline-flex items-center border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
      ON
    </span>
  ) : (
    <span className="inline-flex items-center border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">
      OFF
    </span>
  )
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()

  const { id } = await params
  const profile = await getProfile(id)

  if (!profile) {
    notFound()
  }

  const [threads, posts] = await Promise.all([
    getUserThreads(profile.id),
    getUserPosts(profile.id),
  ])

  const slug = profile.profile_slug ?? ''
  const xUrl = safeExternalLink(profile.x_url, ['x.com', 'twitter.com'])
  const youtubeUrl = safeExternalLink(profile.youtube_url, [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ])

  return (
    <div className="mx-auto max-w-screen-md px-3 py-4 text-sm">
      <div className="mb-4">
        <div className="mb-1 text-xs text-gray-500">
          <Link href="/admin" className="text-blue-600 hover:underline">
            管理TOP
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <Link href="/admin/users" className="text-blue-600 hover:underline">
            登録ユーザー
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span>ユーザー詳細</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 break-words">
          {profile.display_name || '(表示名未設定)'}
        </h1>
      </div>

      <div className="mb-4 border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        この詳細ページで行える操作は「ランキング除外 (rank_excluded) の ON/OFF」だけです。
        停止・BAN・投稿/コメント削除・退会処理はこのページからは行いません。
      </div>

      <section className="mb-4 border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
          プロフィール情報
        </div>
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          <Field label="表示名">{profile.display_name || '(未設定)'}</Field>
          <Field label="profile_slug">
            <span className="font-mono">{slug || '-'}</span>
          </Field>
          <Field label="投稿者ページ">
            {slug ? (
              <Link
                href={`/u/${slug}`}
                className="text-blue-600 hover:underline"
                target="_blank"
              >
                /u/{slug}
              </Link>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Field>
          <Field label="X URL">
            {xUrl ? (
              <a
                href={xUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {xUrl}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Field>
          <Field label="YouTube URL">
            {youtubeUrl ? (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {youtubeUrl}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Field>
          <Field label="作成日">{formatDateTime(profile.created_at)}</Field>
          <Field label="更新日">{formatDateTime(profile.updated_at)}</Field>
          <Field label="最終ログイン">{formatDateTime(profile.last_login_at)}</Field>
          <Field label="退会日時 (withdrawn_at)">
            {profile.withdrawn_at ? formatDateTime(profile.withdrawn_at) : '-'}
          </Field>
          <Field label="プロフィール非公開 (profile_hidden)">
            <BoolTag value={profile.profile_hidden} />
          </Field>
          <Field label="ランキング参加 (ranking_enabled)">
            <BoolTag value={profile.ranking_enabled} />
          </Field>
          <Field label="ランキング除外 (rank_excluded)">
            <BoolTag value={profile.rank_excluded} />
          </Field>
          <Field label="アカウント停止 (account_suspended)">
            <BoolTag value={profile.account_suspended} />
          </Field>
        </div>
        <div className="border-t border-gray-200 px-3 py-2">
          <p className="text-[11px] text-gray-500">自己紹介 (bio)</p>
          {profile.bio ? (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400">-</p>
          )}
        </div>
        <div className="border-t border-gray-200 px-3 py-2">
          <p className="text-[11px] text-gray-500">
            id: <span className="font-mono">{profile.id}</span>
          </p>
        </div>
      </section>

      <section className="mb-4 border border-red-200 bg-white">
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          管理操作：ランキング除外 (rank_excluded)
        </div>
        <div className="p-3">
          <RankExcludedForm
            targetId={profile.id}
            currentExcluded={profile.rank_excluded === true}
          />
        </div>
      </section>

      <section className="mb-4 border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
          最近立てたスレ（最新10件・アーカイブ除外）
        </div>
        {threads.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-gray-500">
            表示できるスレッドはありません。
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {threads.map(thread => (
              <li key={thread.id} className="px-3 py-2">
                <Link
                  href={`/thread/${thread.id}`}
                  className="text-sm text-blue-600 hover:underline break-words"
                  target="_blank"
                >
                  {thread.title || '(無題)'}
                </Link>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {formatDateTime(thread.created_at)}
                  {typeof thread.post_count === 'number' && (
                    <span className="ml-2">レス{thread.post_count}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-4 border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
          最近のコメント（最新10件・削除＆アーカイブ除外）
        </div>
        {posts.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-gray-500">
            表示できるコメントはありません。
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {posts.map(post => (
              <li key={post.id} className="px-3 py-2">
                <Link
                  href={
                    post.post_number
                      ? `/thread/${post.thread_id}#${post.post_number}`
                      : `/thread/${post.thread_id}`
                  }
                  className="text-sm text-gray-800 hover:underline break-words"
                  target="_blank"
                >
                  {excerpt(post.body)}
                </Link>
                <p className="mt-0.5 text-[11px] text-gray-500 break-words">
                  {post.threads?.title && (
                    <span className="text-gray-600">{post.threads.title}</span>
                  )}
                  <span className="ml-2">{formatDateTime(post.created_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">
          ← 登録ユーザー一覧へ戻る
        </Link>
      </div>
    </div>
  )
}
