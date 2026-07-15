import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { getAllSettings } from '@/lib/settings'
import { getHonorTitleTierCounts } from '@/lib/honor-title-stats'
import { HONOR_TITLES } from '@/lib/honor-title'
import { HonorTitleToggleButton } from '../../HonorTitleToggleButton'

export default async function Page(){if(!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value))redirect('/admin');const [settings,counts]=await Promise.all([getAllSettings(),getHonorTitleTierCounts()]);const enabled=settings.honor_title_enabled==='true';return <main className="mx-auto max-w-4xl px-3 py-5"><Link href="/admin/users" className="text-xs text-blue-700 hover:underline">← ユーザー管理</Link><h1 className="mt-2 text-2xl font-black">称号管理</h1><p className="mt-1 text-sm text-gray-600">ユーザーへ表示する称号と到達人数を管理します。</p><section className="mt-5 space-y-4 rounded-lg border bg-white p-4"><HonorTitleToggleButton enabled={enabled}/><p className="text-xs text-gray-500">OFFでもポイント計算は継続し、表示だけを停止します。</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{HONOR_TITLES.slice().reverse().map(title=><div key={title.key} className="rounded border bg-gray-50 p-2 text-center"><div>{title.icon}</div><div className="text-xs text-gray-600">{title.label}</div><b>{counts[title.key]??0}人</b></div>)}</div></section></main>}
