export default function CardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-2 pt-2 pb-4">
      <div className="h-1 w-full rounded-full bg-blue-200 animate-pulse mb-4" />
      <div className="mb-5 grid gap-4 border border-gray-200 bg-gray-100 p-4 md:grid-cols-[170px_1fr] animate-pulse">
        <div className="mx-auto w-full max-w-[170px] bg-gray-200 rounded" style={{ aspectRatio: '63 / 88' }} />
        <div className="space-y-2">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-6 w-2/3 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
      <div className="mb-5 h-32 rounded border border-gray-200 bg-gray-100 animate-pulse" />
      <div className="mb-5 h-24 rounded border border-gray-200 bg-gray-100 animate-pulse" />
    </div>
  )
}
