import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { adminAddNgWord, adminDisableNgWord, adminUnbanSession } from '../actions'

type ModerationNgWord = { id: number; word: string; note: string | null; created_at: string }
type ModerationBan = { id: number; ban_type?: string; ban_value: string; reason: string | null; created_at: string; expires_at: string | null }

const card = 'min-w-0 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40'

async function loadModerationData() {
  const adminSupabase = createAdminClient()
  return Promise.all([
    adminSupabase.from('moderation_ng_words').select('id, word, note, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(30).then(result => result.error ? { data: [] as ModerationNgWord[] } : result),
    adminSupabase.from('moderation_bans').select('id, ban_type, ban_value, reason, created_at, expires_at').eq('is_active', true).order('created_at', { ascending: false }).limit(30).then(async result => {
      if (!result.error) return result
      if (result.error.code === 'PGRST205' || result.error.code === '42P01' || result.error.message?.includes('moderation_bans')) {
        const fallback = await adminSupabase.from('report_mutes').select('id, user_id, session_id, reason, created_at, revoked_at').eq('is_active', true).like('reason', 'posting_ban:%').order('created_at', { ascending: false }).limit(30)
        if (fallback.error) return { data: [] as ModerationBan[] }
        return { data: (fallback.data ?? []).map(row => ({ id: row.id, ban_type: row.user_id ? 'user' : 'session', ban_value: row.user_id ?? row.session_id, reason: row.reason?.replace(/^posting_ban:/, '') ?? null, created_at: row.created_at, expires_at: null })).filter(row => row.ban_value) as ModerationBan[] }
      }
      if (result.error.code !== '42703' && !result.error.message?.includes('ban_type') && !result.error.message?.includes('ban_value')) return { data: [] as ModerationBan[] }
      const legacy = await adminSupabase.from('moderation_bans').select('id, session_id, reason, created_at, expires_at').eq('is_active', true).order('created_at', { ascending: false }).limit(30)
      if (legacy.error) return { data: [] as ModerationBan[] }
      return { data: (legacy.data ?? []).map(row => ({ id: row.id, ban_type: 'session', ban_value: row.session_id, reason: row.reason, created_at: row.created_at, expires_at: row.expires_at })) as ModerationBan[] }
    }),
  ])
}

export default async function Page() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const [{ data: ngWords }, { data: bans }] = await loadModerationData()

  return <main className="min-h-screen bg-gray-50 px-3 py-5 text-gray-800"><div className="mx-auto max-w-6xl">
    <nav className="mb-2 text-xs text-gray-500"><Link href="/admin" className="text-blue-700 hover:underline">管理TOP</Link><span className="mx-2">/</span><span>運営・モデレーション</span></nav>
    <h1 className="text-2xl font-black">運営・モデレーション</h1><p className="mt-1 text-sm text-gray-600">投稿制限、通報、受付停止、削除済みデータをまとめて管理します。</p>

    <section className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div><h2 className="font-bold">投稿制限</h2><p className="mt-0.5 text-xs text-gray-500">NGワードとBAN中の投稿者を管理</p></div>
        <span className="text-xs text-gray-400">NGワード {ngWords.length}件 / BAN {bans.length}件</span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-5 p-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-bold">NGワード</h3>
          <form action={adminAddNgWord} className="mb-3 grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-1">
            <input name="word" placeholder="禁止したい言葉" className="min-w-0 rounded border border-gray-300 px-2 py-1.5 text-xs" required />
            <input name="note" placeholder="メモ" className="min-w-0 rounded border border-gray-300 px-2 py-1.5 text-xs" />
            <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">追加</button>
          </form>
          <div className="max-h-52 space-y-1 overflow-y-auto">{ngWords.length === 0 ? <p className="text-xs text-gray-400">まだ登録なし</p> : ngWords.map(word => <div key={word.id} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5"><div className="min-w-0 flex-1"><span className="text-xs font-bold text-red-700">{word.word}</span>{word.note && <span className="ml-2 text-[10px] text-gray-400">{word.note}</span>}</div><form action={adminDisableNgWord}><input type="hidden" name="id" value={word.id} /><button type="submit" className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50">無効化</button></form></div>)}</div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-bold">BAN中の投稿者</h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">{bans.length === 0 ? <p className="text-xs text-gray-400">BAN中の投稿者なし</p> : bans.map(ban => <div key={ban.id} className="flex items-center gap-2 rounded border border-red-100 bg-red-50/40 px-2 py-1.5"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-red-700">{ban.ban_type === 'user' ? 'user_id' : 'session_id'}</p><p className="break-all font-mono text-[10px] text-gray-600">{ban.ban_value}</p>{ban.reason && <p className="text-[10px] text-gray-400">理由: {ban.reason}</p>}</div><form action={adminUnbanSession}><input type="hidden" name="id" value={ban.id} /><button type="submit" className="rounded border border-blue-300 px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50">解除</button></form></div>)}</div>
        </section>
      </div>
    </section>

    <h2 className="mb-2 mt-6 text-sm font-bold text-gray-600">通報・削除管理</h2>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Link href="/admin/reports" className={card}><b className="block">通報</b><span className="mt-1 block text-xs text-gray-500">受け付けた通報を確認・対応</span></Link>
      <Link href="/admin/report-mutes" className={card}><b className="block">受付停止</b><span className="mt-1 block text-xs text-gray-500">通報受付を停止した対象を確認</span></Link>
      <Link href="/admin/deleted-posts" className={card}><b className="block">削除済み</b><span className="mt-1 block text-xs text-gray-500">削除済みレスの確認・復元</span></Link>
    </div>
    <details className="mt-5 overflow-hidden rounded-lg border border-orange-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-orange-800 hover:bg-orange-50">詳細な管理機能</summary><div className="grid min-w-0 grid-cols-1 gap-3 border-t border-orange-100 p-3 sm:grid-cols-2"><Link href="/admin/revival" className={card}><b className="block">リバイバル</b><span className="mt-1 block text-xs text-gray-500">既存の安全確認を維持して再掲を管理</span></Link><Link href="/admin/cleanup" className={card}><b className="block">データ整理</b><span className="mt-1 block text-xs text-gray-500">保守・整理機能を実行</span></Link></div></details>
  </div></main>
}
