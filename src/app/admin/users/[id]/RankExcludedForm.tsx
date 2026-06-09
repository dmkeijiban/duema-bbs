'use client'

import { useState, useTransition } from 'react'
import { toggleRankExcluded } from './actions'

type Props = {
  targetId: string
  /** 画面表示時点での rank_excluded の値 */
  currentExcluded: boolean
}

/**
 * rank_excluded（投稿者ランキングからの除外）ON/OFF だけを切り替える管理操作フォーム。
 *
 * - 理由が空、または確認チェックが入っていない場合は送信不可。
 * - 操作は投稿・コメントを削除しない（ランキング表示だけに影響する）。
 * - 実際の UPDATE は Server Action 側で再度認証・存在確認・現在値検証を行う。
 */
export function RankExcludedForm({ targetId, currentExcluded }: Props) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, startTx] = useTransition()
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(
    null
  )

  // 除外する操作か / 解除する操作か
  const willExclude = !currentExcluded
  const actionLabel = willExclude
    ? 'このユーザーをランキングから除外する'
    : 'このユーザーのランキング除外を解除する'

  const canSubmit = reason.trim().length > 0 && confirmed && !pending

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTx(async () => {
      const res = await toggleRankExcluded(formData)
      if (res.error) {
        setResult({ error: res.error })
      } else {
        setResult({ message: res.message })
        // 成功したら入力をリセット（連打防止）
        setReason('')
        setConfirmed(false)
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {/* 対象ユーザーと画面表示時点の現在値は hidden で送るが、Server Action 側で必ず DB 再確認する */}
      <input type="hidden" name="target_id" value={targetId} />
      <input
        type="hidden"
        name="expected_current"
        value={currentExcluded ? 'true' : 'false'}
      />

      <p className="text-xs leading-relaxed text-gray-600">
        現在の状態：
        {currentExcluded ? (
          <span className="ml-1 font-semibold text-red-700">ランキング除外中（ON）</span>
        ) : (
          <span className="ml-1 font-semibold text-gray-700">通常（OFF）</span>
        )}
      </p>

      <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        この操作は投稿やコメントを削除しません。ランキング表示だけに影響します。
        プロフィールページや投稿はそのまま残ります。
      </p>

      <div>
        <label
          htmlFor="rank-excluded-reason"
          className="mb-1 block text-xs font-semibold text-gray-600"
        >
          操作理由（必須）
        </label>
        <textarea
          id="rank-excluded-reason"
          name="reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="例：スパム的な連投によりランキングから除外"
          className="w-full resize-y border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
        />
        <p className="mt-0.5 text-[11px] text-gray-400">
          理由は moderation_note として記録されます（{reason.trim().length}/500）。
        </p>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          name="confirm"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          上記の内容を確認しました。{actionLabel}ことに同意します。
        </span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
      >
        {pending ? '処理中…' : actionLabel}
      </button>

      <p className="text-[11px] leading-relaxed text-gray-400">
        反映に時間がかかる場合があります（ランキングはキャッシュされています）。
      </p>

      {result?.error && (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {result.error}
        </p>
      )}
      {result?.message && (
        <p className="border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700">
          {result.message}
        </p>
      )}
    </form>
  )
}
