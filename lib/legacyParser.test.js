import test from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'
import { parseLegacyBuffer } from './legacyParser.js'

// original_management_data_template.xlsx와 동일한 48열 고정 레이아웃(3행 병합 헤더 + 데이터)을
// 최소 구성으로 흉내 낸다. 실제 템플릿 전체를 테스트에 끌어오지 않고도 열 위치 매핑을 검증한다.
function buildLegacyBuffer({ extraContractKeyCol = 48 } = {}) {
  const header0 = new Array(49).fill(null)
  const header1 = new Array(49).fill(null)
  const header2 = new Array(49).fill(null)
  header1[2] = '계약(사업)명'
  header1[22] = '심의방법'
  header1[32] = '요청'
  header1[37] = 'AI\r\n(AI)'
  header1[45] = '안내\r\n완료'
  header1[15] = '연구소명'
  header1[16] = 'PM'
  header2[16] = '[팀장(작성)'
  header1[23] = '위원장'
  header1[25] = '심의결과'
  header1[36] = '요청'
  header1[44] = '사업'
  header2[44] = '관리'
  header0[extraContractKeyCol] = '계약번호'

  const dataRow = new Array(49).fill(null)
  dataRow[2] = '테스트 사업'
  dataRow[6] = '민수'
  dataRow[12] = 1000
  dataRow[15] = '테스트연구소'
  dataRow[16] = '김테스트'
  dataRow[20] = '특이사항 있음'
  dataRow[22] = '미실시'
  dataRow[44] = 44000 // cftBizMgmt (excel serial)
  dataRow[extraContractKeyCol] = 'KT-TEST-0001'

  const rows = [header0, header1, header2, dataRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

test('고정 템플릿 열 위치에서 필드를 정확히 읽는다', () => {
  const buf = buildLegacyBuffer()
  const [rec] = parseLegacyBuffer(buf)
  assert.equal(rec.contractName, '테스트 사업')
  assert.equal(rec.portalKey, 'KT-TEST-0001')
  assert.equal(rec.businessType, '민수')
  assert.equal(rec.amount, 1000)
  assert.equal(rec.pmDeptName, '테스트연구소')
  assert.equal(rec.pm, '김테스트')
  assert.equal(rec.reviewMethod, '미실시')
  assert.ok(rec.note.includes('[특기사항] 특이사항 있음'))
  assert.ok(rec.cftBizMgmt) // 날짜 파싱됨 (정확한 값은 normalizeDate의 기존 동작에 위임)
})

test('"내부관리번호" 열이 있고 계약번호가 비어있으면 국책사업 행으로 인식한다', () => {
  const header0 = new Array(50).fill(null)
  const header1 = new Array(50).fill(null)
  const header2 = new Array(50).fill(null)
  header1[2] = '계약(사업)명'
  header1[22] = '심의방법'
  header1[32] = '요청'
  header1[37] = 'AI\r\n(AI)'
  header1[45] = '안내\r\n완료'
  header0[48] = '계약번호'
  header0[49] = '내부관리번호'

  const dataRow = new Array(50).fill(null)
  dataRow[2] = '국책사업 테스트'
  dataRow[49] = 'GOV-TEST-0001'

  const rows = [header0, header1, header2, dataRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const [rec] = parseLegacyBuffer(buf)
  assert.equal(rec.portalKey, null)
  assert.equal(rec.govKey, 'GOV-TEST-0001')
  assert.equal(rec.projectType, '국책사업')
})

test('"계약번호" 열이 없으면 명확한 에러를 던진다', () => {
  const buf = buildLegacyBuffer({ extraContractKeyCol: -1 })
  assert.throws(() => parseLegacyBuffer(buf), /계약번호/)
})

test('핵심 열 위치가 예상과 다르면(템플릿 구조 변경) 바로 에러를 던진다', () => {
  const header0 = new Array(49).fill(null)
  const header1 = new Array(49).fill(null)
  const header2 = new Array(49).fill(null)
  header1[2] = '계약(사업)명' // 나머지 힌트 열은 일부러 비워둠 → 구조 불일치
  const rows = [header0, header1, header2, new Array(49).fill(null)]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  assert.throws(() => parseLegacyBuffer(buf), /예상과 다릅니다/)
})
