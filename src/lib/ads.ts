export const GOODLIFE_SCRIPT_URL = 'https://gen2.glssp.net/c/p/4778/81/glad.js'

// Emergency kill switch. Keep all Goodlife inline placements disabled until the
// creative size and placement have been reviewed.
export const GOODLIFE_INLINE_ADS_EMERGENCY_DISABLED = true

export type AdSlotName = 'thread_list_inline' | 'thread_detail_inline'

export type GoodlifeAdSettings = {
  enabled: boolean
  threadList: boolean
  threadDetail: boolean
  desktop: boolean
  mobile: boolean
}

export const GOODLIFE_SETTING_DEFAULTS: GoodlifeAdSettings = {
  enabled: false,
  threadList: true,
  threadDetail: false,
  desktop: true,
  mobile: false,
}

export function readGoodlifeAdSettings(settings: Record<string, string>): GoodlifeAdSettings {
  const read = (key: string, fallback: boolean) => settings[key] == null ? fallback : settings[key] === 'true'
  return {
    enabled: !GOODLIFE_INLINE_ADS_EMERGENCY_DISABLED
      && read('goodlife_inline_enabled', GOODLIFE_SETTING_DEFAULTS.enabled),
    threadList: read('goodlife_inline_thread_list', GOODLIFE_SETTING_DEFAULTS.threadList),
    threadDetail: read('goodlife_inline_thread_detail', GOODLIFE_SETTING_DEFAULTS.threadDetail),
    desktop: read('goodlife_inline_desktop', GOODLIFE_SETTING_DEFAULTS.desktop),
    mobile: read('goodlife_inline_mobile', GOODLIFE_SETTING_DEFAULTS.mobile),
  }
}
