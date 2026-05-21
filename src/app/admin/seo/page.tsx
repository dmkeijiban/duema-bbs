import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { SITE_URL } from '@/lib/site-config'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

export const revalidate = 0

export default async function SeoPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = createAdminClient()
  const nowMs = new Date().getTime()

  const [priorityResult, orphanResult] = await Promise.allSettled([
    supabase
      .from('threads')
      .select('id, title, post_count, view_count, last_posted_at, category_id')
      .eq('is_archived', false)
      .gte('post_count', 10)
      .order('post_count', { ascending: false })
      .limit(100),
    supabase
      .from('threads')
      .select('id, title, post_count, view_count, last_posted_at')
      .eq('is_archived', false)
      .is('category_id', null)
      .order('post_count', { ascending: false })
      .limit(50),
  ])

  const priorityThreads = priorityResult.status === 'fulfilled' ? (priorityResult.value.data ?? []) : []
  const orphanThreads = orphanResult.status === 'fulfilled' ? (orphanResult.value.data ?? []) : []

  const sitemapUrl = `${SITE_URL}/sitemap.xml`
  const gscUrl = 'https://search.google.com/search-console'

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理TOP</Link>
          <h1 className="text-lg font-bold text-gray-800">🔍 SEO管理</h1>
        </div>

        {/* Search Console + Sitemap links */}
        <section className="bg-white border border-gray-200 p-4 space-y-2">
          <h2 className="font-semibold text-gray-700 text-sm border-b border-gray-100 pb-1 mb-2">外部ツール</h2>
          <div className="flex flex-wrap gap-2">
            <a href={gscUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50">
              📊 Search Console を開く
            </a>
            <a href={sitemapUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50">
              🗺 sitemap.xml を確認
            </a>
            <a href={`${SITE_URL}/robots.txt`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50">
              🤖 robots.txt を確認
            </a>
          </div>
          <p className="text-[11px] text-gray-400 pt-1">
            Search Console でのサイトマップ送信先: <code className="bg-gray-100 px-1">{sitemapUrl}</code>
          </p>
        </section>

        {/* Priority threads */}
        <section className="bg-white border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 text-sm border-b border-gray-100 pb-1 mb-3">
            優先インデックス対象スレ（レス10件以上・計{priorityThreads.length}件）
          </h2>
          {priorityThreads.length === 0 ? (
            <p className="text-xs text-gray-400">該当なし</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left p-2 border border-gray-100 w-12">ID</th>
                    <th className="text-left p-2 border border-gray-100">タイトル</th>
                    <th className="text-right p-2 border border-gray-100 w-16">レス</th>
                    <th className="text-right p-2 border border-gray-100 w-16">PV</th>
                    <th className="text-left p-2 border border-gray-100 w-32">最終投稿</th>
                    <th className="text-left p-2 border border-gray-100 w-16">優先度</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityThreads.map(t => {
                    const count = t.post_count ?? 0
                    const views = t.view_count ?? 0
                    const lastPosted = t.last_posted_at ? new Date(t.last_posted_at) : null
                    const isRecent = lastPosted && (nowMs - lastPosted.getTime()) < 3 * 86400 * 1000
                    let priority = count >= 50 ? 0.9 : count >= 20 ? 0.85 : count >= 10 ? 0.8 : 0.7
                    if (views >= 500) priority = Math.min(0.95, priority + 0.05)
                    else if (views >= 100) priority = Math.min(0.95, priority + 0.03)
                    if (isRecent) priority = Math.min(0.95, priority + 0.02)
                    priority = Math.round(priority * 100) / 100
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="p-2 border border-gray-100 text-gray-400">{t.id}</td>
                        <td className="p-2 border border-gray-100">
                          <a href={`/thread/${t.id}`} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline line-clamp-1">
                            {t.title}
                          </a>
                        </td>
                        <td className="p-2 border border-gray-100 text-right font-mono">{count}</td>
                        <td className="p-2 border border-gray-100 text-right font-mono">{views}</td>
                        <td className="p-2 border border-gray-100 text-gray-500">
                          {lastPosted ? lastPosted.toLocaleDateString('ja-JP') : '-'}
                          {isRecent && <span className="ml-1 text-green-600">●</span>}
                        </td>
                        <td className="p-2 border border-gray-100 font-mono text-blue-700">{priority}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Orphan threads */}
        <section className="bg-white border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 text-sm border-b border-gray-100 pb-1 mb-3">
            孤立スレ（カテゴリ未設定・計{orphanThreads.length}件）
          </h2>
          <p className="text-[11px] text-gray-500 mb-3">
            カテゴリが未設定のスレは「関連スレ」が表示されず内部リンクが途切れます。カテゴリを設定することを推奨します。
          </p>
          {orphanThreads.length === 0 ? (
            <p className="text-xs text-green-600">✓ 孤立スレなし</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left p-2 border border-gray-100 w-12">ID</th>
                    <th className="text-left p-2 border border-gray-100">タイトル</th>
                    <th className="text-right p-2 border border-gray-100 w-16">レス</th>
                    <th className="text-right p-2 border border-gray-100 w-16">PV</th>
                    <th className="text-left p-2 border border-gray-100 w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orphanThreads.map(t => (
                    <tr key={t.id} className="hover:bg-orange-50">
                      <td className="p-2 border border-gray-100 text-gray-400">{t.id}</td>
                      <td className="p-2 border border-gray-100">
                        <a href={`/thread/${t.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline line-clamp-1">
                          {t.title}
                        </a>
                      </td>
                      <td className="p-2 border border-gray-100 text-right font-mono">{t.post_count ?? 0}</td>
                      <td className="p-2 border border-gray-100 text-right font-mono">{t.view_count ?? 0}</td>
                      <td className="p-2 border border-gray-100">
                        <Link href={`/admin?thread=${t.id}`}
                          className="text-blue-600 hover:underline">編集</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
