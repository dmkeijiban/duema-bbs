'use client'

type PostHogClient = {
  capture?: (eventName: string, properties?: Record<string, unknown>) => void
}

type PostHogWindow = Window & {
  posthog?: PostHogClient
}

export function capturePostHogEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  const posthog = (window as PostHogWindow).posthog
  posthog?.capture?.(eventName, properties)
}
