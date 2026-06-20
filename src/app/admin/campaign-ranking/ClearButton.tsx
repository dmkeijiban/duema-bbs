'use client'

import { clearCampaignRankingAction } from './actions'

export function ClearButton() {
  return (
    <form
      action={clearCampaignRankingAction}
      onSubmit={(e) => {
        if (!confirm('キャンペーン設定をすべてクリアしますか？')) e.preventDefault()
      }}
      className="mt-4 pt-4 border-t border-gray-100"
    >
      <button
        type="submit"
        className="px-3 py-1 text-xs text-red-600 border border-red-300 hover:bg-red-50"
      >
        設定をクリアする
      </button>
      <p className="mt-1 text-xs text-gray-400">ステータスを「下書き」に戻し、すべての項目を空にします</p>
    </form>
  )
}
