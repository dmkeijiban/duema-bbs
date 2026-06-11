'use client'

import { useId } from 'react'

type PopoverDivProps = React.HTMLAttributes<HTMLDivElement> & {
  popover?: 'auto'
}

type PopoverButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  popovertarget?: string
  popovertargetaction?: 'hide'
}

type ZukanImagePreviewProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
}

export default function ZukanImagePreview({
  src,
  alt,
  className = '',
  imageClassName = '',
}: ZukanImagePreviewProps) {
  const popoverId = `zukan-image-preview-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const openProps: PopoverButtonProps = { popovertarget: popoverId }
  const closeProps: PopoverButtonProps = { popovertarget: popoverId, popovertargetaction: 'hide' }
  const popoverProps: PopoverDivProps = { popover: 'auto' }

  return (
    <>
      <button
        type="button"
        className={`block w-full overflow-hidden bg-gray-100 ${className}`}
        style={{ aspectRatio: '63 / 88' }}
        aria-label={`${alt}を拡大表示`}
        {...openProps}
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
        id={popoverId}
        className="m-auto max-h-[92vh] max-w-[min(92vw,520px)] overflow-visible border-0 bg-transparent p-0"
        aria-label={alt}
        {...popoverProps}
      >
        <style>{`#${popoverId}::backdrop{background:rgba(0,0,0,.75);}`}</style>
        <div className="relative">
          <button
            type="button"
            className="absolute -right-2 -top-2 rounded bg-white px-2 py-1 text-xs font-bold text-gray-700 shadow"
            {...closeProps}
          >
            閉じる
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="max-h-[88vh] w-auto max-w-full rounded bg-white object-contain shadow-lg"
          />
        </div>
      </div>
    </>
  )
}
