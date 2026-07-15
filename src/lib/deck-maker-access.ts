/**
 * Keep the deck maker available in local development and Vercel Preview while
 * hiding it from Production until it is explicitly released.
 */
export function isDeckMakerEnabled() {
  const configured = process.env.DECK_MAKER_ENABLED?.trim().toLowerCase()
  if (configured === 'true') return true
  if (configured === 'false') return false

  return process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'
}
