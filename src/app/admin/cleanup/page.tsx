import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { archiveThread, deleteThread, batchArchiveStale, batchArchiveAllDeleted, unarchiveThread } from './actions'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { SITE_URL } from '@/lib/site-config'

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
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1)

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

  // ④ 自動アーカイブ候補（24時間以上経過・有効コメント0件・保護なし）
  // is_protected=false のスレのみ対象
  const { data: emptyThreadCandidates } = await supabase
    .from('threads')
    .select('id, title, created_at, post_count, is_protected')
    .eq('is_archived', false)
    .eq('is_protected', false)
    .lt('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(300)

  // JS側で有効コメント0件に絞る（activeThreadIds は上記で取得済み）
  const activeSet = new Set(activeThreadIds)
  const autoArchiveCandidates = (emptyThreadCandidates ?? []).filter(t => !activeSet.has(t.id))

  // ⑤ アーカイブ済みスレッド一覧（個別復活用）
  const { data: archived } = await supabase
    .from('threads')
    .select('id, title, created_at, post_count, is_protected')
    .eq('is_archived', true)
    .order('created_at', { ascending: false })
    .limit(100)

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ja-JP')

  const staleIds = (stale ?? []).map(t => t.id).join(',')
  const allDeletedIds = (allDeleted ?? []).map(t => t.id).join(',')
  const autoArchiveIds = autoArchiveCandidates.map(t => t.id).join(',')

  const dryRunUrl = `${SITE_URL}/api/admin/archive-empty-threads?dry_run=1`
  const executeUrl = `${SITE_URL}/api/admin/archive-empty-threads`

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

      {/* ④ 自動アーカイブ候補（空スレ） */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            🤖 自動アーカイブ候補
            <span className="text-xs text-gray-400 font-normal ml-2">（24h以上経過・有効コメント0件・保護なし）{autoArchiveCandidates.length}件</span>
          </h2>
        </div>

        {/* ルール説明 */}
        <div className="mb-3 p-2 bg-blue-50 border border-blue-100 text-[11px] text-blue-700 space-y-0.5">
          <p><strong>自動アーカイブルール：</strong>以下をすべて満たすスレッドを対象とします</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>スレ作成から24時間以上経過している</li>
            <li>有効コメント数（is_deleted=false）が0件</li>
            <li>is_archived=false（まだ非アーカイブ状態）</li>
            <li>is_protected=false（保護フラグなし）</li>
          </ul>
          <p className="mt-1">管理者スレや重要スレには <code className="bg-blue-100 px-1">is_protected=true</code> を設定してください。</p>
        </div>

        {/* APIリンク */}
        <div className="mb-3 p-2 bg-gray-50 border border-gray-200 text-[11px] text-gray-600 space-y-1">
          <p className="font-medium">API エンドポイント</p>
          <p>
            <span className="font-mono bg-gray-100 px-1">GET</span>{' '}
            <a href={dryRunUrl} target="_blank" className="text-blue-600 hover:underline font-mono break-all">
              /api/admin/archive-empty-threads?dry_run=1
            </a>
            <span className="ml-1 text-gray-400">（対象確認・DB変更なし）</span>
          </p>
          <p>
            <span className="font-mono bg-gray-100 px-1">GET</span>{' '}
            <a href={executeUrl} target="_blank" className="text-orange-600 hover:underline font-mono break-all">
              /api/admin/archive-empty-threads
            </a>
            <span className="ml-1 text-gray-400">（実行・is_archived=true に更新）</span>
          </p>
          <p className="text-[10px] text-gray-400">将来は Vercel Cron で 1日1回自動実行できます（vercel.json に crons 設定追加）</p>
        </div>

        {autoArchiveCandidates.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">該当スレッドはありません</p>
        ) : (
          <>
            <div className="mb-2 flex justify-end">
              <a
                href={dryRunUrl}
                target="_blank"
                className="px-3 py-1 text-xs border border-blue-400 text-blue-600 hover:bg-blue-50"
              >
                🔍 dry-run で確認
              </a>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {autoArchiveCandidates.map(t => (
                <div key={t.id} className="bg-white border border-gray-200 p-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline text-xs line-clamp-1">
                      {t.title}
                    </a>
                    <span className="text-[10px] text-gray-400 ml-1">
                      作成: {fmt(t.created_at)} / post_count: {t.post_count}
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
          </>
        )}
      </section>

      {/* ⑤ アーカイブ済みスレッド（復活可能） */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            📦 アーカイブ済みスレッド
            <span className="text-xs text-gray-400 font-normal ml-2">（復活可能）{archived?.length ?? 0}件</span>
          </h2>
        </div>
        {!archived || archived.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">アーカイブ済みスレッドはありません</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {archived.map(t => (
              <div key={t.id} className="bg-gray-50 border border-gray-200 p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <a href={`/thread/${t.id}`} target="_blank" className="text-gray-500 hover:underline text-xs line-clamp-1">
                    {t.title}
                  </a>
                  <span className="text-[10px] text-gray-400 ml-1">
                    {t.is_protected && <span className="text-orange-500 mr-1">🔒保護</span>}
                    💬{t.post_count} / 作成: {fmt(t.created_at)}
                  </span>
                </div>
                <div className="shrink-0">
                  <form action={unarchiveThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit"
                      className="px-2 py-0.5 text-[10px] border border-green-500 text-green-700 hover:bg-green-50">
                      復活
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
