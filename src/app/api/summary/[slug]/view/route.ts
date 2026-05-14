import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createPublicClient } from '@/lib/supabase-public'

interface Props {
  params: Promise<{ slug: string }>
}

export async function POST(_request: Request, { params }: Props) {
  const { slug } = await params
  if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  let viewCount: number | null = null

  try {
    const supabase = createAdminClient()
    const { data: current, error: readError } = await supabase
      .from('summaries')
      .select('view_count')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle()

    if (readError || !current) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 })
    }

    viewCount = (current.view_count ?? 0) + 1
    await supabase
      .from('summaries')
      .update({ view_count: viewCount })
      .eq('slug', slug)
      .eq('published', true)
  } catch {
    const supabase = createPublicClient()
    try {
      await supabase.rpc('increment_summary_view_count', { summary_slug: slug })
      const { data } = await supabase
        .from('summaries')
        .select('view_count')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle()
      viewCount = data?.view_count ?? null
    } catch {
      // Older DBs may not have the RPC yet. The page should still work.
    }
  }

  return NextResponse.json({ ok: true, view_count: viewCount }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
