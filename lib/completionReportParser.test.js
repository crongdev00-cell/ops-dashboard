import test from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'
import { parseCompletionBuffer } from './completionReportParser.js'

function buildBuffer(dataRows) {
  const header = new Array(41).fill(null)
  header[0] = '개발완료보고'
  const rows = [new Array(41).fill(null), header, new Array(41).fill(null), new Array(41).fill(null), ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

function buildDataRow(overrides = {}) {
  const row = new Array(41).fill(null)
  row[2] = overrides.contractName ?? '테스트 완료보고 안건'
  row[4] = overrides.contractOrg ?? '국방ㅁㅁ연구소'
  row[6] = overrides.businessType ?? '연구개발(무기체계)'
  row[9] = overrides.contractDate ?? '2022-03-11'
  row[10] = overrides.dueDate ?? '2026-05-01'
  row[13] = overrides.amount ?? 14_921_000_000
  row[15] = overrides.labName ?? '위성연구소'
  row[16] = overrides.pm ?? '아무개'
  row[17] = overrides.deptName ?? '우주사업부'
  row[18] = overrides.bm ?? '김길동'
  row[22] = overrides.reviewMethod ?? '전자결재'
  const pick = (key, def) => (key in overrides ? overrides[key] : def)
  row[32] = pick('compPmRequest', '2026-01-01')
  row[33] = pick('compPmDue', '2026-01-15')
  row[34] = pick('compPmComplete', '2026-01-10')
  row[36] = pick('compCftRequest', '2026-01-20')
  row[37] = pick('compCftQuality', '2026-01-25')
  row[38] = pick('compCftCostAnalysis', '2026-01-26')
  row[39] = pick('compNotice', '2026-02-01')
  row[40] = pick('compApproval', '2026-02-10')
  return row
}

test('고정 열 위치에서 완료보고 필드를 정확히 읽는다', () => {
  const buf = buildBuffer([buildDataRow()])
  const [rec] = parseCompletionBuffer(buf)
  assert.equal(rec.contractName, '테스트 완료보고 안건')
  assert.equal(rec.contractOrg, '국방ㅁㅁ연구소')
  assert.equal(rec.businessType, '연구개발(무기체계)')
  assert.equal(rec.labName, '위성연구소')
  assert.equal(rec.pm, '아무개')
  assert.equal(rec.deptName, '우주사업부')
  assert.equal(rec.bm, '김길동')
  assert.equal(rec.contractDate, '2022-03-11')
  assert.equal(rec.dueDate, '2026-05-01')
})

test('금액은 원 단위로 들어오므로 백만원 단위로 변환한다', () => {
  const buf = buildBuffer([buildDataRow({ amount: 14_921_000_000 })])
  const [rec] = parseCompletionBuffer(buf)
  assert.equal(rec.amount, 14_921)
})

test('PM/CFT/안내/결재 날짜가 comp* 필드로 정확히 읽힌다(stage.js의 날짜 역산이 쓰는 필드명)', () => {
  const buf = buildBuffer([buildDataRow()])
  const [rec] = parseCompletionBuffer(buf)
  assert.equal(rec.compPmRequest, '2026-01-01')
  assert.equal(rec.compPmComplete, '2026-01-10')
  assert.equal(rec.compCftRequest, '2026-01-20')
  assert.equal(rec.compCftQuality, '2026-01-25')
  assert.equal(rec.compCftCostAnalysis, '2026-01-26')
  assert.equal(rec.compNotice, '2026-02-01')
  assert.equal(rec.compApproval, '2026-02-10')
})

test('일부 날짜가 비어 있으면 해당 필드는 null로 들어온다', () => {
  const buf = buildBuffer([buildDataRow({ compCftRequest: null, compCftQuality: null, compCftCostAnalysis: null, compNotice: null, compApproval: null })])
  const [rec] = parseCompletionBuffer(buf)
  assert.equal(rec.compPmComplete, '2026-01-10')
  assert.equal(rec.compCftRequest, null)
  assert.equal(rec.compApproval, null)
})

test('"개발완료보고" 제목 위치가 예상과 다르면 에러를 던진다', () => {
  const header = new Array(41).fill(null) // title cell 비워둠
  const rows = [new Array(41).fill(null), header, new Array(41).fill(null), new Array(41).fill(null), buildDataRow()]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  assert.throws(() => parseCompletionBuffer(buf), /개발완료보고/)
})
