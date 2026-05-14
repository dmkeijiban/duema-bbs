import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase-public'

interface Props {
  params: Promise<{ slug: string }>
}

export async function POST(_request: Request, { params }: Props) {
  const { slug } = await params
  if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const supabase = createPublicClient()
  try {
    await supabase.rpc('increment_summary_view_count', { summary_slug: slug })
  } catch {
    // Older DBs may not have the RPC yet. The page should still work.
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}
