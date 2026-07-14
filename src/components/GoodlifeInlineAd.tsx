import { getAllSettings } from '@/lib/settings'
import { readGoodlifeAdSettings, type AdSlotName } from '@/lib/ads'
import { GoodlifeInlineAdClient } from '@/components/GoodlifeInlineAdClient'

export async function GoodlifeInlineAd({ slot }: { slot: AdSlotName }) {
  const settings = readGoodlifeAdSettings(await getAllSettings())
  const slotEnabled = slot === 'thread_list_inline' ? settings.threadList : settings.threadDetail
  if (!settings.enabled || !slotEnabled || (!settings.desktop && !settings.mobile)) return null

  const visibilityClass = settings.desktop && settings.mobile
    ? ''
    : settings.desktop
      ? 'hidden md:flex'
      : 'md:hidden'

  return <GoodlifeInlineAdClient slot={slot} visibilityClass={visibilityClass} />
}
