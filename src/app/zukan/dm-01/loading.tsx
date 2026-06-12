export default function Dm01Loading() {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-10">
      <div className="h-1 w-full rounded-full bg-blue-200 animate-pulse mb-4" />
      <div className="mb-5 h-40 rounded border border-gray-200 bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="h-28 rounded border border-gray-200 bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
