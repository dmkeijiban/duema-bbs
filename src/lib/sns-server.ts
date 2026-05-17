/**
 * SNS URL のサーバーサイド取得（サーバーコンポーネント・Route Handler 専用）
 * Supabase の site_settings から sns_x / sns_youtube / sns_discord を読み込み、
 * 未設定のキーはデフォルト値にフォールバックする。
 *
 * NOTE: cookies() を使わない createPublicClient + unstable_cache で実装することで、
 * root layout から呼んでも全ページが dynamic に落ちないようにしている。
 */

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'
import { SNS, type SnsUrls } from '@/lib/sns'

const getCachedSnsUrls = unstable_cache(
  async (): Promise<SnsUrls> => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['sns_x', 'sns_youtube', 'sns_discord'])
      const map: Record<string, string> = {}
      for (const row of data ?? []) map[row.key] = row.value
      return {
        x: map['sns_x'] || SNS.x,
        youtube: map['sns_youtube'] || SNS.youtube,
        discord: map['sns_discord'] || SNS.discord,
      }
    } catch {
      return { x: SNS.x, youtube: SNS.youtube, discord: SNS.discord }
    }
  },
  ['sns-urls'],
  { revalidate: 3600, tags: ['site_settings'] },
)

export async function getSnsUrls(): Promise<SnsUrls> {
  return getCachedSnsUrls()
}
