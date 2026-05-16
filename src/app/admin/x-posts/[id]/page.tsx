import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { updateXPost, deleteXPost, sendToTypefully, markAsPosted } from '../actions'
import { XPostForm } from '../XPostForm'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export default async function EditXPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; typefully?: string }>
}) {
  if (!(await isAdmin())) redirect('/admin')

  const { id: idStr } = await params
  const sp = await searchParams
  const id = parseInt(idStr)

  const supabase = createAdminClient()
  const { data: post, error } = await supabase
    .from('x_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !post) notFound()

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🐦 X投稿 編集 #{id}</h1>
        <Link href="/admin/x-posts" className="text-xs text-gray-500 hover:underline">
          ← 一覧に戻る
        </Link>
      </div>

      {sp.saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 text-xs mb-4">
          ✅ 保存しました
        </div>
      )}
      {sp.typefully && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 text-xs mb-4">
          ✅ Typefully に送信しました
          {post.typefully_share_url && (
            <>
              {' — '}
              <a
                href={post.typefully_share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Typefully で確認
              </a>
            </>
          )}
        </div>
      )}
      {sp.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs mb-4">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* TYPEFULLY_API_KEY 未設定警告 */}
      {!process.env.TYPEFULLY_API_KEY && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-3 py-2 text-xs mb-4">
          ⚠️ <strong>TYPEFULLY_API_KEY が未設定です</strong>
          — Vercel の環境変数に追加するまで「Typefullyに送信」は機能しません。
        </div>
      )}

      {/* Typefully 操作パネル */}
      <div className="bg-gray-50 border border-gray-200 px-3 py-2 text-xs mb-4">
        <p className="font-medium text-gray-700 mb-2">Typefully連携</p>
        <div className="flex items-center gap-2 flex-wrap">
          {post.status !== 'posted' && (
            <form action={sendToTypefully}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs text-white font-medium hover:opacity-90"
                style={{ background: '#1da1f2' }}
              >
                {post.typefully_id ? '🔄 Typefullyに再送信' : '📤 Typefullyに送信'}
              </button>
            </form>
          )}
          {post.typefully_id && (
            <>
              <span className="text-gray-500">ID: {post.typefully_id}</span>
              {post.typefully_share_url && (
                <a
                  href={post.typefully_share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Typefullyで開く ↗
                </a>
              )}
            </>
          )}
          {post.status !== 'posted' && (
            <form action={markAsPosted}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs text-white font-medium hover:opacity-90"
                style={{ background: '#198754' }}
              >
                ✅ 投稿済みにする
              </button>
            </form>
          )}
        </div>
      </div>

      <XPostForm
        action={updateXPost}
        defaultValues={{
          id,
          post_type: post.post_type,
          title: post.title ?? '',
          thread_lines: post.thread_lines as string[],
          image_urls: (post.image_urls as string[]) ?? [],
          meta: (post.meta as Record<string, unknown>) ?? {},
          status: post.status,
          scheduled_at: post.scheduled_at,
          source_ref: post.source_ref,
        }}
      />

      {/* 削除 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <form action={deleteXPost}>
          <input type="hidden" name="id" value={id} />
          <ConfirmDeleteButton
            message={`「${post.title ?? `#${id}`}」を削除しますか？この操作は取り消せません。`}
            className="text-xs px-3 py-1.5 text-white hover:opacity-80"
            style={{ background: '#dc3545' }}
          >
            この投稿を削除
          </ConfirmDeleteButton>
        </form>
      </div>
    </div>
  )
}
