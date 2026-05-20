'use client'

import { useEffect, useState, useTransition } from 'react'
import { saveSubscription, deleteSubscription } from '@/app/actions/push-subscription'

interface Props {
  threadId: number
  hideWhenSubscribed?: boolean
  /** true にすると「このスレの新着レスを通知で受け取る」ラベル付きのブロックとして自己完結レンダリング */
  cta?: boolean
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

const STORAGE_KEY = (threadId: number) => `push_sub_v2_${threadId}`

export function PushSubscribeButton({ threadId, hideWhenSubscribed = false, cta = false }: Props) {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined') return 'default'
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unsupported'
    }
    return Notification.permission as PermissionState
  })
  const [hydrated, setHydrated] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (permission === 'unsupported' || permission === 'denied') {
      setHydrated(true)
      return
    }

    let cancelled = false

    navigator.serviceWorker
      .getRegistration()
      .then(registration => registration?.pushManager.getSubscription() ?? null)
      .then(subscription => {
        if (cancelled) return

        const nextEndpoint = subscription?.endpoint ?? null
        const storedEndpoint = localStorage.getItem(STORAGE_KEY(threadId))

        // always purge stale v1 keys written by old buggy code
        localStorage.removeItem(`push_sub_${threadId}`)

        if (nextEndpoint && storedEndpoint && nextEndpoint === storedEndpoint) {
          setEndpoint(nextEndpoint)
          setSubscribed(true)
        } else {
          localStorage.removeItem(STORAGE_KEY(threadId))
          setEndpoint(null)
          setSubscribed(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem(STORAGE_KEY(threadId))
        setEndpoint(null)
        setSubscribed(false)
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [permission, threadId])

  if (!hydrated) return null
  if (permission === 'unsupported') {
    return null
  }
  if (hideWhenSubscribed && subscribed) return null
  if (permission === 'denied') {
    return (
      <span className="text-xs text-gray-400">
        ブラウザで通知がブロックされています
      </span>
    )
  }

  const handleSubscribe = () => {
    startTransition(async () => {
      setMessage('')
      try {
        // Service Worker 登録 → active になるまで待つ
        await navigator.serviceWorker.register('/sw.js')
        const readyReg = await navigator.serviceWorker.ready

        // 通知許可リクエスト
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setPermission('denied')
          setMessage('ブラウザで通知をブロックしています。ブラウザ設定から許可してください。')
          return
        }
        setPermission('granted')

        // 既存の購読を確認 — 別VAPIDキーで登録済みだと subscribe() が例外を投げるため
        let sub = await readyReg.pushManager.getSubscription()
        if (!sub) {
          // 新規購読
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (!vapidKey) {
            setMessage('設定エラー: VAPIDキーが見つかりません')
            return
          }
          try {
            sub = await readyReg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
            })
          } catch (subErr) {
            console.error('pushManager.subscribe error:', subErr)
            // 既存購読が別キーで残っている場合は一度解除して再試行
            const stale = await readyReg.pushManager.getSubscription()
            if (stale) {
              await stale.unsubscribe()
              sub = await readyReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
              })
            } else {
              throw subErr
            }
          }
        }

        const subJson = sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string; auth: string }
        }

        const result = await saveSubscription(threadId, subJson)
        if (result.error) {
          setMessage(`登録エラー: ${result.error}`)
          return
        }

        localStorage.setItem(STORAGE_KEY(threadId), subJson.endpoint)
        setEndpoint(subJson.endpoint)
        setSubscribed(true)
        setMessage('通知をオンにしました ✓')
        setTimeout(() => setMessage(''), 3000)
      } catch (err) {
        console.error('Subscribe error:', err)
        const msg = err instanceof Error ? err.message : String(err)
        setMessage(`通知の設定に失敗しました: ${msg}`)
      }
    })
  }

  const handleUnsubscribe = () => {
    if (!endpoint) return
    startTransition(async () => {
      setMessage('')
      try {
        await deleteSubscription(endpoint)
        localStorage.removeItem(STORAGE_KEY(threadId))
        setEndpoint(null)
        setSubscribed(false)
        setMessage('通知をオフにしました')
        setTimeout(() => setMessage(''), 3000)
      } catch (err) {
        console.error('Unsubscribe error:', err)
        setMessage('解除に失敗しました')
      }
    })
  }

  const inner = (
    <div className="flex items-center gap-2">
      {!subscribed ? (
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={isPending}
          className="border border-gray-300 px-3 py-1 text-xs bg-white hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? '設定中...' : '🔔 返信通知をオン'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={isPending}
          className="border border-gray-300 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 cursor-pointer text-gray-600"
        >
          {isPending ? '解除中...' : '🔕 通知をオフ'}
        </button>
      )}
      {message && (
        <span className={`text-xs ${message.includes('失敗') || message.includes('エラー') || message.includes('ブロック') ? 'text-red-600' : 'text-gray-500'}`}>{message}</span>
      )}
    </div>
  )

  if (cta) {
    return (
      <div className="mt-3 border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 flex flex-wrap items-center gap-2">
        <span>このスレの新着レスを通知で受け取る</span>
        {inner}
      </div>
    )
  }

  return inner
}

/** Base64URL → Uint8Array（VAPID公開鍵変換用） */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
