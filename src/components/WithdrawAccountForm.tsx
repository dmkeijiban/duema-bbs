'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { withdrawAccount } from '@/app/mypage/actions'

export function WithdrawAccountForm() {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError('')
    if (!confirmed) {
      setError('退会する前に確認チェックを入れてください。')
      return
    }

    const formData = new FormData()
    formData.set('confirmation', confirmation)

    startTransition(async () => {
      const result = await withdrawAccount(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      router.replace(result.redirectTo ?? '/')
      router.refresh()
    })
  }

  return (
    <section className="rounded border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-bold text-red-800">危険操作</h2>
      <p className="mt-2 text-sm leading-relaxed text-red-700">
        退会すると公開投稿者ページは非公開になり、ランキングから除外されます。過去のスレッドやコメント本文は残ります。
      </p>
      <div className="mt-3 space-y-3">
        <label className="flex items-start gap-2 text-sm text-red-800">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>退会後はログアウトし、プロフィール情報は公開されなくなることを理解しました。</span>
        </label>
        <div>
          <label htmlFor="withdraw-confirmation" className="block text-xs font-bold text-red-800">
            確認のため「退会する」と入力
          </label>
          <input
            id="withdraw-confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-1 w-full rounded border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            disabled={isPending}
          />
        </div>
        {error && (
          <p className="rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? '退会処理中…' : '退会する'}
        </button>
      </div>
    </section>
  )
}
