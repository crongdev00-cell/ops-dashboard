import test from 'node:test'
import assert from 'node:assert/strict'
import { compareRecords, buildYearGroups } from './recordSort.js'

test('날짜형 필드는 값이 없는 쪽을 정렬 방향과 무관하게 항상 뒤로 보낸다', () => {
  const withDate = { id: 1, pmRequest: '2026-01-01' }
  const noDate = { id: 2, pmRequest: null }
  assert.equal(compareRecords(noDate, withDate, { key: 'pmRequest', dir: 'asc' }), 1)
  assert.equal(compareRecords(noDate, withDate, { key: 'pmRequest', dir: 'desc' }), 1)
})

test('buildYearGroups: 계약일자가 아닌 키로 정렬해도 같은 연도가 여러 조각으로 쪼개지지 않는다', () => {
  const records = [
    { id: 1, pm: '김도현', contractDate: '2026-03-01' },
    { id: 2, pm: '박준혁', contractDate: '2025-05-01' },
    { id: 3, pm: '이서연', contractDate: '2026-01-01' },
  ]
  const rows = buildYearGroups(records, (a, b) => compareRecords(a, b, { key: 'pm', dir: 'asc' }))
  const headers = rows.filter((r) => r.type === 'header').map((r) => r.year)
  assert.deepEqual(headers, [2026, 2025], '연도 헤더가 중복 없이 한 번씩만, 최신순으로 나와야 한다')
  const years2026 = rows.filter((r) => r.type === 'row' && r.record.contractDate.startsWith('2026')).map((r) => r.record.pm)
  assert.deepEqual(years2026, ['김도현', '이서연'], '버킷 안에서는 지정한 정렬 기준(pm asc)을 따라야 한다')
})

test('buildYearGroups: 계약일자 없는 레코드는 "연도미정" 묶음으로 맨 끝에 모인다', () => {
  const records = [
    { id: 1, contractDate: '2025-01-01' },
    { id: 2, contractDate: null },
  ]
  const rows = buildYearGroups(records, (a, b) => compareRecords(a, b, { key: 'contractDate', dir: 'desc' }))
  assert.deepEqual(rows.map((r) => (r.type === 'header' ? r.year : r.record.id)), [2025, 1, '연도미정', 2])
})
