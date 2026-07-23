import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { getAllSettings } from '@/lib/settings'
import { readGoodlifeAdSettings } from '@/lib/ads'
import { readGamAdSettings } from '@/lib/gam'
import { readAdstirAdSettings } from '@/lib/adstir'
import { updateGamAdSettingsAction, updateGoodlifeAdSettingsAction, updateAdstirAdSettingsAction } from './actions'
import { AdSettingsForm } from './AdSettingsForm'
import { GamSettingsForm } from './GamSettingsForm'
import { AdstirSettingsForm } from './AdstirSettingsForm'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const [allSettings, sp] = await Promise.all([
    getAllSettings(),
    searchParams,
  ])
  const ads = readGoodlifeAdSettings(allSettings)
  const gamAds = readGamAdSettings(allSettings)
  const adstirAds = readAdstirAdSettings(allSettings)

  return (
    <main className="mx-auto max-w-3xl px-3 py-5">
      <Link href="/admin/site" className="text-xs text-blue-700 hover:underline">← サイト管理</Link>
      <h1 className="mt-2 text-2xl font-black">広告設定</h1>
      <p className="mt-1 text-sm text-gray-600">Goodlifeインライン広告：{ads.enabled ? '有効' : '無効'}</p>

      {sp.saved === '1' && (
        <div className="mt-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm font-bold text-green-800" role="status">
          ✓ 広告設定を保存しました
        </div>
      )}

      <AdSettingsForm action={updateGoodlifeAdSettingsAction} ads={ads} />

      <GamSettingsForm action={updateGamAdSettingsAction} ads={gamAds} />

      <AdstirSettingsForm action={updateAdstirAdSettingsAction} ads={adstirAds} />
    </main>
  )
}
