export const ZUKAN_ERAS = [
  { slug: 'shobu', name: '勝舞編', years: '2002〜2011', minSortOrder: 1, maxSortOrder: 100 },
  { slug: 'katta', name: '勝太編', years: '2011〜2017', minSortOrder: 101, maxSortOrder: 200 },
  { slug: 'joe', name: 'ジョー編', years: '2017〜2022', minSortOrder: 201, maxSortOrder: 300 },
  { slug: 'win', name: 'ウィン編', years: '2022〜', minSortOrder: 301, maxSortOrder: null },
] as const

export type ZukanEra = (typeof ZUKAN_ERAS)[number]

export function findZukanEra(slug: string): ZukanEra | undefined {
  return ZUKAN_ERAS.find(era => era.slug === slug)
}

export function isPackInZukanEra(sortOrder: number, era: ZukanEra): boolean {
  return sortOrder >= era.minSortOrder && (era.maxSortOrder === null || sortOrder <= era.maxSortOrder)
}
