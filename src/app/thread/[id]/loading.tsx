export default function ThreadLoading() {
  return (
    <div className="max-w-screen-xl mx-auto px-2 py-2 animate-pulse">
      {/* タイトルバー */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2 border border-gray-300 bg-white">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
      </div>

      {/* OP + レス骨格 */}
      <div className="border border-gray-300 bg-white">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border-b border-gray-200 last:border-b-0">
            <div className="px-2 py-1.5 bg-gray-50 flex gap-3">
              <div className="h-3 w-6 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-4/5" />
              {i === 0 && <div className="h-3 bg-gray-200 rounded w-3/5" />}
            </div>
            {/* 1件目だけ画像プレースホルダ */}
            {i === 0 && (
              <div className="px-3 pb-3">
                <div className="bg-gray-200 rounded" style={{ width: 120, height: 80 }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
