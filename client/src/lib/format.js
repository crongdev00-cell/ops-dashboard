export function formatDate(iso) {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

export function formatAmount(n) {
  if (n === null || n === undefined || n === '') return '-'
  return `${Number(n).toLocaleString('ko-KR')}백만원`
}

export function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
