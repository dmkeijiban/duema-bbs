/**
 * SNSフォロー導線 — スレッド末尾CTAカード
 * 表示ページは SnsCtaCardClient 側で TOP / スレ詳細 / 思い出図鑑トップのみに制限する。
 * URLs は Supabase site_settings から取得（管理画面で変更可能）。
 */

import { getSnsUrls } from '@/lib/sns-server'
import { SnsCtaCardClient } from '@/components/SnsCtaCardClient'

export async function SnsCtaCard() {
  const sns = await getSnsUrls()
  return <SnsCtaCardClient sns={sns} />
}
