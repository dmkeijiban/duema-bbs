'use client'

import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import type { GamAdSettings } from '@/lib/gam'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-w-36 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition active:scale-95 disabled:cursor-wait disabled:bg-blue-400"
    >
      {pending ? '保存中…' : 'GAM広告設定を保存'}
    </button>
  )
}

export function GamSettingsForm({
  action,
  ads,
}: {
  action: (formData: FormData) => void | Promise<void>
  ads: GamAdSettings
}) {
  const [enabled, setEnabled] = useState(ads.enabled)
  const [listTopDesktop, setListTopDesktop] = useState(ads.listTopDesktop)
  const [listTopMobile, setListTopMobile] = useState(ads.listTopMobile)
  const [listInfeedDesktop, setListInfeedDesktop] = useState(ads.listInfeedDesktop)
  const [listInfeedMobile, setListInfeedMobile] = useState(ads.listInfeedMobile)
  const [footerDesktop, setFooterDesktop] = useState(ads.footerDesktop)
  const [footerMobile, setFooterMobile] = useState(ads.footerMobile)
  const [threadDetailDesktop, setThreadDetailDesktop] = useState(ads.threadDetailDesktop)
  const [threadDetailMobile, setThreadDetailMobile] = useState(ads.threadDetailMobile)

  const enablePlacement = (setter: (value: boolean) => void, value: boolean) => {
    setter(value)
    if (value) setEnabled(true)
  }

  const slots = [
    ['スレッド一覧・上部', [
      ['gam_list_top_desktop', 'PC', listTopDesktop, setListTopDesktop],
      ['gam_list_top_mobile', 'スマホ', listTopMobile, setListTopMobile],
    ]],
    ['スレッド一覧・リスト内', [
      ['gam_list_infeed_desktop', 'PC', listInfeedDesktop, setListInfeedDesktop],
      ['gam_list_infeed_mobile', 'スマホ', listInfeedMobile, setListInfeedMobile],
    ]],
    ['フッター直前', [
      ['gam_footer_desktop', 'PC', footerDesktop, setFooterDesktop],
      ['gam_footer_mobile', 'スマホ', footerMobile, setFooterMobile],
    ]],
    ['スレッド詳細', [
      ['gam_thread_detail_desktop', 'PC', threadDetailDesktop, setThreadDetailDesktop],
      ['gam_thread_detail_mobile', 'スマホ', threadDetailMobile, setThreadDetailMobile],
    ]],
  ] as const

  const anyPlacementOn = slots.some(([, rows]) => rows.some(([, , checked]) => checked))
  const canDisplay = enabled && anyPlacementOn

  return (
    <form action={action} className="mt-5 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-black">GAM広告（Google Ad Manager）</h2>
      <p className="text-xs text-gray-500">
        枠ごとにPC/スマホ別でON/OFFできます。
        「一覧・上部」「フッター直前」はGoodlife側が同じ場所・同じデバイスでONの場合、GAMを自動的に非表示にして重複表示を防ぎます。
      </p>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          name="gam_enabled"
          checked={enabled}
          onChange={event => setEnabled(event.target.checked)}
          className="h-5 w-5"
        />
        <span>GAM広告を有効にする（全体スイッチ）</span>
      </label>
      {slots.map(([slotLabel, rows]) => (
        <div key={slotLabel} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs font-bold text-gray-700">{slotLabel}</p>
          <div className="mt-1 flex gap-5">
            {rows.map(([name, label, checked, setter]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  checked={checked}
                  onChange={event => enablePlacement(setter, event.target.checked)}
                  className="h-5 w-5"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {!canDisplay && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          広告を表示するには「全体スイッチ」＋いずれかの枠のPCまたはスマホをONにしてください。
        </p>
      )}
      <div className="flex items-center gap-3">
        <SaveButton />
        <span className="text-xs font-bold text-gray-500">押すと「保存中…」に変わります</span>
      </div>
    </form>
  )
}
