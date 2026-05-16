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
      .maybeSingle()

    if (readError || !current) {
      throw new Error('Summary not found by admin client')
    }

    viewCount = (current.view_count ?? 0) + 1
    await supabase
      .from('summaries')
      .update({ view_count: viewCount })
      .eq('slug', slug)
  } catch {
    const supabase = createPublicClient()
    try {
      await supabase.rpc('increment_summary_view_count', { summary_slug: slug })
    } catch {
      // Older DBs may not have the RPC yet. The page should still work.
    }

    const { data } = await supabase
      .from('summaries')
      .select('view_count')
      .eq('slug', slug)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 })
    }

    viewCount = data.view_count ?? null
  }

  return NextResponse.json({ ok: true, view_count: viewCount }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
