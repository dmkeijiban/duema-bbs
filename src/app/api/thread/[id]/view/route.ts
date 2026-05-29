import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase-public'

interface Props {
  params: Promise<{ id: string }>
}

const BOT_USER_AGENT_PATTERN = /googlebot|bingbot|twitterbot|facebookexternalhit|discordbot|slackbot|bot|crawler|spider|preview|headless|puppeteer|playwright|lighthouse|pingdom|uptimerobot|gtmetrix|pagespeed|dataforseo|monitoring/i

function isBotRequest(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? ''
  return BOT_USER_AGENT_PATTERN.test(userAgent)
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params
  const threadId = parseInt(id)
  if (Number.isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 })
  }

  if (isBotRequest(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const supabase = createPublicClient()
  await supabase.rpc('increment_view_count', { thread_id: threadId })

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}
