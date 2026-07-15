export function normalizeCardName(value: string) {
  return value.normalize('NFKC').trim().replace(/[\s\u3000]+/g, '').replace(/[／∕]/g, '/').replace(/[・·]/g, '・')
}

export function normalizeCardSearch(value: string) {
  return normalizeCardName(value).toLocaleLowerCase('ja')
}
