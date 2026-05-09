import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyAdminCookie } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug, title, body, published } = await req.json()
  if (!slug) return NextResponse.json({ error: 'slug は必須です' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (body !== undefined) updates.body = body
  if (published !== undefined) updates.published = published

  const { error } = await supabase.from('summaries').update(updates).eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('summaries', { expire: 0 })
  revalidatePath(`/summary/${slug}`)
  revalidatePath('/summary')
  revalidatePath('/')

  return NextResponse.json({ ok: true })
}
