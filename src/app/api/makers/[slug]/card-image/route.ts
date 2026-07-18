import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return new NextResponse(null, { status: 400 })
  const { data } = await createAdminClient().from('cards').select('image_url').eq('id', id).eq('is_active', true).maybeSingle()
  if (!data?.image_url) return new NextResponse(null, { status: 404 })
  const response = await fetch(data.image_url, { cache: 'force-cache' })
  if (!response.ok) return new NextResponse(null, { status: 404 })
  return new NextResponse(await response.arrayBuffer(), { headers: { 'Content-Type': response.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } })
}
