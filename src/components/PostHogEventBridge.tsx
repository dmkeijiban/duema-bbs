'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

const RANKING_SCROLL_KEY = 'duema-ranking-scroll-y'

function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  return target.closest('a')
}

function findButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null
  return target.closest('button')
}

function isRankingNavigation(href: string) {
  return href === '/ranking' || href.startsWith('/ranking?') || href.startsWith('/ranking#')
}

function rememberRankingScroll(href: string) {
  if (!isRankingNavigation(href) || window.location.pathname !== '/ranking') return
  sessionStorage.setItem(RANKING_SCROLL_KEY, String(window.scrollY))

  // App Routerのクライアント遷移後に同じ位置へ戻す。
  // 通常のリンク挙動は邪魔せず、ランキング内タブ切替だけTOP戻りを防ぐ。
  const restore = () => {
    const saved = Number(sessionStorage.getItem(RANKING_SCROLL_KEY))
    if (!Number.isFinite(saved) || saved <= 0) return
    window.scrollTo({ top: saved, behavior: 'auto' })
  }
  setTimeout(restore, 50)
  setTimeout(restore, 150)
  setTimeout(() => sessionStorage.removeItem(RANKING_SCROLL_KEY), 600)
}

function restoreRankingScrollOnLoad() {
  if (window.location.pathname !== '/ranking') return
  const saved = Number(sessionStorage.getItem(RANKING_SCROLL_KEY))
  if (!Number.isFinite(saved) || saved <= 0) return
  requestAnimationFrame(() => {
    window.scrollTo({ top: saved, behavior: 'auto' })
    sessionStorage.removeItem(RANKING_SCROLL_KEY)
  })
}

function eventNameForInternalHref(href: string) {
  if (href === '/ranking' || href.startsWith('/ranking?')) return 'ranking_link_click'
  if (href === '/zukan' || href.startsWith('/zukan?')) return 'zukan_link_click'
  if (href.startsWith('/zukan/card/')) return 'zukan_card_link_click'
  if (href.startsWith('/zukan/pack/')) return 'zukan_pack_link_click'
  if (href === '/thread/new') return 'thread_new_link_click'
  if (href === '/login' || href.startsWith('/login?mode=login') || href.startsWith('/login?next=')) return 'login_link_click'
  if (href === '/login?mode=signup' || href.startsWith('/login?mode=signup&')) return 'account_signup_link_click'
  if (href === '/profile/new') return 'profile_new_link_click'
  if (href === '/mypage' || href.startsWith('/mypage?')) return 'mypage_link_click'
  if (/^\/thread\/\d+\/p\/\d+/.test(href)) return 'thread_page_link_click'
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

function eventNameForLoginButton(button: HTMLButtonElement) {
  if (window.location.pathname !== '/login') return null
  const text = button.textContent ?? ''
  if (text.includes('Googleでログイン')) return 'login_google_click'
  if (text.includes('Googleでアカウント作成')) return 'account_signup_google_click'
  if (text.trim() === 'ログイン') return 'login_tab_click'
  if (text.trim() === 'アカウント作成') return 'account_signup_tab_click'
  return null
}

function eventNameForLoginForm(form: HTMLFormElement) {
  const buttonText = form.querySelector('button[type="submit"]')?.textContent ?? ''
  if (buttonText.includes('アカウント作成') || buttonText.includes('作成中')) return 'account_signup_email_submit'
  if (buttonText.includes('ログイン') || buttonText.includes('ログイン中')) return 'login_email_submit'
  return 'auth_email_form_submit'
}

function eventNameForForm(form: HTMLFormElement) {
  const action = form.getAttribute('action') ?? ''
  const path = window.location.pathname

  if (path === '/login') return eventNameForLoginForm(form)
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
    restoreRankingScrollOnLoad()

    const handleClick = (event: MouseEvent) => {
      const anchor = findAnchor(event.target)
      if (anchor) {
        const href = anchor.getAttribute('href')
        if (!href) return

        rememberRankingScroll(href)

        const eventName = href.startsWith('/')
          ? eventNameForInternalHref(href)
          : eventNameForExternalHref(href)

        if (!eventName) return

        capturePostHogEvent(eventName, {
          href,
          from_path: window.location.pathname,
        })
        return
      }

      const button = findButton(event.target)
      if (!button) return

      const eventName = eventNameForLoginButton(button)
      if (!eventName) return

      capturePostHogEvent(eventName, {
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
