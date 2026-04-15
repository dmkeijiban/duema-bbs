export default function HomeLoading() {
  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        {/* オススメ骨格 */}
        <div className="mb-2 border border-gray-300 bg-white animate-pulse">
          <div className="px-3 py-2 border-b border-gray-300 bg-gray-50" style={{ height: 36 }} />
          <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-300">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ height: 44 }}>
                <div className="bg-gray-200 shrink-0" style={{ width: 44, height: 44 }} />
                <div className="p-1 flex-1 space-y-1.5 pt-2">
                  <div className="h-2 bg-gray-200 rounded w-full" />
                  <div className="h-2 bg-gray-200 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* タブ骨格 */}
        <div className="flex mt-4 mb-3 border-b border-gray-300 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-1 h-8 mx-0.5 bg-gray-200 rounded-t" />
          ))}
        </div>
      </div>

      {/* スレッド一覧骨格 */}
      <div className="max-w-screen-xl mx-auto px-2">
        <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300 animate-pulse">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ minHeight: 52 }}>
              <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
              <div className="p-1.5 flex-1 space-y-1.5 pt-2">
                <div className="h-2 bg-gray-200 rounded w-full" />
                <div className="h-2 bg-gray-200 rounded w-4/5" />
                <div className="h-2 bg-gray-100 rounded w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
