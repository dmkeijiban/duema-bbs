/**
 * SNS URL のサーバーサイド取得（サーバーコンポーネント・Route Handler 専用）
 * Supabase の site_settings から sns_x / sns_youtube / sns_discord を読み込み、
 * 未設定のキーはデフォルト値にフォールバックする。
 */

import { getAllSettings } from '@/lib/settings'
import { SNS, type SnsUrls } from '@/lib/sns'

export async function getSnsUrls(): Promise<SnsUrls> {
  const settings = await getAllSettings()
  return {
    x: settings['sns_x'] || SNS.x,
    youtube: settings['sns_youtube'] || SNS.youtube,
    discord: settings['sns_discord'] || SNS.discord,
  }
}
