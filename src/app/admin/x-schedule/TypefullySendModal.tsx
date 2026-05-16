'use client'

import { useMemo, useState } from 'react'
import { TYPE_LABEL, STATUS_LABEL, STATUS_COLOR } from '@/constants/x-post'

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface MockPost {
  id: number
  date: string
  slot: string
  postType: string
  text: string
  imageUrl: string | null
  status: string
  sentToTypefully: boolean
}

interface SendResult {
  id: number
  slot: string
  ok: boolean
  typefullyId?: string
  error?: string
}

interface Props {
  posts: MockPost[]
  onClose: () => void
  onMarkSent?: (sentIds: number[]) => void
}

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const TARGET_DATE = '2026-06-01'
const REQUIRED_SLOTS = ['07:00', '12:00', '19:00', '22:00'] as const

/** JST slot → UTC ISO 文字列（表示用） */
function slotToPublishAt(date: string, slot: string): string {
  const iso = `${date}T${slot}:00+09:00`
  return new Date(iso).toISOString().replace('.000Z', 'Z')
}

// ----------------------------------------------------------------
// dry-run チェック
// ----------------------------------------------------------------
interface CheckItem {
  label: string
  pass: boolean
  detail: string
}

function runDryRunChecks(posts: MockPost[]): CheckItem[] {
  const now = new Date()

  const slotCount: Record<string, number> = {}
  for (const p of posts) {
    slotCount[p.slot] = (slotCount[p.slot] ?? 0) + 1
  }
  const hasDuplicateSlot = Object.values(slotCount).some((c) => c > 1)

  const winCount = posts.filter((p) => p.postType === 'win').length
  const silhouetteWithoutImage = posts.filter(
    (p) => p.postType === 'silhouette' && !p.imageUrl,
  )
  const pastPosts = posts.filter((p) => {
    const jst = new Date(`${p.date}T${p.slot}:00+09:00`)
    return jst <= now
  })
  const nonTargetDate = posts.filter((p) => p.date !== TARGET_DATE)
  const mayPosts = posts.filter((p) => p.date.startsWith('2026-05'))
  const alreadySent = posts.filter((p) => p.sentToTypefully)
  const emptyText = posts.filter((p) => p.text.trim() === '')
  const badStatus = posts.filter(
    (p) => !['draft', 'pending'].includes(p.status),
  )
  const missingSlots = REQUIRED_SLOTS.filter(
    (s) => !posts.some((p) => p.slot === s),
  )

  return [
    {
      label: '対象は 2026-06-01 の投稿のみ',
      pass: nonTargetDate.length === 0,
      detail:
        nonTargetDate.length === 0
          ? `全${posts.length}件が 6/1`
          : `⚠ 6/1以外の日付: ${nonTargetDate.map((p) => p.date).join(', ')}`,
    },
    {
      label: '5月投稿が混入していない',
      pass: mayPosts.length === 0,
      detail:
        mayPosts.length === 0
          ? '5月の投稿は含まれていない'
          : `⚠ 5月の投稿が ${mayPosts.length}件混入`,
    },
    {
      label: '必要スロット（07 / 12 / 19 / 22）が揃っている',
      pass: missingSlots.length === 0,
      detail:
        missingSlots.length === 0
          ? '4スロット全て存在'
          : `⚠ 不足スロット: ${missingSlots.join(', ')}`,
    },
    {
      label: '同日時の重複がない',
      pass: !hasDuplicateSlot,
      detail: hasDuplicateSlot
        ? `⚠ 重複スロット: ${Object.entries(slotCount)
            .filter(([, c]) => c > 1)
            .map(([s]) => s)
            .join(', ')}`
        : '重複なし',
    },
    {
      label: 'Typefully送信済み投稿が混入していない',
      pass: alreadySent.length === 0,
      detail:
        alreadySent.length === 0
          ? 'sentToTypefully=false のみ'
          : `⚠ 送信済みが ${alreadySent.length}件混入 (id: ${alreadySent.map((p) => p.id).join(', ')})`,
    },
    {
      label: 'ステータスが draft または pending のみ',
      pass: badStatus.length === 0,
      detail:
        badStatus.length === 0
          ? '全件 draft/pending'
          : `⚠ 不正ステータス: ${badStatus.map((p) => `id${p.id}=${p.status}`).join(', ')}`,
    },
    {
      label: '本文が空欄でない',
      pass: emptyText.length === 0,
      detail:
        emptyText.length === 0
          ? '全件に本文あり'
          : `⚠ 本文が空: id ${emptyText.map((p) => p.id).join(', ')}`,
    },
    {
      label: '投稿日時がすべて未来',
      pass: pastPosts.length === 0,
      detail:
        pastPosts.length === 0
          ? '全件が未来の日時'
          : `⚠ 過去の日時: ${pastPosts.map((p) => `${p.date} ${p.slot}`).join(', ')}`,
    },
    {
      label: '優勝🏆は1日1本以内',
      pass: winCount <= 1,
      detail:
        winCount <= 1
          ? `優勝投稿: ${winCount}本`
          : `⚠ 優勝投稿が${winCount}本（1日1本まで）`,
    },
    {
      label: 'シルエット投稿に画像が設定されている',
      pass: silhouetteWithoutImage.length === 0,
      detail:
        silhouetteWithoutImage.length === 0
          ? 'シルエット投稿なし、または画像あり'
          : `⚠ 画像なしシルエット: id ${silhouetteWithoutImage.map((p) => p.id).join(', ')}`,
    },
  ]
}

