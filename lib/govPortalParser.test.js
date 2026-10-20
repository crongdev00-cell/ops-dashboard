import test from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'
import { parseGovBuffer } from './govPortalParser.js'

function buildGovBuffer({ withGovKeyHeader = true } = {}) {
  const header = new Array(18).fill(null)
  if (withGovKeyHeader) header[5] = '내부관리번호'
  const dataRow = new Array(18).fill(null)
  dataRow[2] = '테스트 협약'
  dataRow[5] = 'GOV-TEST-0001'
  dataRow[8] = '테스트기관'
  dataRow[10] = 1000
  dataRow[11] = 200
  dataRow[12] = 50
  dataRow[13] = 250
  dataRow[14] = 1250
  dataRow[15] = '테스트부서'
  dataRow[16] = '김국책'
  dataRow[17] = '이피엠'

  const rows = [header, [], [], dataRow]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

test('고정 열 위치에서 국책사업 필드를 정확히 읽는다', () => {
  const buf = buildGovBuffer()
  const [rec] = parseGovBuffer(buf)
  assert.equal(rec.govKey, 'GOV-TEST-0001')
  assert.equal(rec.contractName, '테스트 협약')
  assert.equal(rec.contractOrg, '테스트기관')
  assert.equal(rec.govFundAmount, 1000)
  assert.equal(rec.privateCashAmount, 200)
  assert.equal(rec.privateInKindAmount, 50)
  assert.equal(rec.privateTotalAmount, 250)
  assert.equal(rec.amount, 1250)
  assert.equal(rec.deptName, '테스트부서')
  assert.equal(rec.govManager, '김국책')
  assert.equal(rec.pm, '이피엠')
})

test('"내부관리번호" 헤더 위치가 예상과 다르면 에러를 던진다', () => {
  const buf = buildGovBuffer({ withGovKeyHeader: false })
  assert.throws(() => parseGovBuffer(buf), /내부관리번호/)
})
