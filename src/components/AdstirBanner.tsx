import { getAdstirAdSettings } from '@/lib/adstir-server'
import { getGoodlifeAdSettings } from '@/lib/ads-server'
import { getGamAdSettings } from '@/lib/gam-server'
import { readAdstirAdSettings, type AdstirSlotName } from '@/lib/adstir'
import { readGoodlifeAdSettings } from '@/lib/ads'
import { readGamAdSettings } from '@/lib/gam'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'

export async function AdstirBanner({ slot }: { slot: AdstirSlotName }) {
  const [adstirRaw, goodlifeRaw, gamRaw] = await Promise.all([
    getAdstirAdSettings(),
    getGoodlifeAdSettings(),
    getGamAdSettings(),
  ])
  const settings = readAdstirAdSettings(adstirRaw)
  const slotEnabled = slot === 'sp_list_top'
    ? settings.listTop
    : slot === 'sp_list_middle'
      ? settings.listMiddle
      : settings.threadInline

  if (!settings.enabled || !slotEnabled) return null

  // 一覧上部・スレ内はGoodlife/GAMと同一位置になり得るため、同じ場所のスマホ表示が
  // 既にONの場合はadstir側を自動非表示にして重複表示を防ぐ。
  const goodlife = readGoodlifeAdSettings(goodlifeRaw)
  const gam = readGamAdSettings(gamRaw)
  const goodlifeSameSlotOnMobile = goodlife.enabled && goodlife.mobile && (
    slot === 'sp_list_top' ? goodlife.threadList : slot === 'sp_thread_inline' ? goodlife.threadDetail : false
  )
  const gamSameSlotOnMobile = gam.enabled && (
    slot === 'sp_list_top' ? gam.listTopMobile : slot === 'sp_thread_inline' ? gam.threadDetailMobile : false
  )

  if (goodlifeSameSlotOnMobile || gamSameSlotOnMobile) return null

  return <AdstirBannerClient slot={slot} />
}
