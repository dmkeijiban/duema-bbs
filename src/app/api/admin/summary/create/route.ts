import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyAdminCookie } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, slug, body, threadIds, published } = await req.json()

  if (!title || !slug)
    return NextResponse.json({ error: 'title・slug は必須です' }, { status: 400 })

  if (!/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ error: 'slugは小文字英数字とハイフンのみ使用可' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: existing } = await supabase.from('summaries').select('id').eq('slug', slug).maybeSingle()
  if (existing) return NextResponse.json({ error: 'そのslugは既に使われています' }, { status: 400 })

  // threadIds が未指定の場合はおすすめスレ（post_count上位）を自動使用。
  // 空配列が明示された場合は、読み物記事としてスレ一覧なしで作る。
  let resolvedIds: number[]
  if (Array.isArray(threadIds)) {
    resolvedIds = threadIds
  } else {
    const { data: top } = await supabase
      .from('threads')
      .select('id')
      .eq('is_archived', false)
      .order('post_count', { ascending: false })
      .limit(10)
    resolvedIds = (top ?? []).map((t: { id: number }) => t.id)
    if (resolvedIds.length === 0)
      return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 400 })
  }

  const { data: threads } = resolvedIds.length > 0
    ? await supabase
        .from('threads')
        .select('id, title, post_count, image_url, categories(name, color)')
        .in('id', resolvedIds)
    : { data: [] }

  const threadsJson = resolvedIds.map((id: number, i: number) => {
    const t = (threads ?? []).find((th: { id: number }) => th.id === id)
    if (!t) return null
    const cats = t.categories as unknown as { name: string; color: string } | null
    return {
      id: t.id, title: t.title, post_count: t.post_count,
      activity: 0, image_url: t.image_url ?? null,
      category_name: cats?.name ?? null, category_color: cats?.color ?? null,
      rank: i + 1,
    }
  }).filter(Boolean)

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('summaries').insert({
    type: 'manual', slug, title,
    period_start: today, period_end: today,
    threads: threadsJson, published: published === true,
    body: body ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('summaries', { expire: 0 })
  revalidatePath('/summary')
  revalidatePath('/')

  return NextResponse.json({ ok: true, slug })
}
