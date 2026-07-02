import { createPublicClient } from '@/lib/supabase-public'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site-config'
import { applyActiveThreadFilter, applyLegacyActiveThreadFilter, isArchiveSchemaMissing } from '@/lib/thread-archive'
import { NextResponse } from 'next/server'

export const revalidate = 3600

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc822(dateStr: string): string {
  return new Date(dateStr).toUTCString()
}

export async function GET() {
  const supabase = createPublicClient()

  let query = supabase
    .from('threads')
    .select('id, title, post_count, last_posted_at, created_at, categories(name, slug)')
    .gte('post_count', 2)
  query = applyActiveThreadFilter(query)
  const result = await query
    .order('last_posted_at', { ascending: false })
    .limit(50)
  let threads = result.data
  if (isArchiveSchemaMissing(result.error)) {
    const retry = await applyLegacyActiveThreadFilter(supabase
      .from('threads')
      .select('id, title, post_count, last_posted_at, created_at, categories(name, slug)')
      .gte('post_count', 2)
    )
      .order('last_posted_at', { ascending: false })
      .limit(50)
    threads = retry.data
  }

  const items = (threads ?? []).map(thread => {
    const catRaw = thread.categories
    const cat = (Array.isArray(catRaw) ? catRaw[0] : catRaw) as { name: string; slug: string } | null | undefined ?? null
    const link = `${SITE_URL}/thread/${thread.id}`
    const title = escapeXml(thread.title)
    const description = cat
      ? escapeXml(`${cat.name}カテゴリのスレッド。レス数：${thread.post_count}件`)
      : escapeXml(`レス数：${thread.post_count}件`)
    const pubDate = toRfc822(thread.last_posted_at ?? thread.created_at)
    const category = cat ? `<category>${escapeXml(cat.name)}</category>` : ''
    return `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      ${category}
    </item>`
  }).join('')

  const now = new Date().toUTCString()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ja</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
