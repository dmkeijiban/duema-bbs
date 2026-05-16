import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/admin-auth'
import { ScheduleGrid } from './ScheduleGrid'
import mockPosts from '@/data/x-posts-mock.json'

export const dynamic = 'force-dynamic'

export default async function XSchedulePage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">X投稿スケジュール</h1>
          <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 rounded px-2 py-0.5">
            モックデータ表示中
          </span>
        </div>
        <ScheduleGrid posts={mockPosts} />
      </div>
    </div>
  )
}
