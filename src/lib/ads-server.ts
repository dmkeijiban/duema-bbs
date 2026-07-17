import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'

const GOODLIFE_SETTING_KEYS = [
  'goodlife_inline_enabled',
  'goodlife_inline_thread_list',
  'goodlife_inline_thread_detail',
  'goodlife_inline_footer',
  'goodlife_inline_desktop',
  'goodlife_inline_mobile',
] as const

const getCachedGoodlifeAdSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', GOODLIFE_SETTING_KEYS)

      if (error) throw error

      return Object.fromEntries((data ?? []).map(row => [row.key, row.value]))
    } catch (error) {
      console.error('Goodlife広告設定の取得に失敗しました:', error)
      return {}
    }
  },
  ['goodlife-ad-settings'],
  { revalidate: 300, tags: ['site_settings'] },
)

export async function getGoodlifeAdSettings(): Promise<Record<string, string>> {
  return getCachedGoodlifeAdSettings()
}
