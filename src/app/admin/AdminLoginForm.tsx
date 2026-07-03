'use client'

import { useFormStatus } from 'react-dom'
import { adminLogin } from './actions'

function LoginButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 text-sm font-medium text-white transition active:translate-y-px disabled:cursor-wait disabled:opacity-70"
      style={{ background: '#0d6efd' }}
    >
      {pending ? 'ログイン中...' : 'ログイン'}
    </button>
  )
}

export function AdminLoginForm({ error }: { error?: string }) {
  return (
    <form action={adminLogin}>
      <input
        type="password"
        name="password"
        placeholder="管理者パスワード"
        className="mb-3 w-full border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        required
      />
      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
      <LoginButton />
    </form>
  )
}
