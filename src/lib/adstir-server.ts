import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'
import { ADSTIR_SETTING_KEYS } from '@/lib/adstir'

const getCachedAdstirAdSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ADSTIR_SETTING_KEYS)

      if (error) throw error

      return Object.fromEntries((data ?? []).map(row => [row.key, row.value]))
    } catch (error) {
      console.error('adstir広告設定の取得に失敗しました:', error)
      return {}
    }
  },
  ['adstir-ad-settings'],
  { revalidate: 300, tags: ['site_settings'] },
)

export async function getAdstirAdSettings(): Promise<Record<string, string>> {
  return getCachedAdstirAdSettings()
}
