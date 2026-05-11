import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase-public'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: Props) {
  const { id } = await params
  const threadId = parseInt(id)
  if (Number.isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 })
  }

  const supabase = createPublicClient()
  await supabase.rpc('increment_view_count', { thread_id: threadId })

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}
