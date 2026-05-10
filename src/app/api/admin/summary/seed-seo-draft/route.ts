import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { SEO_SUMMARY_DRAFT } from '@/lib/seo-summary-draft'

export const runtime = 'nodejs'

export async function POST() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: existing } = await supabase
    .from('summaries')
    .select('published')
    .eq('slug', SEO_SUMMARY_DRAFT.slug)
    .maybeSingle()

  const { data: top } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(10)

  const threadsJson = (top ?? []).map((t, i) => {
    const cats = t.categories as unknown as { name: string; color: string } | null
    return {
      id: t.id,
      title: t.title,
      post_count: t.post_count,
      activity: 0,
      image_url: t.image_url ?? null,
      category_name: cats?.name ?? null,
      category_color: cats?.color ?? null,
      rank: i + 1,
    }
  })

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('summaries').upsert(
    {
      type: 'manual',
      slug: SEO_SUMMARY_DRAFT.slug,
      title: SEO_SUMMARY_DRAFT.title,
      period_start: today,
      period_end: today,
      threads: threadsJson,
      published: existing?.published ?? false,
      body: SEO_SUMMARY_DRAFT.body,
    },
    { onConflict: 'slug' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('summaries', { expire: 0 })
  revalidatePath('/summary')
  revalidatePath(`/summary/${SEO_SUMMARY_DRAFT.slug}`)
  revalidatePath('/')

  return NextResponse.json({
    ok: true,
    slug: SEO_SUMMARY_DRAFT.slug,
    title: SEO_SUMMARY_DRAFT.title,
    published: false,
  })
}
