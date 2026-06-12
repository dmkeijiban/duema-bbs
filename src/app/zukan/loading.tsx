export default function ZukanLoading() {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-10">
      <div className="h-1 w-full rounded-full bg-blue-200 animate-pulse mb-4" />
      <div className="mb-4 h-24 rounded border border-gray-200 bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded border border-gray-200 bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
