import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_auth')?.value !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  let query = supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(20)

  if (q) query = query.ilike('title', `%${q}%`)

  const { data } = await query
  return NextResponse.json(data ?? [])
}
