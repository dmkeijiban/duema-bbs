export const GOODLIFE_SCRIPT_URL = 'https://gen2.glssp.net/c/p/4778/81/glad.js'
export const GOODLIFE_WIPE_SCRIPT_URL = 'https://gen2.glssp.net/c/p/4778/10/glad.js'

// Emergency kill switch. Set to true only when all Goodlife inline placements
// must be stopped regardless of the saved management-screen settings.
export const GOODLIFE_INLINE_ADS_EMERGENCY_DISABLED = false

export type AdSlotName = 'thread_list_inline' | 'thread_detail_inline' | 'footer_inline'

export type GoodlifeAdSettings = {
  enabled: boolean
  wipeEnabled: boolean
  threadList: boolean
  threadDetail: boolean
  footer: boolean
  desktop: boolean
  mobile: boolean
}

export const GOODLIFE_SETTING_DEFAULTS: GoodlifeAdSettings = {
  enabled: false,
  wipeEnabled: true,
  threadList: true,
  threadDetail: false,
  footer: false,
  desktop: true,
  mobile: false,
}

export function readGoodlifeAdSettings(settings: Record<string, string>): GoodlifeAdSettings {
  const read = (key: string, fallback: boolean) => settings[key] == null ? fallback : settings[key] === 'true'
  return {
    enabled: !GOODLIFE_INLINE_ADS_EMERGENCY_DISABLED
      && read('goodlife_inline_enabled', GOODLIFE_SETTING_DEFAULTS.enabled),
    wipeEnabled: read('goodlife_wipe_enabled', GOODLIFE_SETTING_DEFAULTS.wipeEnabled),
    threadList: read('goodlife_inline_thread_list', GOODLIFE_SETTING_DEFAULTS.threadList),
    threadDetail: read('goodlife_inline_thread_detail', GOODLIFE_SETTING_DEFAULTS.threadDetail),
    footer: read('goodlife_inline_footer', GOODLIFE_SETTING_DEFAULTS.footer),
    desktop: read('goodlife_inline_desktop', GOODLIFE_SETTING_DEFAULTS.desktop),
    mobile: read('goodlife_inline_mobile', GOODLIFE_SETTING_DEFAULTS.mobile),
  }
}
