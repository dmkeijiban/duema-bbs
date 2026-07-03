import { AdminLoginForm } from './AdminLoginForm'

export function AdminLoginView({ error }: { error?: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-gray-100 px-3 py-6">
      <div className="w-full max-w-sm border border-gray-300 bg-white p-5 sm:p-8">
        <h1 className="mb-4 text-lg font-bold text-gray-800">🔐 管理者ログイン</h1>
        <AdminLoginForm error={error} />
      </div>
    </div>
  )
}
