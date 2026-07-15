import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import DeckMaker from '@/app/makers/deck-maker/DeckMaker'

export const dynamic = 'force-dynamic'

export default async function AdminDeckMakerPage() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')

  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <div className="mx-auto mb-2 max-w-[1600px] px-1 text-xs">
        <Link href="/admin/content-tools" className="font-bold text-blue-700 hover:underline">
          ← コンテンツ作成・取り込みへ戻る
        </Link>
      </div>
      <DeckMaker />
    </main>
  )
}
