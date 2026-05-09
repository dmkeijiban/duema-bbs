export function getTimeBucketSeed(minutes = 30) {
  const now = new Date()
  return Math.floor(now.getTime() / (1000 * 60 * minutes))
}

export function seededShuffle<T>(items: T[], seed = getTimeBucketSeed()): T[] {
  const shuffled = [...items]
  let state = seed

  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}
