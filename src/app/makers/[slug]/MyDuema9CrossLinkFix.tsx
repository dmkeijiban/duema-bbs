'use client'

import { useEffect } from 'react'

const RESUME_HREF = '/makers/resume-maker'
const MAKERS_HREF = '/makers'
const WRAPPER_MARKER = 'nine-selection-cross-links'
const LINK_CLASS = 'block rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-bold text-indigo-800 hover:bg-indigo-100'

function createLink(href: string, text: string) {
  const link = document.createElement('a')
  link.href = href
  link.textContent = text
  link.className = LINK_CLASS
  return link
}

export default function MyDuema9CrossLinkFix() {
  useEffect(() => {
    if (document.querySelector(`[data-cross-links="${WRAPPER_MARKER}"]`)) return

    const wrapper = document.createElement('div')
    wrapper.className = 'mb-3 grid grid-cols-2 gap-2'
    wrapper.dataset.crossLinks = WRAPPER_MARKER

    const resumeLink = document.querySelector<HTMLAnchorElement>(`a[href="${RESUME_HREF}"]`)
    if (resumeLink) {
      const otherNineLink = resumeLink.cloneNode(true) as HTMLAnchorElement
      otherNineLink.href = MAKERS_HREF
      otherNineLink.textContent = '他の9選を作る'

      resumeLink.textContent = 'デュエマ履歴書を作る'
      otherNineLink.classList.remove('mb-3')
      resumeLink.classList.remove('mb-3')

      resumeLink.replaceWith(wrapper)
      wrapper.append(otherNineLink, resumeLink)
      return
    }

    const makerGrid = document.querySelector<HTMLElement>('.nine-selection-width > .grid')
    if (!makerGrid) return

    wrapper.append(
      createLink(MAKERS_HREF, '他の9選を作る'),
      createLink(RESUME_HREF, 'デュエマ履歴書を作る'),
    )
    makerGrid.before(wrapper)
  }, [])

  return null
}
