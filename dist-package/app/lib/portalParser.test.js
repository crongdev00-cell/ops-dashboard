import test from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'
import { parsePortalBuffer } from './portalParser.js'

const HEADERS = ['계약번호', '계약(사업)명', '계약기관', '계약방법', '적용사업', '사업형태', '담당부서', '담당자(정)', '최초계약일자', '최종납기', '계약금액']

function buildBuffer(rows) {
  const aoa = [HEADERS.map(() => ''), HEADERS, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

test('parses a well-formed portal row, converting amount to 백만원 units', () => {
  const buf = buildBuffer([
    ['KT-1', '테스트 사업', '자체연구', '수의계약', '적용사업', '민수', '연구기획팀', '홍길동', '2026-01-01', '2026-12-31', 3200000],
  ])
  const [rec] = parsePortalBuffer(buf)
  assert.equal(rec.portalKey, 'KT-1')
  assert.equal(rec.contractName, '테스트 사업')
  assert.equal(rec.amount, 3, '3,200,000원은 반올림되어 3(백만원)이어야 한다')
  assert.equal(rec.contractDate, '2026-01-01')
})

test('skips rows with no portalKey', () => {
  const buf = buildBuffer([
    ['', '계약번호 없는 사업', ...Array(9).fill(null)],
    ['KT-2', '정상 사업', ...Array(9).fill(null)],
  ])
  const recs = parsePortalBuffer(buf)
  assert.equal(recs.length, 1)
  assert.equal(recs[0].portalKey, 'KT-2')
})

test('throws a clear error when the file has no recognizable header row', () => {
  const ws = XLSX.utils.aoa_to_sheet([['이건', '포털', '양식이', '아님']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  assert.throws(() => parsePortalBuffer(buf), /계약번호/)
})

test('non-numeric amount does not silently become a plausible-looking number', () => {
  const buf = buildBuffer([
    ['KT-1', '테스트 사업', null, null, null, null, null, null, null, null, '오류값'],
  ])
  const [rec] = parsePortalBuffer(buf)
  assert.equal(rec.amount, null, '숫자로 변환 안 되는 금액은 null로 남아야 한다 (NaN이 아니라)')
})
