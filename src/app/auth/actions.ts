'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login?logged_out=1')
}

// RLS を回避して退会フラグを取得するためにAdmin客を使う。
// ブラウザ側クライアントだと profile_hidden=true 行が読めない可能性がある。
export async function getSessionProfileStatus(): Promise<{ id: string; withdrawn_at: string | null } | null> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, withdrawn_at')
    .eq('id', userData.user.id)
    .maybeSingle()
  return profile ?? null
}
