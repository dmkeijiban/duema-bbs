import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { getAllSettings } from '@/lib/settings'
import { normalizeTopShowcaseMode, TOP_SHOWCASE_MODE_OPTIONS } from '@/lib/top-showcase'
import { updateTopShowcaseModeAction } from '../../actions'

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const sp = await searchParams
  const current = normalizeTopShowcaseMode((await getAllSettings()).top_showcase_mode)
  const label = TOP_SHOWCASE_MODE_OPTIONS.find(option => option.value === current)?.label ?? 'みんなのプロフィール'
  return <main className="mx-auto max-w-4xl px-3 py-5"><Link href="/admin/site" className="text-xs text-blue-700 hover:underline">← サイト管理</Link><h1 className="mt-2 text-2xl font-black">トップ表示設定</h1><p className="mt-1 text-sm text-gray-600">現在：<b className="text-blue-700">{label}</b></p>{sp.saved&&<p className="mt-3 text-xs font-bold text-green-700">保存しました</p>}{sp.error&&<p className="mt-3 text-xs font-bold text-red-700">保存できませんでした</p>}
    <form action={updateTopShowcaseModeAction} className="mt-5 space-y-3 rounded-lg border bg-white p-4"><div className="grid gap-2 md:grid-cols-2">{TOP_SHOWCASE_MODE_OPTIONS.map(option=><label key={option.value} className="flex cursor-pointer gap-2 rounded border bg-gray-50 p-3 text-sm"><input type="radio" name="top_showcase_mode" value={option.value} defaultChecked={option.value===current} className="mt-1"/><span><b className="block">{option.label}</b><span className="mt-1 block text-xs text-gray-500">{option.description}</span></span></label>)}</div><div className="flex gap-3"><button className="rounded bg-blue-800 px-4 py-2 text-xs font-bold text-white">保存</button><Link href="/" className="px-3 py-2 text-xs text-blue-700 underline">トップを確認</Link></div></form>
  </main>
}
