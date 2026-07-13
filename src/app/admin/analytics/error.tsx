'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    <p className="font-bold">分析データの取得に失敗しました。</p>
    <p className="mt-1">接続状態またはmigrationの適用状態を確認し、再試行してください。</p>
    <button type="button" onClick={reset} className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 font-bold">再試行</button>
  </div>
}
