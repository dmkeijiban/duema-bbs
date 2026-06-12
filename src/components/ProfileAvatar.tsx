type ProfileAvatarProps = {
  src: string | null | undefined
  alt: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
}

export function ProfileAvatar({ src, alt, size = 'md' }: ProfileAvatarProps) {
  if (!src) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${sizeClass[size]} shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover`}
    />
  )
}
