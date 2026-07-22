/**
 * カード系メーカーと履歴書メーカーを一括でログイン必須にするスイッチ。
 * 再び登録を必須にする場合は true に変更する。
 */
export const MAKER_LOGIN_REQUIRED = false

export function makerRequiresLogin() {
  return MAKER_LOGIN_REQUIRED
}
