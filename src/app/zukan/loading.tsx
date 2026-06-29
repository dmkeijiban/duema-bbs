export default function ZukanLoading() {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-4" aria-busy="true">
      <div className="mb-2 flex items-center gap-x-1">
        <div className="h-3 w-8 animate-pulse bg-gray-100" />
        <div className="h-3 w-2 animate-pulse bg-gray-100" />
        <div className="h-3 w-20 animate-pulse bg-gray-100" />
      </div>

      <div className="mb-4 border border-gray-300 bg-white p-1">
        <div className="grid grid-cols-2 gap-1">
          <div className="h-10 animate-pulse border border-blue-200 bg-blue-50" />
          <div className="h-10 animate-pulse border border-transparent bg-gray-50" />
        </div>
      </div>

      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <div className="h-5 w-40 animate-pulse bg-gray-200" />
        <div className="mt-3 h-4 w-full max-w-[520px] animate-pulse bg-gray-100" />
        <div className="mt-2 h-4 w-4/5 max-w-[440px] animate-pulse bg-gray-100" />
      </header>

      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <div className="h-4 w-24 animate-pulse bg-gray-200" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="flex h-[88px] overflow-hidden border border-gray-300 bg-white">
              <div className="w-20 shrink-0 animate-pulse bg-orange-50 sm:w-24" />
              <div className="flex min-w-0 flex-1 flex-col px-3 py-2">
                <div className="h-3 w-12 animate-pulse bg-blue-100" />
                <div className="mt-2 h-4 w-36 max-w-full animate-pulse bg-gray-200" />
                <div className="mt-3 h-3 w-28 animate-pulse bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between border border-gray-300 bg-gray-50 px-3 py-2">
          <div className="h-4 w-44 animate-pulse bg-gray-200" />
          <div className="h-3 w-24 animate-pulse bg-gray-100" />
        </div>
        <div className="flex gap-2 overflow-hidden sm:grid sm:grid-cols-3 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map(item => (
            <div key={item} className="w-[44%] flex-shrink-0 border border-gray-300 bg-white sm:w-auto">
              <div className="animate-pulse bg-gray-100" style={{ aspectRatio: '63 / 88' }} />
              <div className="px-1.5 py-1.5">
                <div className="h-4 w-7 animate-pulse bg-gray-100" />
                <div className="mt-2 h-3 w-24 max-w-full animate-pulse bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
