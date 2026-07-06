import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { getZukanImportEnvStatus } from '@/lib/zukan-pack-import'
import { listZukanPackFileOptions } from '@/lib/zukan-pack-files'
import ZukanImportClient from './ZukanImportClient'

export default async function AdminZukanImportPage() {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminToken)) redirect('/admin')

  const env = getZukanImportEnvStatus()
  const fileOptions = await listZukanPackFileOptions()

  return (
    <div className="mx-auto max-w-6xl px-3 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/zukan" className="text-sm text-blue-700 hover:underline">← 思い出図鑑管理へ戻る</Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">思い出図鑑 パックJSONインポート</h1>
          <p className="mt-1 text-xs text-gray-500">
            標準JSONを貼り付けて、検証・プレビュー・新規登録まで行います。既存データの更新や削除はしません。
          </p>
        </div>
        <Link href="/zukan" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
          図鑑を見る
        </Link>
      </div>

      {!env.canRegister && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          管理用環境変数が未設定です。validate / preview は使えますが、登録は無効です。
        </div>
      )}

      <ZukanImportClient initialEnv={env} fileOptions={fileOptions} />
    </div>
  )
}
