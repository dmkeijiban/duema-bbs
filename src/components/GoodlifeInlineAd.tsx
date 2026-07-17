import { getGoodlifeAdSettings } from '@/lib/ads-server'
import { readGoodlifeAdSettings, type AdSlotName } from '@/lib/ads'
import { GoodlifeInlineAdClient } from '@/components/GoodlifeInlineAdClient'

export async function GoodlifeInlineAd({ slot }: { slot: AdSlotName }) {
  const settings = readGoodlifeAdSettings(await getGoodlifeAdSettings())
  const slotEnabled = slot === 'thread_list_inline'
    ? settings.threadList
    : slot === 'thread_detail_inline'
      ? settings.threadDetail
      : settings.footer

  if (!settings.enabled || !slotEnabled || (!settings.desktop && !settings.mobile)) return null

  const visibilityClass = settings.desktop && settings.mobile
    ? ''
    : settings.desktop
      ? 'hidden md:flex'
      : 'md:hidden'

  return (
    <GoodlifeInlineAdClient
      slot={slot}
      visibilityClass={visibilityClass}
      desktopEnabled={settings.desktop}
      mobileEnabled={settings.mobile}
    />
  )
}
