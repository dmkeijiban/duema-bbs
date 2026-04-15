import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { adminDeleteThread, adminDeletePost, adminLogin } from './actions'
import Link from 'next/link'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  return val === process.env.ADMIN_PASSWORD
}

// ─── ログインページ ───────────────────────────────────────
function LoginPage({ error }: { error?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white border border-gray-300 p-8 w-full max-w-sm">
        <h1 className="text-lg font-bold mb-4 text-gray-800">🔐 管理者ログイン</h1>
        <form action={adminLogin}>
          <input
            type="password"
            name="password"
            placeholder="管理者パスワード"
            className="w-full border border-gray-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400"
            required
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 text-white text-sm font-medium"
            style={{ background: '#0d6efd' }}
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── 管理ダッシュボード ───────────────────────────────────
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; error?: string; page?: string }>
}) {
  const sp = await searchParams

  // ログインチェック
  if (!(await isAdmin())) {
    return <LoginPage error={sp.error} />
  }

  const supabase = await createClient()

  // スレッド一覧
  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, post_count, is_archived, created_at, categories(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  // 特定スレのレス一覧
  let posts = null
  let selectedThread = null
  if (sp.thread) {
    const threadId = parseInt(sp.thread)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('threads').select('id, title').eq('id', threadId).single(),
      supabase.from('posts').select('id, post_number, author_name, body, created_at')
        .eq('thread_id', threadId).order('post_number', { ascending: true }),
    ])
    selectedThread = t
    posts = p
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🛠 管理画面</h1>
        <div className="flex gap-2">
          <Link href="/" className="text-xs text-blue-600 hover:underline">サイトに戻る</Link>
          <form action={async () => {
            'use server'
            const cookieStore = await cookies()
            cookieStore.delete(ADMIN_COOKIE)
            redirect('/admin')
          }}>
            <button type="submit" className="text-xs text-gray-500 hover:underline">ログアウト</button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* スレッド一覧 */}
        <div>
          <h2 className="font-bold text-sm text-gray-700 mb-2 pb-1 border-b border-gray-200">
            📋 スレッド一覧（最新50件）
          </h2>
          <div className="space-y-1">
            {threads?.map(t => (
              <div key={t.id} className="flex items-start gap-2 bg-white border border-gray-200 p-2 text-xs">
                <div className="flex-1 min-w-0">
                  <Link href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline line-clamp-1">
                    {t.title}
                  </Link>
                  <div className="text-gray-400 mt-0.5">
                    {(t.categories as unknown as { name: string } | null)?.name ?? '未分類'} ／ 💬{t.post_count}
                    {t.is_archived && ' ／ 過去ログ'}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link
                    href={`/admin?thread=${t.id}`}
                    className="px-2 py-1 text-[10px] text-blue-600 border border-blue-300 hover:bg-blue-50"
                  >
                    レス表示
                  </Link>
                  <form action={adminDeleteThread}>
                    <input type="hidden" name="threadId" value={t.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 text-[10px] text-white"
                      style={{ background: '#dc3545' }}
                      onClick={() => { return confirm(`「${t.title}」を削除しますか？`) }}
                    >
                      削除
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* レス一覧 */}
        {selectedThread && (
          <div>
            <h2 className="font-bold text-sm text-gray-700 mb-2 pb-1 border-b border-gray-200">
              💬 「{selectedThread.title}」のレス
            </h2>
            <div className="space-y-1">
              {posts?.map(p => (
                <div key={p.id} className="flex items-start gap-2 bg-white border border-gray-200 p-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-600">#{p.post_number + 1} {p.author_name}</span>
                    <p className="text-gray-700 mt-0.5 line-clamp-2 break-all">{p.body}</p>
                  </div>
                  <form action={adminDeletePost}>
                    <input type="hidden" name="postId" value={p.id} />
                    <input type="hidden" name="threadId" value={selectedThread!.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 text-[10px] text-white shrink-0"
                      style={{ background: '#dc3545' }}
                    >
                      削除
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
