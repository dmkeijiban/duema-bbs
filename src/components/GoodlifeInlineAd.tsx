import Script from 'next/script'
import { getAllSettings } from '@/lib/settings'
import { GOODLIFE_SCRIPT_URL, readGoodlifeAdSettings, type AdSlotName } from '@/lib/ads'

export async function GoodlifeInlineAd({ slot }: { slot: AdSlotName }) {
  const settings = readGoodlifeAdSettings(await getAllSettings())
  const slotEnabled = slot === 'thread_list_inline' ? settings.threadList : settings.threadDetail
  if (!settings.enabled || !slotEnabled || (!settings.desktop && !settings.mobile)) return null

  const visibilityClass = settings.desktop && settings.mobile
    ? ''
    : settings.desktop
      ? 'hidden md:block'
      : 'md:hidden'

  return (
    <aside
      className={`${visibilityClass} my-3 w-full max-w-full overflow-hidden text-center`}
      data-ad-provider="goodlife"
      data-ad-slot={slot}
      aria-label="広告"
    >
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <div className="mx-auto max-w-full overflow-hidden">
        <Script
          id={`goodlife-${slot}`}
          src={GOODLIFE_SCRIPT_URL}
          strategy="lazyOnload"
          charSet="utf-8"
        />
      </div>
    </aside>
  )
}
