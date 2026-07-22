import { createAdminClient } from '@/lib/supabase-admin'

export type RepresentativeContentType = 'my_duema_9' | 'deck'

export async function getRepresentativeId(userId: string, contentType: RepresentativeContentType) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_content_representatives')
    .select('content_id')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .maybeSingle()

  // migration未適用時も一覧・マイページを表示できるよう、代表なしとして扱う。
  if (error) return null
  return typeof data?.content_id === 'string' ? data.content_id : null
}

