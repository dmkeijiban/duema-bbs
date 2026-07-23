import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'
import { ADSTIR_SETTING_KEYS, readAdstirAdSettings, type AdstirSlotName } from '@/lib/adstir'
import { getGoodlifeAdSettings } from '@/lib/ads-server'
import { readGoodlifeAdSettings } from '@/lib/ads'
import { getGamAdSettings } from '@/lib/gam-server'
import { readGamAdSettings } from '@/lib/gam'

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

export type AdstirVisibility = {
  listTop: boolean
  listMiddle: boolean
  threadInline: boolean
}

// 各ページで1回だけ呼び出して表示要否を確定させる。ここでfalseになった枠は
// 呼び出し側で要素そのもの（親要素・grid item含む）を一切レンダリングしないこと。
export async function getAdstirVisibility(): Promise<AdstirVisibility> {
  const [adstirRaw, goodlifeRaw, gamRaw] = await Promise.all([
    getAdstirAdSettings(),
    getGoodlifeAdSettings(),
    getGamAdSettings(),
  ])
  const settings = readAdstirAdSettings(adstirRaw)

  if (!settings.enabled) {
    return { listTop: false, listMiddle: false, threadInline: false }
  }

  // 一覧上部・スレ内はGoodlife/GAMと同一位置になり得るため、同じ場所のスマホ表示が
  // 既にONの場合はadstir側を自動非表示にして重複表示を防ぐ。
  const goodlife = readGoodlifeAdSettings(goodlifeRaw)
  const gam = readGamAdSettings(gamRaw)

  const suppressed = (slot: AdstirSlotName) => {
    const goodlifeSameSlotOnMobile = goodlife.enabled && goodlife.mobile && (
      slot === 'sp_list_top' ? goodlife.threadList : slot === 'sp_thread_inline' ? goodlife.threadDetail : false
    )
    const gamSameSlotOnMobile = gam.enabled && (
      slot === 'sp_list_top' ? gam.listTopMobile : slot === 'sp_thread_inline' ? gam.threadDetailMobile : false
    )
    return goodlifeSameSlotOnMobile || gamSameSlotOnMobile
  }

  return {
    listTop: settings.listTop && !suppressed('sp_list_top'),
    listMiddle: settings.listMiddle,
    threadInline: settings.threadInline && !suppressed('sp_thread_inline'),
  }
}
