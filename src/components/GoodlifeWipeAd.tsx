'use client'

import { useEffect } from 'react'
import { GOODLIFE_WIPE_SCRIPT_URL } from '@/lib/ads'

const SCRIPT_ID = 'goodlife-wipe-ad-script'

export function GoodlifeWipeAd({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !window.matchMedia('(max-width: 767px)').matches) return
    if (document.getElementById(SCRIPT_ID)) return

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
