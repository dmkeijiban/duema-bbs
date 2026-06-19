import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { logout } from '@/app/auth/actions'
import { LoginClient } from './LoginClient'

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
    logged_out?: string
    next?: string
    message?: string
    mode?: string
  }>
}

function safeNextPath(value?: string) {
  if (!value) return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

async function getLoginState() {
  let user = null

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    return { user: null, hasProfile: false }
  }

  if (!user) return { user: null, hasProfile: false }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  return { user, hasProfile: Boolean(profile) }
}

function successMessage(code?: string) {
  switch (code) {
    case 'password_reset_done':
      return '新しいパスワードでログインしてください。'
    default:
      return null
  }
}

function errorMessage(code?: string) {
  switch (code) {
    case 'missing_code':
      return 'ログイン情報を受け取れませんでした。もう一度お試しください。'
    case 'callback_failed':
      return 'Googleログインの完了に失敗しました。Supabase/Google設定を確認してください。'
    case 'session_failed':
      return 'ログインセッションを確認できませんでした。もう一度お試しください。'
    case 'profile_check_failed':
      return 'プロフィール確認に失敗しました。時間を置いて再度お試しください。'
    default:
      return null
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const { user, hasProfile } = await getLoginState()
  const message = errorMessage(params?.error)
  const successMsg = successMessage(params?.message)
  const nextPath = safeNextPath(params?.next)
  const initialMode = params?.mode === 'signup' ? 'signup' : 'login'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">ログイン / アカウント作成</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            メールアドレスまたはGoogleアカウントでログイン・アカウント作成できます。アカウントを作成すると、プロフィールの作成、投稿一覧の確認、ランキングへの参加ができます。
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            ログインしなくても、これまで通り匿名でスレッド作成・レス投稿できます。
          </p>
        </div>

        <div className="grid gap-6 p-4 md:grid-cols-[1fr_260px]">
          <section>
            {message && (
              <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {message}
              </p>
            )}

            {successMsg && (
              <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {successMsg}
              </p>
            )}

            {params?.logged_out && (
              <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                ログアウトしました。
              </p>
            )}

            {user ? (
              <div className="space-y-4">
                <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  ログイン済みです。
                </p>

                {!hasProfile && (
                  <Link
                    href="/profile/new"
                    className="block rounded bg-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-700"
                  >
                    プロフィールを作る
                  </Link>
                )}

                {hasProfile && (
                  <Link
                    href="/mypage"
                    className="block rounded bg-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-700"
                  >
                    マイページを開く
                  </Link>
                )}

                <Link
                  href="/"
                  className="block rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
                >
                  掲示板へ戻る
                </Link>

                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    ログアウト
                  </button>
                </form>
              </div>
            ) : (
              <LoginClient nextPath={nextPath} initialMode={initialMode} />
            )}
          </section>

          <aside className="rounded border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
            <h2 className="mb-2 text-sm font-bold">匿名利用について</h2>
            <p>
              ログインしなくても、これまで通り匿名でスレッド作成・レス投稿できます。アカウント機能は、プロフィールやランキングに参加したい方向けの追加機能です。
            </p>
            <h2 className="mb-2 mt-4 text-sm font-bold">スマホでログインできない方へ</h2>
            <p>
              X・LINE・Instagramなどのアプリ内ブラウザでは、Googleログインがうまく動かない場合があります。Safari、Chrome、Edge、Firefoxなどの通常ブラウザで開き直してください。
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
