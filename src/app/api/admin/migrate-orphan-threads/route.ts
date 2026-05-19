import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// 一回限りのマイグレーション: category_id が NULL のスレを雑談カテゴリに割り当てる
// 実行後このファイルは削除する
export async function POST() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // 雑談カテゴリのIDを取得
  const { data: cat, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .ilike('name', '%雑談%')
    .limit(1)
    .single()

  if (catError || !cat) {
    return NextResponse.json({ error: '雑談カテゴリが見つかりません', detail: catError?.message }, { status: 404 })
  }

  // 孤立スレを一括更新
  const { data, error } = await supabase
    .from('threads')
    .update({ category_id: cat.id })
    .is('category_id', null)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    category: cat,
    updated: data?.length ?? 0,
    ids: data?.map(t => t.id) ?? [],
  })
}
