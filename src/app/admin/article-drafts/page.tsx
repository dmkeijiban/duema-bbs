import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { listArticleDrafts } from '@/lib/article-drafts'
import { importArticleDraft } from './actions'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export default async function ArticleDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!(await isAdmin())) redirect('/admin')
  const sp = await searchParams
  const drafts = await listArticleDrafts()

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">險倅ｺ倶ｸ区嶌縺榊叙繧願ｾｼ縺ｿ</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/summary" className="text-xs text-blue-600 hover:underline">手動記事一覧</Link>
          <Link href="/admin" className="text-xs text-gray-500 hover:underline">管理画面</Link>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-gray-600 mb-4">
        <p>逕滓・貂医∩Markdown繧偵・撼蜈ｬ髢九・謇句虚險倅ｺ倶ｸ区嶌縺阪→縺励※蜿悶ｊ霎ｼ縺ｿ縺ｾ縺吶・/p>
        <p>蜿悶ｊ霎ｼ縺ｿ蠕後・謇句虚險倅ｺ倶ｸ隕ｧ縺ｧ邱ｨ髮・・遒ｺ隱阪＠縺ｦ縺九ｉ蜈ｬ髢九＠縺ｦ縺上□縺輔＞縲・/p>
      </div>

      {sp.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs mb-4">
          {sp.error}
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="bg-white border border-gray-200 px-4 py-6 text-center text-xs text-gray-400">
          `drafts/articles` 縺ｫ險倅ｺ倶ｸ区嶌縺阪′縺ゅｊ縺ｾ縺帙ｓ縲・
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => (
            <div key={draft.file} className="bg-white border border-gray-200 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">{draft.title}</p>
                <p className="text-[11px] text-gray-500 break-all mt-1">{draft.file}</p>
                {draft.sourceUrl && <p className="text-[11px] text-blue-600 break-all mt-1">{draft.sourceUrl}</p>}
                <p className="text-[10px] text-gray-400 mt-1">
                  generated: {draft.generatedAt || '-'} / status: {draft.status} / {Math.round(draft.size / 1024)}KB
                </p>
              </div>
              <form action={importArticleDraft} className="shrink-0">
                <input type="hidden" name="file" value={draft.file} />
                <button type="submit" className="px-3 py-1.5 text-xs text-white font-medium" style={{ background: '#0d6efd' }}>
                  荳区嶌縺阪↓蜈･繧後ｋ
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

