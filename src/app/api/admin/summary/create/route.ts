import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_auth')?.value !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, slug, threadIds } = await req.json()

  if (!title || !slug || !Array.isArray(threadIds) || threadIds.length === 0)
    return NextResponse.json({ error: 'title・slug・threadIds は必須です' }, { status: 400 })

  if (!/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ error: 'slugは小文字英数字とハイフンのみ使用可' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: existing } = await supabase.from('summaries').select('id').eq('slug', slug).maybeSingle()
  if (existing) return NextResponse.json({ error: 'そのslugは既に使われています' }, { status: 400 })

  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .in('id', threadIds)

  const threadsJson = threadIds.map((id: number, i: number) => {
    const t = (threads ?? []).find(th => th.id === id)
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
    threads: threadsJson, published: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('summaries')
  revalidatePath('/summary')
  revalidatePath('/')

  return NextResponse.json({ ok: true, slug })
}
