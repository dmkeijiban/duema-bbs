import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { getAllSettings } from '@/lib/settings'
import { readGoodlifeAdSettings } from '@/lib/ads'
import { updateGoodlifeAdSettingsAction } from '../../actions'

export default async function Page() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const ads = readGoodlifeAdSettings(await getAllSettings())
  return <main className="mx-auto max-w-3xl px-3 py-5"><Link href="/admin/site" className="text-xs text-blue-700 hover:underline">← サイト管理</Link><h1 className="mt-2 text-2xl font-black">広告設定</h1><p className="mt-1 text-sm text-gray-600">Goodlifeインライン広告：{ads.enabled ? '有効' : '無効'}</p>
    <form action={updateGoodlifeAdSettingsAction} className="mt-5 space-y-3 rounded-lg border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">許可済みの固定広告タグだけを読み込みます。広告配信コード自体は変更しません。</p>{([
      ['goodlife_inline_enabled','Goodlifeインライン広告',ads.enabled],['goodlife_inline_thread_list','スレッド一覧・1件目の上',ads.threadList],['goodlife_inline_thread_detail','スレッド詳細に表示',ads.threadDetail],['goodlife_inline_desktop','PCで表示',ads.desktop],['goodlife_inline_mobile','スマホで表示',ads.mobile],
    ] as const).map(([name,label,checked])=><label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4"/><span>{label}</span></label>)}<button className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white">広告設定を保存</button></form>
  </main>
}
