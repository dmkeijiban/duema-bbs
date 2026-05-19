import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/admin-auth'
import { ScheduleGrid } from './ScheduleGrid'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/** UTC timestamptz → JST "YYYY-MM-DD" */
function toJSTDateStr(ts: string): string {
  const d = new Date(ts)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

/** UTC timestamptz → JST "HH:00" */
function toJSTSlot(ts: string): string {
  const d = new Date(ts)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = jst.getUTCHours().toString().padStart(2, '0')
  return `${h}:00`
}

export default async function XSchedulePage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  let dbError: string | null = null
  let posts: {
    id: number
    date: string
    slot: string
    postType: string
    text: string
    imageUrl: string | null
    status: string
    sentToTypefully: boolean
  }[] = []

  try {
    const supabase = createAdminClient()
    const { data: rows, error } = await supabase
      .from('x_posts')
      .select('id, post_type, status, thread_lines, image_urls, scheduled_at')
      .order('scheduled_at', { ascending: true })
      .limit(500)

    if (error) {
      dbError = error.message
    } else {
      posts = (rows ?? []).map((row) => ({
        id: Number(row.id),
        date: row.scheduled_at ? toJSTDateStr(row.scheduled_at as string) : new Date().toISOString().split('T')[0],
        slot: row.scheduled_at ? toJSTSlot(row.scheduled_at as string) : '07:00',
        postType: row.post_type as string,
        text: ((row.thread_lines as string[] | null) ?? []).join('\n'),
        imageUrl: ((row.image_urls as string[] | null) ?? [])[0] ?? null,
        status: row.status as string,
        sentToTypefully: row.status !== 'draft',
      }))
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">X投稿スケジュール</h1>
          {dbError && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-300 rounded px-2 py-0.5">
              DBエラー: {dbError}
            </span>
          )}
        </div>
        <ScheduleGrid posts={posts} />
      </div>
    </div>
  )
}
