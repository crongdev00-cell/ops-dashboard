// 표 보기 / 목록·상세보기 둘 다에서 쓰는 정렬·연도별 묶음 로직 — 각 뷰에 따로 두면
// "계약일자는 정렬되는데 다른 컬럼은 안 된다" 같은 드리프트가 또 생긴다(사용자 리포트).
import { computeStage, stageProgressPct } from './stage.js'

export const SORT_FIELDS = [
  { key: 'contractName', label: '계약(사업)명', type: 'text' },
  { key: 'bm', label: 'BM 이름', type: 'text' },
  { key: 'deptName', label: 'BM 부서', type: 'text' },
  { key: 'pm', label: 'PM', type: 'text' },
  { key: 'pmDeptName', label: 'PM 부서', type: 'text' },
  { key: 'reviewMethod', label: '심의방법', type: 'text' },
  { key: 'stage', label: '상태', type: 'stage' },
  { key: 'progress', label: '진행률', type: 'progress' },
  { key: 'amount', label: '계약금액(백만원)', type: 'number' },
  { key: 'contractDate', label: '계약일자', type: 'date' },
  { key: 'pmRequest', label: 'PM요청', type: 'date' },
  { key: 'approval', label: '결재완료', type: 'date' },
]

const TYPE_OF = Object.fromEntries(SORT_FIELDS.map((f) => [f.key, f.type]))

function valueOf(record, key) {
  if (key === 'stage') return computeStage(record).label
  if (key === 'progress') return stageProgressPct(record)
  return record[key] ?? ''
}

export function compareRecords(a, b, { key, dir }) {
  const av = valueOf(a, key)
  const bv = valueOf(b, key)
  // 날짜형 필드는 값이 없는 쪽을 정렬 방향과 무관하게 항상 뒤로 보낸다.
  if (TYPE_OF[key] === 'date') {
    if (!av && !bv) return 0
    if (!av) return 1
    if (!bv) return -1
  }
  if (av < bv) return dir === 'asc' ? -1 : 1
  if (av > bv) return dir === 'asc' ? 1 : -1
  return 0
}

export function yearOf(record) {
  return record.contractDate ? new Date(record.contractDate).getFullYear() : '연도미정'
}

// 연도별로 먼저 묶은 뒤(최신 연도부터, "연도미정"은 맨 끝) 버킷 안에서 compareFn으로 정렬한다.
// "이미 정렬된 배열에서 연도가 바뀌는 지점마다 헤더를 끼워 넣는" 방식은 계약일자가 아닌
// 다른 키로 정렬할 때 같은 연도가 여러 조각으로 쪼개져 나타나는 문제가 있어서 피한다.
export function buildYearGroups(records, compareFn) {
  const buckets = new Map()
  for (const r of records) {
    const y = yearOf(r)
    if (!buckets.has(y)) buckets.set(y, [])
    buckets.get(y).push(r)
  }
  const years = [...buckets.keys()].sort((a, b) => {
    if (a === '연도미정') return 1
    if (b === '연도미정') return -1
    return b - a
  })
  const rows = []
  for (const y of years) {
    rows.push({ type: 'header', year: y })
    for (const r of [...buckets.get(y)].sort(compareFn)) rows.push({ type: 'row', record: r })
  }
  return rows
}
