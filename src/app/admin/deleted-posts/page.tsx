'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import Link from 'next/link'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get('admin_auth')?.value
  if (val !== process.env.ADMIN_PASSWORD) redirect('/admin/login')
}

async function restorePost(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  if (cookieStore.get('admin_auth')?.value !== process.env.ADMIN_PASSWORD) redirect('/admin/login')

  const postId = parseInt(formData.get('postId') as string)
  const threadId = parseInt(formData.get('threadId') as string)
  const supabase = createAdminClient()

  await supabase.from('posts').update({
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
  }).eq('id', postId)

  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin/deleted-posts')
  redirect('/admin/deleted-posts')
}

export default async function DeletedPostsPage() {
  await checkAdmin()

  const supabase = createAdminClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, thread_id, post_number, body, author_name, deleted_at, deleted_by, threads(title)')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })
    .limit(200)

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/admin" className="text-blue-600 hover:underline text-sm">← 管理TOP</Link>
        <span className="text-gray-400 text-sm">/</span>
        <h1 className="text-base font-bold text-gray-800">🗑️ 削除済みレス一覧</h1>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        ソフト削除されたレスの一覧です。「復元」ボタンで元に戻せます。
      </p>

      {(!posts || posts.length === 0) ? (
        <div className="border border-gray-300 bg-white text-center py-12 text-gray-500 text-sm">
          削除済みレスはありません
        </div>
      ) : (
        <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
          {posts.map(post => {
            const thread = Array.isArray(post.threads) ? post.threads[0] as { title: string } | undefined : post.threads as { title: string } | null
            const deletedAt = post.deleted_at
              ? new Date(post.deleted_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
              : ''
            const bodyPreview = (post.body ?? '').slice(0, 100)

            return (
              <div key={post.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">
                      <Link href={`/thread/${post.thread_id}`} className="text-blue-600 hover:underline" target="_blank">
                        スレ#{post.thread_id}
                      </Link>
                      {thread ? ` 「${thread.title.slice(0, 30)}${thread.title.length > 30 ? '…' : ''}」` : ''}
                      {' '}レス#{post.post_number}
                      {' '}／ {post.author_name ?? '名無し'}
                    </p>
                    <p className="text-sm text-gray-800 break-all">
                      {bodyPreview}{(post.body ?? '').length > 100 ? '…' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      削除日時: {deletedAt}
                      {post.deleted_by ? ` ／ 削除者: ${post.deleted_by}` : ''}
                    </p>
                  </div>
                  <form action={restorePost} className="shrink-0">
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="threadId" value={post.thread_id} />
                    <button
                      type="submit"
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                    >
                      復元
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
