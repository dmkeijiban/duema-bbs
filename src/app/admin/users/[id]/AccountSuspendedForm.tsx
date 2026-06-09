'use client'

import { useState, useTransition } from 'react'
import { toggleAccountSuspended } from './actions'

type Props = {
  targetId: string
  /** 画面表示時点での account_suspended の値 */
  currentSuspended: boolean
}

/**
 * account_suspended（アカウント停止：表示系・ランキング系）ON/OFF だけを切り替える管理操作フォーム。
 *
 * - 理由が空、または確認チェックが入っていない場合は送信不可。
 * - この操作は投稿・コメントそのものは削除しない（表示系・ランキング系に影響するだけ）。
 * - 実際の UPDATE は Server Action 側で再度認証・存在確認・現在値検証を行う。
 */
export function AccountSuspendedForm({ targetId, currentSuspended }: Props) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, startTx] = useTransition()
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(
    null
  )

  // 停止する操作か / 解除する操作か
  const willSuspend = !currentSuspended
  const actionLabel = willSuspend
    ? 'このユーザーのアカウントを停止する'
    : 'このユーザーのアカウント停止を解除する'

  const canSubmit = reason.trim().length > 0 && confirmed && !pending

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTx(async () => {
      const res = await toggleAccountSuspended(formData)
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
        value={currentSuspended ? 'true' : 'false'}
      />

      <p className="text-xs leading-relaxed text-gray-600">
        現在の状態：
        {currentSuspended ? (
          <span className="ml-1 font-semibold text-red-700">アカウント停止中（ON）</span>
        ) : (
          <span className="ml-1 font-semibold text-gray-700">通常（OFF）</span>
        )}
      </p>

      <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        この操作は投稿やコメントを削除しません。プロフィールページ、投稿者ランキング、プロフィール編集などに影響します。
      </p>

      {willSuspend && (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
          ⚠️ 停止すると、このユーザーのプロフィールページ（/u/[slug]）は404になり、投稿者ランキングから除外され、
          以降の新規投稿・コメントは投稿者と紐付かなくなり、プロフィール編集もできなくなります。
        </p>
      )}

      <div>
        <label
          htmlFor="account-suspended-reason"
          className="mb-1 block text-xs font-semibold text-gray-600"
        >
          操作理由（必須）
        </label>
        <textarea
          id="account-suspended-reason"
          name="reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="例：規約違反の繰り返しによりアカウントを停止"
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
        className={
          willSuspend
            ? 'border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400'
            : 'border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400'
        }
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
