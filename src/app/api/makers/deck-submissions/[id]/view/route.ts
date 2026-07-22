import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const cookieName = `deck_view_${id.replaceAll('-', '')}`
  const alreadyCounted = request.headers.get('cookie')?.split(';').some(value => value.trim().startsWith(`${cookieName}=`))
  const admin = createAdminClient()
  if (!alreadyCounted) await admin.rpc('increment_deck_submission_metric', { target_id: id, metric_name: 'view' })

  const { data } = await admin.from('deck_submissions').select('view_count').eq('id', id).eq('is_public', true).maybeSingle()
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const response = NextResponse.json({ viewCount: data.view_count })
  if (!alreadyCounted) response.cookies.set(cookieName, '1', { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 30, path: '/' })
  return response
}
