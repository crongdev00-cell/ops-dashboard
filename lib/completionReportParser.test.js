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
  row[0] = overrides.stageLabel ?? 'PM작성중'
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

test('진행 단계 라벨이 STAGES 코드로 매핑된다', () => {
  const buf = buildBuffer([
    buildDataRow({ contractName: 'A', stageLabel: 'PM작성중' }),
    buildDataRow({ contractName: 'B', stageLabel: 'CFT검토중' }),
    buildDataRow({ contractName: 'C', stageLabel: '결재완료' }),
  ])
  const [a, b, c] = parseCompletionBuffer(buf)
  assert.equal(a.stageOverride, 'A')
  assert.equal(b.stageOverride, 'C')
  assert.equal(c.stageOverride, 'F')
})

test('납기일자가 지난 건이어도 업로드된 진행 단계 라벨을 그대로 저장한다(관리불필요 자동완료는 computeStage가 조회 시점에 처리)', () => {
  const buf = buildBuffer([buildDataRow({ dueDate: '2025-01-15', stageLabel: '결재완료' })])
  const [rec] = parseCompletionBuffer(buf)
  assert.equal(rec.stageOverride, 'F')
})

test('진행 단계 라벨이 없거나 인식 안 되면 미지정으로 떨어진다', () => {
  const buf = buildBuffer([buildDataRow({ stageLabel: '', dueDate: '2026-01-15' })])
  const [rec] = parseCompletionBuffer(buf)
  assert.equal(rec.stageOverride, 'U')
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
