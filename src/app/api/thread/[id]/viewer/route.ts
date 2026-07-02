import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { createPublicClient } from '@/lib/supabase-public'
import { verifyAdminCookie } from '@/lib/admin-auth'

interface Props {
  params: Promise<{ id: string }>
}

const BOT_USER_AGENT_PATTERN = /googlebot|bingbot|twitterbot|facebookexternalhit|discordbot|slackbot|bot|crawler|spider|preview|headless|puppeteer|playwright|lighthouse|pingdom|uptimerobot|gtmetrix|pagespeed|dataforseo|monitoring/i
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 2

function isBotRequest(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? ''
  return BOT_USER_AGENT_PATTERN.test(userAgent)
}

function getJstDateKey() {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jstNow.toISOString().slice(0, 10)
}

function hasSupabaseAuthToken(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore
    .getAll()
    .some(cookie => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'))
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
  const todayKey = getJstDateKey()
  const viewCookieName = `thread_viewed_${threadId}`
  const shouldCountView =
    request.nextUrl.searchParams.get('view') === '1' &&
    !isBotRequest(request) &&
    cookieStore.get(viewCookieName)?.value !== todayKey

  let currentUserId = ''
  if (hasSupabaseAuthToken(cookieStore)) {
    const authSupabase = await createClient()
    const { data: userData } = await authSupabase.auth.getUser()
    currentUserId = userData.user?.id ?? ''
  }

  const supabase = createPublicClient()

  let isFavorited = false
  if (sessionId) {
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('session_id', sessionId)
      .eq('thread_id', threadId)
      .maybeSingle()
    isFavorited = !!data
  }

  if (shouldCountView) {
    await supabase.rpc('increment_view_count', { thread_id: threadId })
  }

  const response = NextResponse.json(
    { sessionId, currentUserId, isAdmin, isFavorited },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )

  if (shouldCountView) {
    response.cookies.set(viewCookieName, todayKey, {
      maxAge: VIEW_COOKIE_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
    })
  }

  return response
}
