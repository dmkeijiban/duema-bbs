import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseSelectMakerConfig } from '@/lib/maker'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,type,config').eq('slug', slug).eq('status', 'published').eq('is_public', true).maybeSingle()
  if (!project || project.type !== 'select') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const config = parseSelectMakerConfig(project.config)
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)
  const civilization = (request.nextUrl.searchParams.get('civilization') ?? '').slice(0, 20)
  const cardType = (request.nextUrl.searchParams.get('cardType') ?? '').slice(0, 40)
  const costRaw = request.nextUrl.searchParams.get('cost')
  let query = admin.from('cards').select('id,name,image_url,civilization,cost,card_type').eq('is_active', true).order('name').limit(60)
  if (q) query = query.ilike('name', `%${q.replace(/[%_]/g, '')}%`)
  if (civilization) query = query.contains('civilization', [civilization])
  if (cardType) query = query.eq('card_type', cardType)
  if (costRaw && /^\d{1,2}$/.test(costRaw)) query = query.eq('cost', Number(costRaw))
  if (config.cardPool === 'manual') {
    const { data: links } = await admin.from('maker_project_cards').select('card_id').eq('project_id', project.id).limit(500)
    const ids = (links ?? []).map(row => row.card_id)
    if (!ids.length) return NextResponse.json({ cards: [] })
    query = query.in('id', ids)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  return NextResponse.json({ cards: data ?? [] }, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
