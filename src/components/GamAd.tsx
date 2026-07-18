import { getGamAdSettings } from '@/lib/gam-server'
import { getGoodlifeAdSettings } from '@/lib/ads-server'
import { readGoodlifeAdSettings } from '@/lib/ads'
import { gamSlotFlags, readGamAdSettings, type GamSlotName } from '@/lib/gam'
import { GamAdClient } from '@/components/GamAdClient'

// CLS対策: 各枠で配信されうる最大クリエイティブの高さを事前確保する
// （Tailwind JITが検出できるようリテラルで列挙）
const MIN_HEIGHT_CLASSES: Record<GamSlotName, string> = {
  list_top: 'min-h-[100px] md:min-h-[90px]',
  list_infeed: 'min-h-[250px] md:min-h-[280px]',
  footer: 'min-h-[250px]',
  thread_detail: 'min-h-[250px] md:min-h-[280px]',
}

export async function GamAd({ slot }: { slot: GamSlotName }) {
  const [gamRaw, goodlifeRaw] = await Promise.all([
    getGamAdSettings(),
    getGoodlifeAdSettings(),
  ])
  const settings = readGamAdSettings(gamRaw)
  if (!settings.enabled) return null

  const flags = gamSlotFlags(settings, slot)

  // 一覧上部・フッター前はGoodlifeと同一位置。GoodlifeがONのデバイスでは
  // GAM側を自動非表示にして、同じ場所への重複表示を構造的に防ぐ。
  const goodlife = readGoodlifeAdSettings(goodlifeRaw)
  const goodlifeSameSlotOn = goodlife.enabled && (
    slot === 'list_top' ? goodlife.threadList : slot === 'footer' ? goodlife.footer : false
  )
  const desktop = flags.desktop && !(goodlifeSameSlotOn && goodlife.desktop)
  const mobile = flags.mobile && !(goodlifeSameSlotOn && goodlife.mobile)

  if (!desktop && !mobile) return null

  const visibilityClass = desktop && mobile
    ? ''
    : desktop
      ? 'hidden md:flex'
      : 'md:hidden'

  return (
    <GamAdClient
      slot={slot}
      visibilityClass={visibilityClass}
      desktopEnabled={desktop}
      mobileEnabled={mobile}
      minHeightClass={MIN_HEIGHT_CLASSES[slot]}
    />
  )
}
