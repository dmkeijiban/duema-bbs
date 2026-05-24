import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { archiveThread, deleteThread, batchArchiveStale, batchArchiveAllDeleted } from './actions'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

export default async function CleanupPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = await createClient()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)

  // ① 未回答スレッド（0レス、7日以上前）
  const { data: zeroReply } = await supabase
    .from('threads')
    .select('id, title, created_at, post_count')
    .eq('is_archived', false)
    .eq('post_count', 0)
    .lt('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(100)

  // ② 低活動スレッド（5レス未満、180日以上更新なし）
  const { data: stale } = await supabase
    .from('threads')
    .select('id, title, post_count, last_posted_at')
    .eq('is_archived', false)
    .lt('post_count', 5)
    .lt('last_posted_at', sixMonthsAgo.toISOString())
    .order('last_posted_at', { ascending: true })
    .limit(100)

  // ③ 全投稿削除済みスレッド（post_count > 0 だが is_deleted=false の post が存在しない）
  // 【注意】PostgREST はデフォルトで行数上限があるため、posts を全件取得するには
  // .limit(100000) を明示する必要がある。上限なしだと途中で切れ、有効レスがある
  // スレッドが誤って「全削除済み」に分類されるバグが発生する（確認済み: 116件→17件）
  //
  // 取得手順:
  //   1. is_deleted=false の post が存在する thread_id を全件取得（上限明示）
  //   2. そのスレッドを除いた post_count > 0 スレッドが本当の候補
  const { data: activePosts } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('is_deleted', false)
    .limit(100000) // PostgREST行数上限を回避（現在約1688件）
  const activeThreadIds = [...new Set((activePosts ?? []).map((p: { thread_id: number }) => p.thread_id))]

  let allDeletedQuery = supabase
    .from('threads')
    .select('id, title, created_at, post_count')
    .eq('is_archived', false)
    .gt('post_count', 0)
    .order('created_at', { ascending: true })
    .limit(200)

  if (activeThreadIds.length > 0) {
    allDeletedQuery = allDeletedQuery.not('id', 'in', `(${activeThreadIds.join(',')})`)
  }
  const { data: allDeleted } = await allDeletedQuery

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ja-JP')

  const staleIds = (stale ?? []).map(t => t.id).join(',')
  const allDeletedIds = (allDeleted ?? []).map(t => t.id).join(',')

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🧹 データ整理</h1>
        <Link href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</Link>
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

      {/* ③ 全投稿削除済みスレッド */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            🗑️ 全投稿削除済みスレッド
            <span className="text-xs text-gray-400 font-normal ml-2">（投稿があるが全て削除済み）{allDeleted?.length ?? 0}件</span>
          </h2>
          {allDeleted && allDeleted.length > 0 && (
            <form action={batchArchiveAllDeleted}>
              <input type="hidden" name="ids" value={allDeletedIds} />
              <ConfirmDeleteButton
                message={`${allDeleted.length}件を一括アーカイブしますか？`}
                className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50"
              >
                全件アーカイブ
              </ConfirmDeleteButton>
            </form>
          )}
        </div>
        {!allDeleted || allDeleted.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">該当スレッドはありません</p>
        ) : (
          <div className="space-y-1">
            {allDeleted.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline text-xs line-clamp-1">
                    {t.title}
                  </a>
                  <span className="text-[10px] text-gray-400 ml-1">
                    投稿数(DB): {t.post_count} / 作成: {fmt(t.created_at)}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
