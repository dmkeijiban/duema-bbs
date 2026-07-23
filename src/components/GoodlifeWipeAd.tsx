'use client'

import { useEffect } from 'react'
import { GOODLIFE_WIPE_SCRIPT_URL } from '@/lib/ads'

const SCRIPT_ID = 'goodlife-wipe-ad-script'
const SHOWN_DATE_KEY = 'goodlife_wipe_shown_date'

function getLocalDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function wasShownToday() {
  try {
    return window.localStorage.getItem(SHOWN_DATE_KEY) === getLocalDateKey()
  } catch {
    return false
  }
}

function rememberShownToday() {
  try {
    window.localStorage.setItem(SHOWN_DATE_KEY, getLocalDateKey())
  } catch {
    // localStorageが利用できない環境では、広告側の通常動作を維持する。
  }
}

export function GoodlifeWipeAd({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !window.matchMedia('(max-width: 767px)').matches) return
    if (wasShownToday() || document.getElementById(SCRIPT_ID)) return

    // その日の初回表示時点で記録し、ページ遷移・再読み込み後は同日中に再表示しない。
    rememberShownToday()

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.src = GOODLIFE_WIPE_SCRIPT_URL
    script.async = true
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [enabled])

  return null
}
