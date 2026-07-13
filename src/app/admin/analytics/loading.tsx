export default function Loading() {
  return <div className="space-y-3" aria-busy="true" aria-label="分析データを読み込み中">
    <div className="h-10 animate-pulse rounded bg-gray-200" />
    <div className="grid gap-2 sm:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded border bg-white" />)}
    </div>
  </div>
}
