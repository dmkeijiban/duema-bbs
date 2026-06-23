'use client'

import { useState, useTransition } from 'react'
import { reactivateAccount } from '@/app/account/reactivate/actions'
import { logout } from '@/app/auth/actions'

export function ReactivateAccountForm() {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError('')
    startTransition(async () => {
      const result = await reactivateAccount()
      if (result.error) {
        setError(result.error)
        return
      }
      window.location.assign(result.redirectTo ?? '/mypage')
    })
  }

  return (
    <section className="rounded border border-blue-200 bg-blue-50 p-4">
      <h2 className="text-sm font-bold text-blue-900">このアカウントは退会済みです。</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-blue-800">
        <p>アカウントを再開すると、プロフィール情報を再び利用できます。</p>
        <p>ただし、退会前のスレッド・コメント・ランキングポイントは復元されません。</p>
        <p>
          退会前の投稿は引き続き匿名投稿として扱われ、再開後の投稿から新しい活動として
          反映されます。
        </p>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? '再開処理中…' : 'アカウントを再開する'}
        </button>

        <form action={logout}>
          <button
            type="submit"
            disabled={isPending}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            再開せずログアウト
          </button>
        </form>
      </div>
    </section>
  )
}
