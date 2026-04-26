import { unsubscribeByToken } from '@/app/actions/email-subscription'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = { title: '配信停止 | デュエマ掲示板' }

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params
  const result = await unsubscribeByToken(token)

  const success = !result.error

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className={`border px-6 py-8 rounded-lg ${success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        {success ? (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-lg font-bold text-green-800 mb-2">配信を停止しました</h1>
            <p className="text-sm text-green-700">このスレッドへの返信通知メールは今後送られません。</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-lg font-bold text-red-800 mb-2">配信停止に失敗しました</h1>
            <p className="text-sm text-red-700">{result.error}</p>
            <p className="text-xs text-red-600 mt-2">既に停止済みか、リンクが無効になっている可能性があります。</p>
          </>
        )}
        <Link href="/" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          ← トップに戻る
        </Link>
      </div>
    </div>
  )
}
