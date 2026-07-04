import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { protectThread, unprotectThread, archiveWithoutRevival } from './actions'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

export default async function RevivalPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = await createClient()

  const now = new Date()
  const nowTime = now.getTime()
  const seventyTwoHoursAgo = new Date(now)
  seventyTwoHoursAgo.setDate(seventyTwoHoursAgo.getDate() - 3)

  // 【PostgREST行数上限対策】is_deleted=false のpost が存在するthread_id を全件取得
  // .limit(100000) を明示しないと途中で切れ、有効レスがあるスレが誤検出される
  const { data: activePosts } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('is_deleted', false)
    .limit(100000)
  const activeThreadIds = [...new Set((activePosts ?? []).map((p: { thread_id: number }) => p.thread_id))]

  // 72時間以上前に作成されたアーカイブ済みでないスレッドを取得
  const { data: allCandidates } = await supabase
    .from('threads')
    .select('id, title, created_at, post_count, is_protected')
    .eq('is_archived', false)
    .lt('created_at', seventyTwoHoursAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(500)

  // 有効コメントが0件かつ保護なしのスレ（リバイバル候補）
  const revivalTargets = (allCandidates ?? []).filter(
    t => !activeThreadIds.includes(t.id) && !t.is_protected
  )

  // 保護済みスレ（is_protected=true）
  const protectedThreads = (allCandidates ?? []).filter(t => t.is_protected)

  // 有効コメントが0件で72h経過しているが、アーカイブ対象外のスレ総数（参考情報）
  const totalZeroComment = (allCandidates ?? []).filter(
    t => !activeThreadIds.includes(t.id)
  ).length

  function formatAge(dateStr: string) {
    const hours = Math.floor((nowTime - new Date(dateStr).getTime()) / (1000 * 60 * 60))
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  return (
    <div className="max-w-screen-lg mx-auto px-3 py-4 text-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">♻️ コメントゼロスレ リバイバル</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            72時間以上経過・有効コメント0件のスレ一覧。リバイバルコメントを入れるか、静かにアーカイブするか管理します。
          </p>
        </div>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理画面に戻る</Link>
      </div>

      {/* 統計バナー */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{revivalTargets.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">リバイバル候補</div>
        </div>
        <div className="bg-white border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{protectedThreads.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">保護済みスレ</div>
        </div>
        <div className="bg-white border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-600">{totalZeroComment}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">ゼロコメント合計</div>
        </div>
      </div>

      {/* 自動生成一時停止バナー */}
      <div className="mb-4 border border-yellow-400 bg-yellow-50 p-3">
        <h2 className="font-bold text-yellow-800 text-xs mb-1">⏸ 自動生成は現在一時停止中</h2>
        <p className="text-[11px] text-yellow-700">
          コメント自動生成・INSERT は停止しています。このページは<strong>候補確認・保護操作のみ</strong>に使用してください。
        </p>
        <ul className="text-[11px] text-yellow-700 mt-1.5 space-y-0.5 list-disc list-inside">
          <li>generate-empty-thread-revival.mjs の実行禁止</li>
          <li>insert-approved-revival-comments.mjs の実行禁止</li>
          <li>再開はユーザーが明示的に指示するまで禁止</li>
        </ul>
        <p className="text-[11px] text-yellow-600 mt-1.5">
          理由：候補の変動が大きい・破損スレ17件の扱い未確定・個別確認なしの自動生成は危険
        </p>
      </div>

      {/* スクリプト実行ガイド（参考：再開時に使用） */}
      <details className="mb-4">
        <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600">
          📋 リバイバルコメント生成手順（再開時の参考）
        </summary>
        <div className="mt-2 border border-gray-200 bg-gray-50 p-3">
          <ol className="text-[11px] text-gray-600 space-y-0.5 list-decimal list-inside">
            <li>候補スレを確認し、「保護」または「アーカイブ」で対象を絞り込む</li>
            <li>
              ターミナルで生成スクリプトを実行:
              <code className="ml-1 bg-gray-100 px-1 py-0.5 font-mono">node scripts/generate-empty-thread-revival.mjs</code>
            </li>
            <li>
              <code className="bg-gray-100 px-1 py-0.5 font-mono">revival-preview-YYYY-MM-DD/preview.md</code> を確認・承認
            </li>
            <li>
              承認後に INSERT:
              <code className="ml-1 bg-gray-100 px-1 py-0.5 font-mono">node scripts/insert-approved-revival-comments.mjs --file revival-preview-YYYY-MM-DD/comments.json</code>
            </li>
            <li>キャッシュ期限（60〜300秒）後に本番サイトで表示を確認（2回アクセス）</li>
          </ol>
        </div>
      </details>

      {/* ① リバイバル候補一覧 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            🎯 リバイバル候補
            <span className="ml-1 text-[11px] text-gray-400 font-normal">
              （72h以上経過・有効コメント0件・保護なし）
            </span>
          </h2>
          <span className="text-[11px] text-orange-600 font-medium">{revivalTargets.length}件</span>
        </div>

        {revivalTargets.length === 0 ? (
          <div className="bg-white border border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">リバイバル候補のスレはありません ✅</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {revivalTargets.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <a
                    href={`/thread/${t.id}`}
                    target="_blank"
                    className="text-blue-600 hover:underline text-xs font-medium line-clamp-1"
                  >
                    {t.title}
                  </a>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    スレ#{t.id} ・ {formatAge(t.created_at)} ・ post_count: {t.post_count}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {/* 保護ボタン（永続的にリバイバル・アーカイブ対象外にする） */}
                  <form action={protectThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 text-[11px] border border-blue-400 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                      title="is_protected=true にして永続的にリバイバル・アーカイブ対象外にする"
                    >
                      🔒 保護
                    </button>
                  </form>
                  {/* リバイバルせずアーカイブ */}
                  <form action={archiveWithoutRevival}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 text-[11px] border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                      title="リバイバルせずにソフトアーカイブ（is_archived=true）する"
                    >
                      📂 アーカイブ
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ② 保護済みスレ一覧 */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">
            🔒 保護済みスレ
            <span className="ml-1 text-[11px] text-gray-400 font-normal">
              （is_protected=true・リバイバル＆アーカイブ対象外）
            </span>
          </h2>
          <span className="text-[11px] text-blue-600 font-medium">{protectedThreads.length}件</span>
        </div>

        {protectedThreads.length === 0 ? (
          <div className="bg-white border border-gray-200 p-4 text-center">
            <p className="text-gray-400 text-xs">保護済みスレはありません</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {protectedThreads.map(t => (
              <div key={t.id} className="bg-white border border-blue-100 p-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <a
                    href={`/thread/${t.id}`}
                    target="_blank"
                    className="text-blue-600 hover:underline text-xs font-medium line-clamp-1"
                  >
                    {t.title}
                  </a>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    スレ#{t.id} ・ {formatAge(t.created_at)} ・ post_count: {t.post_count}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {/* 保護解除ボタン */}
                  <form action={unprotectThread}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 text-[11px] border border-orange-300 text-orange-600 hover:bg-orange-50 whitespace-nowrap"
                      title="保護を解除して通常のリバイバル対象に戻す"
                    >
                      🔓 保護解除
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 注意事項 */}
      <div className="border border-red-200 bg-red-50 p-3">
        <h3 className="font-bold text-red-700 text-xs mb-1">⚠️ 絶対ルール（2026-05-02事故を受けた再発防止）</h3>
        <ul className="text-[11px] text-red-600 space-y-0.5 list-disc list-inside">
          <li>物理削除禁止: <code>.delete()</code> は使わない。削除=<code>is_deleted=true</code>、非表示=<code>is_archived=true</code></li>
          <li>大量変更は必ず dry-run 先行。preview 確認後にのみ本番 INSERT する</li>
          <li>ゼロコメントスレは即アーカイブ・削除しない。リバイバル候補として扱う</li>
          <li><code>post_count</code> だけで判断しない。<code>is_deleted=false</code> の実コメント数を必ず確認する</li>
        </ul>
      </div>
    </div>
  )
}
