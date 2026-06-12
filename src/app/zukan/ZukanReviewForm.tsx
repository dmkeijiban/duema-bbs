'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import type { ZukanActionState } from './actions'

type ZukanReviewFormProps = {
  targetId: string
  targetSlug: string
  targetKind: 'pack' | 'card'
  action: (
    prevState: ZukanActionState,
    formData: FormData
  ) => Promise<ZukanActionState>
}

const initialState: ZukanActionState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? '送信中...' : '投稿する'}
    </button>
  )
}

export default function ZukanReviewForm({
  targetId,
  targetSlug,
  targetKind,
  action,
}: ZukanReviewFormProps) {
  const [state, formAction] = useActionState(action, initialState)
  const idName = targetKind === 'pack' ? 'pack_id' : 'card_id'
  const slugName = targetKind === 'pack' ? 'pack_slug' : 'card_slug'

  return (
    <form action={formAction} className="space-y-3 rounded border bg-white p-4">
      <input type="hidden" name={idName} value={targetId} />
      <input type="hidden" name={slugName} value={targetSlug} />

      <div>
        <label className="mb-1 block text-xs font-bold text-slate-600">
          名前（未入力なら匿名）
        </label>
        <input
          name="author_name"
          maxLength={30}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="匿名"
        />
        <p className="mt-1 text-xs text-slate-500">
          ログイン中はプロフィールの表示名が優先されます。
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold text-slate-600">
          本文
        </label>
        <textarea
          name="body"
          minLength={3}
          maxLength={1000}
          required
          rows={4}
          className="w-full rounded border px-3 py-2 text-sm leading-6"
          placeholder="当時の思い出や、このカードへの一言を書いてください。"
        />
        <p className="mt-1 text-xs text-slate-500">
          3〜1000文字。空白だけの投稿はできません。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.message && (
          <p className="text-sm font-bold text-green-700">{state.message}</p>
        )}
        {state.error && (
          <p className="text-sm font-bold text-red-700">{state.error}</p>
        )}
      </div>
    </form>
  )
}
