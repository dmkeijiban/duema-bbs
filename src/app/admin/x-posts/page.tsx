import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { WeeklyGenerateButton } from './WeeklyGenerateButton'
import { PostListClient } from './PostListClient'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export default async function XPostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    generated?: string
    deleted?: string
    bulk_typefully?: string
    bulk_scheduled?: string
    bulk_errors?: string
    status_updated?: string
  }>
}) {
  if (!(await isAdmin())) redirect('/admin')
  const sp = await searchParams

  const supabase = createAdminClient()
  const { data: posts, error } = await supabase
    .from('x_posts')
    .select('*')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(500)

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🐦 X投稿管理</h1>
        <div className="flex items-center gap-2">
          <WeeklyGenerateButton />
          <Link
            href="/admin/x-posts/new"
            className="px-3 py-1.5 text-xs text-white font-medium rounded"
            style={{ background: '#0d6efd' }}
          >
            ＋ 新規作成
          </Link>
          <Link href="/admin" className="text-xs text-gray-500 hover:underline">
            ← 管理画面
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-gray-600 mb-4 rounded">
        <p>X（Twitter）投稿の下書き管理・Typefully連携・スケジュール管理ができます。</p>
        <p>投稿を作成後「Typefullyに送る」ボタンで下書きが自動登録されます。</p>
      </div>

      {/* Success / error banners */}
      {sp.generated && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 text-xs mb-4 rounded">
          ✅ {sp.generated} 件の投稿を下書きとして作成しました（status: draft）
        </div>
      )}
      {sp.deleted && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 text-xs mb-4 rounded">
          🗑 {sp.deleted} 件を削除しました
        </div>
      )}
      {sp.bulk_typefully && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 text-xs mb-4 rounded">
          📨 Typefully送信完了：
          {sp.bulk_scheduled && Number(sp.bulk_scheduled) > 0
            ? `予約下書き ${sp.bulk_scheduled} 件 / 通常下書き ${Number(sp.bulk_typefully) - Number(sp.bulk_scheduled)} 件`
            : `送信成功 ${sp.bulk_typefully} 件`}
          {sp.bulk_errors && Number(sp.bulk_errors) > 0 ? `、失敗 ${sp.bulk_errors} 件` : ''}
        </div>
      )}
      {sp.status_updated && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 text-xs mb-4 rounded">
          ✅ {sp.status_updated} 件のステータスを変更しました
        </div>
      )}
      {sp.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs mb-4 rounded">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs mb-4 rounded">
          DBエラー: {error.message}
        </div>
      )}

      {/* Post list */}
      <PostListClient posts={posts ?? []} />
    </div>
  )
}
