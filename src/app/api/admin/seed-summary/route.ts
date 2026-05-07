import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidateTag, revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_auth')?.value !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // 既存スレッドを最大5件取得
  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(5)

  if (!threads || threads.length === 0)
    return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 400 })

  const threadsJson = threads.map((t, i) => {
    const cats = t.categories as unknown as { name: string; color: string } | null
    return {
      id: t.id, title: t.title, post_count: t.post_count,
      activity: 0, image_url: t.image_url ?? null,
      category_name: cats?.name ?? null, category_color: cats?.color ?? null,
      rank: i + 1,
    }
  })

  const today = new Date().toISOString().slice(0, 10)
  const slug = `test-kougatsu-card-${today}`

  // 既存チェック
  const { data: existing } = await supabase.from('summaries').select('id').eq('slug', slug).maybeSingle()
  if (existing) {
    revalidateTag('summaries')
    revalidatePath('/summary')
    revalidatePath('/')
    return NextResponse.json({ ok: true, message: '既に存在します', slug })
  }

  const { error } = await supabase.from('summaries').insert({
    type: 'manual',
    slug,
    title: 'デュエマ 高額カード・注目スレまとめ【テスト】',
    period_start: today,
    period_end: today,
    threads: threadsJson,
    published: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('summaries')
  revalidatePath('/summary')
  revalidatePath('/')

  return NextResponse.json({ ok: true, slug, url: `/summary/${slug}` })
}
