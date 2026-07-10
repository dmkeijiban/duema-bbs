import { getCachedCategories } from '@/lib/cached-queries'
import { NewThreadFormClient } from './NewThreadFormClient'
import { ArrowLeft, PenSquare } from '@/components/Icons'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase-server'
import { getThreadPollFeatureAvailable } from '@/lib/thread-poll'

/** 管理者専用カテゴリ名（このカテゴリはスレ作成を管理者のみに制限） */
export const metadata = {
  title: 'スレッド作成 | デュエマ掲示板',
  robots: { index: false, follow: false },
}

export const ADMIN_ONLY_CATEGORIES = ['管理者連絡']

export default async function NewThreadPage() {
  const [allCategories, interactiveThreadsEnabled] = await Promise.all([
    getCachedCategories(),
    getThreadPollFeatureAvailable(),
  ])
  const cookieStore = await cookies()
  const isAdmin = verifyAdminCookie(cookieStore.get('admin_auth')?.value)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = Boolean(user)
  // 管理者でなければ管理者専用カテゴリを非表示にする
  const categories = isAdmin
    ? allCategories
    : allCategories.filter(c => !ADMIN_ONLY_CATEGORIES.includes(c.name))

  return (
    <div className="max-w-2xl mx-auto px-3 py-5 sm:px-4 sm:py-8">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          スレッド一覧に戻る
        </Link>
      </div>

      <div className="border border-gray-300 bg-white">
        <div className="px-3 py-2 font-bold text-sm text-white" style={{ background: '#888' }}>
          <h1 className="flex items-center gap-2">
            <PenSquare className="w-4 h-4" />
            スレッドを立てる
          </h1>
        </div>
        <div className="px-3 py-2 text-xs border-b border-gray-200" style={{ background: '#f5f5f5' }}>
          <p className="text-gray-700">
            タイトルと本文には日本語を含めてください（スパム対策）
          </p>
        </div>
        {/* 注意書き */}
        <div className="px-3 py-2 text-xs text-sky-800 leading-relaxed" style={{ background: '#d1ecf1', borderBottom: '1px solid #bee5eb' }}>
          <p>
            投稿する前に、<Link href="/guide" className="underline">投稿ルール</Link>をご確認ください。
          </p>
          {!isLoggedIn && (
            <p className="mt-2">
              <Link href="/login?mode=signup" className="underline">アカウントを作成</Link>すると、プロフィールや投稿管理を利用できます。
              <span className="ml-1">※登録せずに、このまま匿名で投稿することもできます。</span>
            </p>
          )}
        </div>
        <NewThreadFormClient categories={categories} interactiveThreadsEnabled={interactiveThreadsEnabled} />
      </div>
    </div>
  )
}
