export const ADSTIR_APP_ID = 'MEDIA-f6013145'
export const ADSTIR_SCRIPT_URL = 'https://js.ad-stir.com/js/adstir.js'

// Emergency kill switch. Set to true only when all adstir placements
// must be stopped regardless of the saved management-screen settings.
export const ADSTIR_ADS_EMERGENCY_DISABLED = false

export type AdstirSlotName = 'sp_list_top' | 'sp_list_middle' | 'sp_thread_inline'

export const ADSTIR_SLOTS: Record<AdstirSlotName, { adSpaceId: string; adSpot: number; width: number; height: number; label: string }> = {
  sp_list_top: { adSpaceId: '305963', adSpot: 2, width: 320, height: 100, label: 'デュエマ掲示板_SP_スレ一覧上部' },
  sp_list_middle: { adSpaceId: '305964', adSpot: 3, width: 320, height: 100, label: 'デュエマ掲示板_SP_スレ一覧途中' },
  sp_thread_inline: { adSpaceId: '305470', adSpot: 1, width: 300, height: 250, label: 'スマホのスレ内インライン広告' },
}

export type AdstirAdSettings = {
  enabled: boolean
  listTop: boolean
  listMiddle: boolean
  threadInline: boolean
}

// 初期状態は全体スイッチOFF（本番反映後に管理画面から有効化する）
export const ADSTIR_SETTING_DEFAULTS: AdstirAdSettings = {
  enabled: false,
  listTop: true,
  listMiddle: true,
  threadInline: true,
}

export const ADSTIR_SETTING_KEYS = [
  'adstir_enabled',
  'adstir_sp_list_top',
  'adstir_sp_list_middle',
  'adstir_sp_thread_inline',
] as const

export function readAdstirAdSettings(settings: Record<string, string>): AdstirAdSettings {
  const read = (key: string, fallback: boolean) => settings[key] == null ? fallback : settings[key] === 'true'
  return {
    enabled: !ADSTIR_ADS_EMERGENCY_DISABLED && read('adstir_enabled', ADSTIR_SETTING_DEFAULTS.enabled),
    listTop: read('adstir_sp_list_top', ADSTIR_SETTING_DEFAULTS.listTop),
    listMiddle: read('adstir_sp_list_middle', ADSTIR_SETTING_DEFAULTS.listMiddle),
    threadInline: read('adstir_sp_thread_inline', ADSTIR_SETTING_DEFAULTS.threadInline),
  }
}
