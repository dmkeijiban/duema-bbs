import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params
  const threadId = parseInt(id)
  if (Number.isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? ''
  const isAdmin = verifyAdminCookie(cookieStore.get('admin_auth')?.value)

  let isFavorited = false
  if (sessionId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('session_id', sessionId)
      .eq('thread_id', threadId)
      .maybeSingle()
    isFavorited = !!data
  }

  return NextResponse.json(
    { sessionId, isAdmin, isFavorited },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
