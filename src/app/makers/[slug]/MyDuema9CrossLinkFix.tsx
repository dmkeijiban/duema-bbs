'use client'

import { useEffect } from 'react'

const RESUME_HREF = '/makers/resume-maker'
const MAKERS_HREF = '/makers'
const WRAPPER_MARKER = 'my-duema-9-cross-links'

export default function MyDuema9CrossLinkFix() {
  useEffect(() => {
    if (document.querySelector(`[data-cross-links="${WRAPPER_MARKER}"]`)) return

    const resumeLink = document.querySelector<HTMLAnchorElement>(`a[href="${RESUME_HREF}"]`)
    if (!resumeLink) return

    const wrapper = document.createElement('div')
    wrapper.className = 'mb-3 grid grid-cols-2 gap-2'
    wrapper.dataset.crossLinks = WRAPPER_MARKER

    const otherNineLink = resumeLink.cloneNode(true) as HTMLAnchorElement
    otherNineLink.href = MAKERS_HREF
    otherNineLink.textContent = '他の9選を作る'

    resumeLink.textContent = 'デュエマ履歴書を作る'
    otherNineLink.classList.remove('mb-3')
    resumeLink.classList.remove('mb-3')

    resumeLink.replaceWith(wrapper)
    wrapper.append(otherNineLink, resumeLink)
  }, [])

  return null
}
