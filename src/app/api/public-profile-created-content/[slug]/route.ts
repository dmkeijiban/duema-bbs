import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getMyCreatedContent } from '@/lib/mypage-created-content'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, account_suspended, withdrawn_at')
    .eq('profile_slug', slug)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch profile created content:', error.message)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }

  if (!profile || profile.account_suspended || profile.withdrawn_at) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const createdContent = await getMyCreatedContent(profile.id)
  return NextResponse.json(createdContent)
}
