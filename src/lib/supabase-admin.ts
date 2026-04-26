import { createClient } from '@supabase/supabase-js'

/**
 * サービスロールキーを使うサーバー専用クライアント。
 * RLS をバイパスできるので Server Action 内でのみ使用すること。
 * ブラウザや Client Component には絶対に渡さない。
 *
 * 必要な環境変数:
 *   SUPABASE_SERVICE_ROLE_KEY  ← Supabase ダッシュボード > Settings > API > service_role
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local と Vercel 環境変数を確認してください。')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
