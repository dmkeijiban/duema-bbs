import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'

interface Props {
  params: Promise<{ id: string }>
}

const BOT_USER_AGENT_PATTERN = /googlebot|bingbot|twitterbot|facebookexternalhit|discordbot|slackbot|bot|crawler|spider|preview|headless|puppeteer|playwright|lighthouse|pingdom|uptimerobot|gtmetrix|pagespeed|dataforseo|monitoring/i

function isBotRequest(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? ''
  return BOT_USER_AGENT_PATTERN.test(userAgent)
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params
  const threadId = parseInt(id)
  if (Number.isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? ''
  const isAdmin = verifyAdminCookie(cookieStore.get('admin_auth')?.value)
  const shouldCountView = request.nextUrl.searchParams.get('view') === '1' && !isBotRequest(request)
  const supabase = sessionId || shouldCountView ? await createClient() : null

  let isFavorited = false
  if (sessionId && supabase) {
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('session_id', sessionId)
      .eq('thread_id', threadId)
      .maybeSingle()
    isFavorited = !!data
  }

  if (shouldCountView && supabase) {
    await supabase.rpc('increment_view_count', { thread_id: threadId })
  }

  return NextResponse.json(
    { sessionId, isAdmin, isFavorited },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
