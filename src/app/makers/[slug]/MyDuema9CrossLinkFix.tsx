'use client'

import { useEffect } from 'react'

const ORIGINAL_HREF = '/makers/resume-maker'
const TARGET_HREF = '/makers'

export default function MyDuema9CrossLinkFix() {
  useEffect(() => {
    const link = document.querySelector<HTMLAnchorElement>(`a[href="${ORIGINAL_HREF}"]`)
    if (!link) return

    link.href = TARGET_HREF
    link.textContent = '他の9選も作る'
  }, [])

  return <style>{`a[href="${ORIGINAL_HREF}"]{visibility:hidden}`}</style>
}
