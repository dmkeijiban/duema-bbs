import { getCachedCategories } from '@/lib/cached-queries'
import { NewThreadFormClient } from './NewThreadFormClient'
import { ArrowLeft, PenSquare } from '@/components/Icons'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'

/** 管理者専用カテゴリ名（このカテゴリはスレ作成を管理者のみに制限） */
export const metadata = {
  title: 'スレッド作成 | デュエマ掲示板',
  robots: { index: false, follow: false },
}

export const ADMIN_ONLY_CATEGORIES = ['管理者連絡']

export default async function NewThreadPage() {
  const allCategories = await getCachedCategories()
  const cookieStore = await cookies()
  const isAdmin = verifyAdminCookie(cookieStore.get('admin_auth')?.value)
  // 管理者でなければ管理者専用カテゴリを非表示にする
  const categories = isAdmin
    ? allCategories
    : allCategories.filter(c => !ADMIN_ONLY_CATEGORIES.includes(c.name))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          スレッド一覧に戻る
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PenSquare className="w-5 h-5 text-indigo-600" />
            スレッドを立てる
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            タイトルと本文には日本語を含めてください（スパム対策）
          </p>
        </div>
        {/* 注意書き */}
        <div className="mx-6 mt-5 px-4 py-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-800 space-y-1 leading-relaxed">
          <p>・重複や似たスレッドがないか必ず確認してください。</p>
          <p>・単発スレは最終更新から一定時間で落ちます。</p>
          <p>・画像は権利を侵害しない物を添付してください。</p>
        </div>
        <NewThreadFormClient categories={categories} />
      </div>
    </div>
  )
}
