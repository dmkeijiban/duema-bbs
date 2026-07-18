export const GPT_SCRIPT_URL = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'

// Emergency kill switch. Set to true only when all GAM placements must be
// stopped regardless of the saved management-screen settings.
export const GAM_ADS_EMERGENCY_DISABLED = false

export type GamSlotName = 'list_top' | 'list_infeed' | 'footer' | 'thread_detail'

export type GamSlotConfig = {
  /** GAM ad unit path (network 23361034397) */
  path: string
  /** Unique div id — one instance of each slot per page */
  divId: string
  /** Sizes served at viewport >= 768px */
  desktopSizes: [number, number][]
  /** Sizes served at viewport < 768px */
  mobileSizes: [number, number][]
  /** Height reserved before render to limit CLS (desktop / mobile, px) */
  desktopMinHeight: number
  mobileMinHeight: number
}

export const GAM_SLOTS: Record<GamSlotName, GamSlotConfig> = {
  list_top: {
    path: '/23361034397/duema_list_top',
    divId: 'gam-duema-list-top',
    desktopSizes: [[728, 90]],
    mobileSizes: [[320, 100], [320, 50]],
    desktopMinHeight: 90,
    mobileMinHeight: 100,
  },
  list_infeed: {
    path: '/23361034397/duema_list_infeed',
    divId: 'gam-duema-list-infeed',
    desktopSizes: [[336, 280], [300, 250]],
    mobileSizes: [[300, 250]],
    desktopMinHeight: 280,
    mobileMinHeight: 250,
  },
  footer: {
    path: '/23361034397/duema_footer',
    divId: 'gam-duema-footer',
    desktopSizes: [[728, 90], [300, 250]],
    mobileSizes: [[320, 100], [320, 50], [300, 250]],
    desktopMinHeight: 250,
    mobileMinHeight: 250,
  },
  thread_detail: {
    path: '/23361034397/duema_thread_detail',
    divId: 'gam-duema-thread-detail',
    desktopSizes: [[336, 280], [300, 250], [728, 90]],
    mobileSizes: [[300, 250]],
    desktopMinHeight: 280,
    mobileMinHeight: 250,
  },
}

export type GamAdSettings = {
  enabled: boolean
  listTopDesktop: boolean
  listTopMobile: boolean
  listInfeedDesktop: boolean
  listInfeedMobile: boolean
  footerDesktop: boolean
  footerMobile: boolean
  threadDetailDesktop: boolean
  threadDetailMobile: boolean
}

// 初期状態は全てOFF（本番反映後に管理画面から枠別・PC/SP別に有効化する）
export const GAM_SETTING_DEFAULTS: GamAdSettings = {
  enabled: false,
  listTopDesktop: false,
  listTopMobile: false,
  listInfeedDesktop: false,
  listInfeedMobile: false,
  footerDesktop: false,
  footerMobile: false,
  threadDetailDesktop: false,
  threadDetailMobile: false,
}

export const GAM_SETTING_KEYS = [
  'gam_enabled',
  'gam_list_top_desktop',
  'gam_list_top_mobile',
  'gam_list_infeed_desktop',
  'gam_list_infeed_mobile',
  'gam_footer_desktop',
  'gam_footer_mobile',
  'gam_thread_detail_desktop',
  'gam_thread_detail_mobile',
] as const

export function readGamAdSettings(settings: Record<string, string>): GamAdSettings {
  const read = (key: string, fallback: boolean) => settings[key] == null ? fallback : settings[key] === 'true'
  return {
    enabled: !GAM_ADS_EMERGENCY_DISABLED && read('gam_enabled', GAM_SETTING_DEFAULTS.enabled),
    listTopDesktop: read('gam_list_top_desktop', GAM_SETTING_DEFAULTS.listTopDesktop),
    listTopMobile: read('gam_list_top_mobile', GAM_SETTING_DEFAULTS.listTopMobile),
    listInfeedDesktop: read('gam_list_infeed_desktop', GAM_SETTING_DEFAULTS.listInfeedDesktop),
    listInfeedMobile: read('gam_list_infeed_mobile', GAM_SETTING_DEFAULTS.listInfeedMobile),
    footerDesktop: read('gam_footer_desktop', GAM_SETTING_DEFAULTS.footerDesktop),
    footerMobile: read('gam_footer_mobile', GAM_SETTING_DEFAULTS.footerMobile),
    threadDetailDesktop: read('gam_thread_detail_desktop', GAM_SETTING_DEFAULTS.threadDetailDesktop),
    threadDetailMobile: read('gam_thread_detail_mobile', GAM_SETTING_DEFAULTS.threadDetailMobile),
  }
}

export function gamSlotFlags(settings: GamAdSettings, slot: GamSlotName): { desktop: boolean; mobile: boolean } {
  switch (slot) {
    case 'list_top':
      return { desktop: settings.listTopDesktop, mobile: settings.listTopMobile }
    case 'list_infeed':
      return { desktop: settings.listInfeedDesktop, mobile: settings.listInfeedMobile }
    case 'footer':
      return { desktop: settings.footerDesktop, mobile: settings.footerMobile }
    case 'thread_detail':
      return { desktop: settings.threadDetailDesktop, mobile: settings.threadDetailMobile }
  }
}
