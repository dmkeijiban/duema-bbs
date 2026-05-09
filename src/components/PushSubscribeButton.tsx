'use client'

import { useEffect, useState, useTransition } from 'react'
import { saveSubscription, deleteSubscription } from '@/app/actions/push-subscription'

interface Props {
  threadId: number
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

const STORAGE_KEY = (threadId: number) => `push_sub_${threadId}`

export function PushSubscribeButton({ threadId }: Props) {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined') return 'default'
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unsupported'
    }
    return Notification.permission as PermissionState
  })
  const [subscribed, setSubscribed] = useState(false)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)

    // localStorage から購読済みエンドポイントを復元
    const stored = localStorage.getItem(STORAGE_KEY(threadId))
    if (stored) {
      setSubscribed(true)
      setEndpoint(stored)
    }
  }, [threadId])

  if (permission === 'unsupported') return null
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
        // Service Worker 登録
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        // 通知許可リクエスト
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setPermission('denied')
          setMessage('通知が許可されませんでした')
          return
        }
        setPermission('granted')

        // Push 購読
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ) as unknown as ArrayBuffer,
        })

        const subJson = sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string; auth: string }
        }

        const result = await saveSubscription(threadId, subJson)
        if (result.error) {
          setMessage(result.error)
          return
        }

        localStorage.setItem(STORAGE_KEY(threadId), subJson.endpoint)
        setEndpoint(subJson.endpoint)
        setSubscribed(true)
        setMessage('通知をオンにしました ✓')
        setTimeout(() => setMessage(''), 3000)
      } catch (err) {
        console.error('Subscribe error:', err)
        setMessage('通知の設定に失敗しました')
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

  return (
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
        <span className="text-xs text-gray-500">{message}</span>
      )}
    </div>
  )
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
