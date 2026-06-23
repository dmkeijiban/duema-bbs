'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  return target.closest('a')
}

function eventNameForInternalHref(href: string) {
  if (href === '/ranking' || href.startsWith('/ranking?')) return 'ranking_link_click'
  if (href === '/zukan' || href.startsWith('/zukan?')) return 'zukan_link_click'
  if (href === '/thread/new') return 'thread_new_link_click'
  if (href === '/login' || href.startsWith('/login?')) return 'login_link_click'
  if (href === '/profile/new') return 'profile_new_link_click'
  if (href.startsWith('/summary/') && href !== '/summary/') return 'summary_link_click'
  return null
}

function eventNameForExternalHref(href: string) {
  try {
    const url = new URL(href)
    const host = url.hostname.toLowerCase()

    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) {
      return 'sns_x_click'
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
      return 'sns_youtube_click'
    }

    if (host === 'discord.gg' || host.endsWith('.discord.gg') || host === 'discord.com' || host.endsWith('.discord.com')) {
      return 'sns_discord_click'
    }
  } catch {
    return null
  }

  return null
}

function eventNameForForm(form: HTMLFormElement) {
  const action = form.getAttribute('action') ?? ''
  const path = window.location.pathname

  if (path === '/thread/new') return 'thread_create_form_submit'
  if (path.startsWith('/thread/')) return 'comment_form_submit'
  if (path === '/profile/new') return 'profile_create_form_submit'
  if (path === '/mypage/edit') return 'profile_edit_form_submit'
  if (path.startsWith('/zukan/card/')) return 'zukan_card_form_submit'
  if (path.startsWith('/zukan/pack/')) return 'zukan_pack_form_submit'

  if (action.includes('/auth')) return 'auth_form_submit'
  return null
}

export function PostHogEventBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = findAnchor(event.target)
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      const eventName = href.startsWith('/')
        ? eventNameForInternalHref(href)
        : eventNameForExternalHref(href)

      if (!eventName) return

      capturePostHogEvent(eventName, {
        href,
        from_path: window.location.pathname,
      })
    }

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return

      const eventName = eventNameForForm(form)
      if (!eventName) return

      capturePostHogEvent(eventName, {
        from_path: window.location.pathname,
      })
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('submit', handleSubmit, true)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('submit', handleSubmit, true)
    }
  }, [])

  return null
}
