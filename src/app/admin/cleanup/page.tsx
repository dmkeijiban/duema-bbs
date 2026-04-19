import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { archiveThread, deleteThread, batchArchiveStale } from './actions'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === process.env.ADMIN_PASSWORD
}

export default async function CleanupPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = await createClient()

  // ① 未回答スレッド（0レス、7日以上前）
  const { data: zeroReply } = await supabase
    .from('threads')
    .select('id, title, created_at, post_count')
    .eq('is_archived', false)
    .eq('post_count', 0)
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(100)

  // ② 低活動スレッド（5レス未満、180日以上更新なし）
  const { data: stale } = await supabase
    .from('threads')
    .select('id, title, post_count, last_posted_at')
    .eq('is_archived', false)
    .lt('post_count', 5)
    .lt('last_posted_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
    .order('last_posted_at', { ascending: true })
    .limit(100)

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ja-JP')

  const staleIds = (stale ?? []).map(t => t.id).join(',')

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🧹 データ整理</h1>
        <a href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</a>
      </div>

      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-xs text-yellow-800 space-y-1">
        <p><strong>注意：</strong>削除は元に戻せません。アーカイブは非表示になるだけで、URLから直接アクセスは可能です。</p>
        <p>一括アーカイブは「低活動スレッド」全件（最大100件）を対象とします。</p>
      </div>

      {/* ① 未回答スレッド */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            💤 未回答スレッド
            <span className="text-xs text-gray-400 font-normal ml-2">（0レス・7日以上放置）{zeroReply?.length ?? 0}件</span>
          </h2>
        </div>
        {!zeroReply || zeroReply.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">該当スレッドはありません</p>
        ) : (
          <div className="space-y-1">
            {zeroReply.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline text-xs line-clamp-1">
                    {t.title}
                  </a>
                  <span className="text-[10px] text-gray-400 ml-1">{fmt(t.created_at)}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <form action={archiveThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit"
                      className="px-2 py-0.5 text-[10px] border border-gray-400 text-gray-600 hover:bg-gray-50">
                      アーカイブ
                    </button>
                  </form>
                  <form action={deleteThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmDeleteButton
                      message={`「${t.title}」を削除しますか？`}
                      className="px-2 py-0.5 text-[10px] text-white hover:opacity-80"
                      style={{ background: '#dc3545' }}
                    >
                      削除
                    </ConfirmDeleteButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ② 低活動スレッド */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            📉 低活動スレッド
            <span className="text-xs text-gray-400 font-normal ml-2">（5レス未満・180日以上更新なし）{stale?.length ?? 0}件</span>
          </h2>
          {stale && stale.length > 0 && (
            <form action={batchArchiveStale}>
              <input type="hidden" name="ids" value={staleIds} />
              <ConfirmDeleteButton
                message={`${stale.length}件を一括アーカイブしますか？`}
                className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50"
              >
                全件アーカイブ
              </ConfirmDeleteButton>
            </form>
          )}
        </div>
        {!stale || stale.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">該当スレッドはありません</p>
        ) : (
          <div className="space-y-1">
            {stale.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline text-xs line-clamp-1">
                    {t.title}
                  </a>
                  <span className="text-[10px] text-gray-400 ml-1">
                    💬{t.post_count} / 最終: {fmt(t.last_posted_at)}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <form action={archiveThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit"
                      className="px-2 py-0.5 text-[10px] border border-gray-400 text-gray-600 hover:bg-gray-50">
                      アーカイブ
                    </button>
                  </form>
                  <form action={deleteThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmDeleteButton
                      message={`「${t.title}」を削除しますか？`}
                      className="px-2 py-0.5 text-[10px] text-white hover:opacity-80"
                      style={{ background: '#dc3545' }}
                    >
                      削除
                    </ConfirmDeleteButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
