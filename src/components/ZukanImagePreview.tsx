type ZukanImagePreviewProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  aspectRatio?: string
}

function previewId(src: string): string {
  return `zukan-preview-${src.replace(/[^a-zA-Z0-9_-]/g, '-').slice(-80)}`
}

export default function ZukanImagePreview({
  src,
  alt,
  className = '',
  imageClassName = '',
  aspectRatio = '63 / 88',
}: ZukanImagePreviewProps) {
  const id = previewId(src)

  return (
    <>
      <style>{`
        .zukan-image-popover::backdrop {
          background: rgba(0, 0, 0, 0.8);
        }
      `}</style>
      <button
        type="button"
        className={`block w-full overflow-hidden bg-gray-100 cursor-zoom-in ${className}`}
        style={{ aspectRatio }}
        aria-label={`${alt}を拡大表示`}
        popoverTarget={id}
        popoverTargetAction="show"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      </button>

      <div
        id={id}
        popover="auto"
        className="zukan-image-popover m-auto border-0 bg-transparent p-0 outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          decoding="async"
          className="block max-h-[90vh] max-w-[90vw] rounded-md bg-white object-contain shadow-2xl"
        />
      </div>
    </>
  )
}
