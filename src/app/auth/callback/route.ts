import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { safeNextPath } from '@/lib/safe-next-path'

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNextPath(url.searchParams.get('next'))

  if (!code) {
    return redirectTo(request, '/login?error=missing_code')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return redirectTo(request, '/login?error=callback_failed')
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return redirectTo(request, '/login?error=session_failed')
  }

  // Password reset flow: skip profile check, session is already established
  if (next === '/auth/reset-password') {
    return redirectTo(request, next)
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return redirectTo(request, '/login?error=profile_check_failed')
  }

  if (!profile) {
    return redirectTo(request, `/profile/new?next=${encodeURIComponent(next)}`)
  }

  // 退会済みアカウントでログインした場合は再開フローへ案内する。
  if (profile.withdrawn_at) {
    return redirectTo(request, '/account/reactivate')
  }

  return redirectTo(request, next)
}
