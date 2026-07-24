import { getGoodlifeAdSettings } from '@/lib/ads-server'
import { readGoodlifeAdSettings, type AdSlotName } from '@/lib/ads'
import { GoodlifeInlineAdClient } from '@/components/GoodlifeInlineAdClient'

export async function GoodlifeInlineAd({
  slot,
  mobileOnly = false,
}: {
  slot: AdSlotName
  mobileOnly?: boolean
}) {
  const settings = readGoodlifeAdSettings(await getGoodlifeAdSettings())
  const slotEnabled = slot === 'thread_list_inline'
    ? settings.threadList
    : slot === 'thread_detail_inline'
      ? settings.threadDetail
      : settings.footer

  const desktopEnabled = mobileOnly ? false : settings.desktop
  const mobileEnabled = settings.mobile
  const inlineEnabled = settings.enabled && slotEnabled && (desktopEnabled || mobileEnabled)
  const visibilityClass = desktopEnabled && mobileEnabled
    ? ''
    : desktopEnabled
      ? 'hidden md:flex'
      : 'md:hidden'

  return (
    <>
      {inlineEnabled && (
        <GoodlifeInlineAdClient
          slot={slot}
          visibilityClass={visibilityClass}
          desktopEnabled={desktopEnabled}
          mobileEnabled={mobileEnabled}
        />
      )}
    </>
  )
}