// ----------------------------------------------------------------
// ステップ型
// ----------------------------------------------------------------
type Step = 'dryrun' | 'confirm' | 'sending' | 'done' | 'error'

// ----------------------------------------------------------------
// TypefullySendModal
// ----------------------------------------------------------------
export function TypefullySendModal({ posts, onClose, onMarkSent }: Props) {
  const checks = useMemo(() => runDryRunChecks(posts), [posts])
  const allPass = checks.every((c) => c.pass)

  const [step, setStep] = useState<Step>('dryrun')
  const [sendResults, setSendResults] = useState<SendResult[]>([])
  const [sendError, setSendError] = useState<string | null>(null)

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    // 送信中は閉じない
    if (step === 'sending') return
    if (e.target === e.currentTarget) onClose()
  }

  // ── 本番送信実行 ─────────────────────────────────────
  async function handleRealSend() {
    setStep('sending')
    setSendError(null)
    setSendResults([])

    try {
      const res = await fetch('/api/typefully/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts }),
      })
      const data = await res.json()

      if (!res.ok && res.status !== 207) {
        // サーバーエラー（安全装置 / APIキー未設定など）
        setSendError(data.error ?? 'サーバーエラーが発生しました')
        if (data.setup) {
          setSendError(`${data.error}\n\n設定方法: ${data.setup}`)
        }
        setStep('error')
        return
      }

      setSendResults(data.results ?? [])
      setStep('done')

      // 成功した投稿の id を親へ通知
      if (onMarkSent) {
        const sentIds = (data.results as SendResult[])
          .filter((r) => r.ok)
          .map((r) => r.id)
        if (sentIds.length > 0) onMarkSent(sentIds)
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '通信エラーが発生しました')
      setStep('error')
    }
  }

  const successCount = sendResults.filter((r) => r.ok).length
  const failCount = sendResults.filter((r) => !r.ok).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── ヘッダー ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              {step === 'dryrun' && 'Typefully 送信確認（dry-run）'}
              {step === 'confirm' && 'Typefully 本番送信 — 最終確認'}
              {step === 'sending' && 'Typefully 送信中…'}
              {step === 'done' && 'Typefully 送信完了'}
              {step === 'error' && 'Typefully 送信エラー'}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              対象日: 2026-06-01 ／ 4枠（07:00 / 12:00 / 19:00 / 22:00）
            </p>
          </div>
          {step !== 'sending' && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition text-lg leading-none"
              aria-label="閉じる"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── ステップインジケーター ── */}
        <div className="flex items-center gap-0 px-5 pt-3 pb-0">
          {(['dryrun', 'confirm', 'done'] as const).map((s, i) => {
            const labels = ['① dry-run', '② 最終確認', '③ 完了']
            const isActive = step === s || (step === 'sending' && s === 'confirm') || (step === 'error' && s === 'confirm')
            const isDone =
              (s === 'dryrun' && ['confirm', 'sending', 'done', 'error'].includes(step)) ||
              (s === 'confirm' && ['done'].includes(step))
            return (
              <div key={s} className="flex items-center">
                {i > 0 && <div className={`h-px w-6 ${isDone || isActive ? 'bg-blue-300' : 'bg-gray-200'}`} />}
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    isDone
                      ? 'bg-green-100 text-green-700'
                      : isActive
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
            )
          })}
        </div>

        {/* ── コンテンツ ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ===================== STEP: dryrun ===================== */}
          {step === 'dryrun' && (
            <>
              {/* 安全警告 */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-[11px] text-blue-700 leading-relaxed">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>まずdry-runで全チェックを確認してください。</strong>
                  全項目通過後に「本番送信に進む」ボタンが有効になります。
                </span>
              </div>

              {/* 対象投稿一覧 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">
                  対象投稿（{posts.length}件）
                </h3>
                {posts.length === 0 ? (
                  <p className="text-[11px] text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
                    6/1の送信対象投稿が見つかりません
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50">
                        <tr className="text-gray-400 border-b border-gray-200">
                          <th className="text-left font-medium px-3 py-1.5">JST</th>
                          <th className="text-left font-medium px-3 py-1.5">UTC (publish_at)</th>
                          <th className="text-left font-medium px-3 py-1.5">タイプ</th>
                          <th className="text-left font-medium px-3 py-1.5">ステータス</th>
                          <th className="text-left font-medium px-3 py-1.5">画像</th>
                          <th className="text-left font-medium px-3 py-1.5">本文冒頭</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {posts
                          .slice()
                          .sort((a, b) => a.slot.localeCompare(b.slot))
                          .map((post) => {
                            const statusColor =
                              STATUS_COLOR[post.status] ?? 'bg-gray-100 text-gray-600'
                            return (
                              <tr key={post.id}>
                                <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-700">
                                  6/1 {post.slot}
                                </td>
                                <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-400 text-[10px]">
                                  {slotToPublishAt(post.date, post.slot)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                  {TYPE_LABEL[post.postType] ?? post.postType}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>
                                    {STATUS_LABEL[post.status] ?? post.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {post.imageUrl ? (
                                    <span className="text-blue-500">あり</span>
                                  ) : (
                                    <span className="text-gray-300">なし</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                                  {post.text.replace(/\n/g, ' ').slice(0, 40)}
                                  {post.text.length > 40 ? '…' : ''}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* dry-run チェックリスト */}
              <section>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">
                  dry-run チェック（{checks.filter((c) => c.pass).length} / {checks.length} 通過）
                </h3>
                <div className="space-y-1.5">
                  {checks.map((check) => (
                    <div
                      key={check.label}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ${
                        check.pass
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-300'
                      }`}
                    >
                      <span className="flex-shrink-0 text-sm leading-none mt-0.5">
                        {check.pass ? '✅' : '❌'}
                      </span>
                      <div>
                        <p className={`font-medium ${check.pass ? 'text-green-700' : 'text-red-700'}`}>
                          {check.label}
                        </p>
                        <p className={`mt-0.5 ${check.pass ? 'text-green-600' : 'text-red-600'}`}>
                          {check.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* dry-run 結果バナー */}
              {allPass ? (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-3">
                  <span className="text-lg flex-shrink-0">🎉</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-700">dry-run 成功</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      全チェック通過。「本番送信に進む」ボタンを押して最終確認へ進んでください。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-4 py-3">
                  <span className="text-lg flex-shrink-0">🚫</span>
                  <div>
                    <p className="text-sm font-bold text-red-700">dry-run 失敗</p>
                    <p className="text-[11px] text-red-600 mt-0.5">
                      上記の ❌ 項目を解消してから再確認してください。
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================== STEP: confirm ===================== */}
          {step === 'confirm' && (
            <>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-800">本番送信の最終確認</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    以下の4投稿を<strong>Typefully API へ実際に登録</strong>します。
                    送信後は Typefully 上に下書きが作成されます。
                    既存の予約投稿は変更・削除されません。
                  </p>
                </div>
              </div>

              {/* 送信予定一覧 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">送信する投稿（4件）</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50">
                      <tr className="text-gray-400 border-b border-gray-200">
                        <th className="text-left font-medium px-3 py-1.5">JST</th>
                        <th className="text-left font-medium px-3 py-1.5">UTC (scheduled-date)</th>
                        <th className="text-left font-medium px-3 py-1.5">タイプ</th>
                        <th className="text-left font-medium px-3 py-1.5 min-w-[160px]">本文冒頭</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {posts
                        .slice()
                        .sort((a, b) => a.slot.localeCompare(b.slot))
                        .map((post) => (
                          <tr key={post.id}>
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-700 font-semibold">
                              6/1 {post.slot}
                            </td>
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-400 text-[10px]">
                              {slotToPublishAt(post.date, post.slot)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                              {TYPE_LABEL[post.postType] ?? post.postType}
                            </td>
                            <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                              {post.text.replace(/\n/g, ' ').slice(0, 50)}
                              {post.text.length > 50 ? '…' : ''}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                送信後、Typefully の下書きに4件が追加されます。
                投稿ステータスは <code>sentToTypefully = true</code> に更新されます。
              </div>
            </>
          )}

          {/* ===================== STEP: sending ===================== */}
          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Typefully API に送信中…</p>
              <p className="text-[11px] text-gray-400">しばらくお待ちください</p>
            </div>
          )}

          {/* ===================== STEP: done ===================== */}
          {step === 'done' && (
            <>
              {failCount === 0 ? (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-3">
                  <span className="text-lg flex-shrink-0">🎉</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-700">送信成功！</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      {successCount}件すべて Typefully に登録されました。
                      Typefully 上で内容を確認してスケジュール設定してください。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-sm font-bold text-amber-800">一部送信失敗</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      成功: {successCount}件 ／ 失敗: {failCount}件
                    </p>
                  </div>
                </div>
              )}

              {/* 送信結果一覧 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">送信結果</h3>
                <div className="space-y-1.5">
                  {sendResults
                    .slice()
                    .sort((a, b) => a.slot.localeCompare(b.slot))
                    .map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ${
                          r.ok
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-300'
                        }`}
                      >
                        <span className="flex-shrink-0 text-sm leading-none mt-0.5">
                          {r.ok ? '✅' : '❌'}
                        </span>
                        <div>
                          <p className={`font-medium ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                            6/1 {r.slot}
                          </p>
                          {r.ok && r.typefullyId && (
                            <p className="text-green-600 mt-0.5">
                              Typefully ID: <code>{r.typefullyId}</code>
                            </p>
                          )}
                          {!r.ok && r.error && (
                            <p className="text-red-600 mt-0.5">{r.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}

          {/* ===================== STEP: error ===================== */}
          {step === 'error' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-4 py-3">
              <span className="text-lg flex-shrink-0">🚫</span>
              <div>
                <p className="text-sm font-bold text-red-700">送信エラー</p>
                <pre className="text-[11px] text-red-600 mt-1 whitespace-pre-wrap break-all">
                  {sendError}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* ── フッター ── */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-200 bg-gray-50">
          <p className="text-[10px] text-gray-400">
            {step === 'dryrun' && '全チェック通過後に本番送信ボタンが有効になります'}
            {step === 'confirm' && '「送信する」を押すと Typefully API が呼び出されます'}
            {step === 'sending' && '送信中は閉じないでください'}
            {step === 'done' && '送信完了 — Typefully で予約設定を確認してください'}
            {step === 'error' && 'エラーを確認して再試行してください'}
          </p>

          <div className="flex gap-2">
            {/* 閉じる / キャンセル */}
            {step !== 'sending' && (
              <button
                onClick={step === 'confirm' ? () => setStep('dryrun') : onClose}
                className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 transition"
              >
                {step === 'confirm' ? '← 戻る' : '閉じる'}
              </button>
            )}

            {/* dry-run → 確認へ */}
            {step === 'dryrun' && (
              <button
                onClick={() => setStep('confirm')}
                disabled={!allPass || posts.length === 0}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${
                  allPass && posts.length > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                title={
                  allPass
                    ? '最終確認画面へ進む'
                    : 'dry-run チェックが全て通過してから押してください'
                }
              >
                本番送信に進む →
              </button>
            )}

            {/* 確認 → 送信 */}
            {step === 'confirm' && (
              <button
                onClick={handleRealSend}
                className="px-4 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition font-medium"
              >
                📤 送信する（4件）
              </button>
            )}

            {/* エラー時 → 再試行 */}
            {step === 'error' && (
              <button
                onClick={() => setStep('confirm')}
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition font-medium"
              >
                再試行
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
