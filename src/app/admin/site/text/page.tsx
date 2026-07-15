import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { getAllSettings } from '@/lib/settings'
import { SettingEditFormClient } from '../../SettingEditFormClient'

const labels: Record<string,string> = { thread_rules:'スレッド内ルール',new_thread_rules:'新規スレッド作成ルール',home_banner:'ホーム緑バナー',sns_x:'X（Twitter）URL',sns_youtube:'YouTube URL',sns_discord:'Discord URL' }
export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const edit=(await searchParams).edit; const settings=await getAllSettings()
  return <main className="mx-auto max-w-4xl px-3 py-5"><Link href="/admin/site" className="text-xs text-blue-700 hover:underline">← サイト管理</Link><h1 className="mt-2 text-2xl font-black">サイトテキスト</h1><p className="mt-1 text-sm text-gray-600">ルール、バナー、SNSリンクの表示内容を編集します。</p>{edit&&labels[edit]&&<div className="mt-4"><SettingEditFormClient settingKey={edit} initialValue={settings[edit]??''} label={labels[edit]} returnPath="/admin/site/text"/></div>}
    {[['ルール・バナー',['thread_rules','new_thread_rules','home_banner']],['SNSリンク',['sns_x','sns_youtube','sns_discord']]].map(([title,keys])=><section key={title as string} className="mt-5"><h2 className="mb-2 text-sm font-bold text-gray-600">{title as string}</h2><div className="space-y-2">{(keys as string[]).map(key=><div key={key} className="flex min-w-0 items-center gap-2 rounded border bg-white p-3"><div className="min-w-0 flex-1"><b className="text-sm">{labels[key]}</b><p className="mt-1 line-clamp-1 text-xs text-gray-400">{(settings[key]??'（未設定）').slice(0,80)}</p></div><Link href={`/admin/site/text?edit=${key}`} className="shrink-0 rounded border border-purple-300 px-3 py-1 text-xs text-purple-700">編集</Link></div>)}</div></section>)}
  </main>
}
