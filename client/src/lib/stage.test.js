import test from 'node:test'
import assert from 'node:assert/strict'
import { computeStage, STAGES, CFT_DEPT_FIELDS, NOT_APPLICABLE, ELECTRONIC_APPROVAL } from './stage.js'

function base() {
  return { reviewMethod: '서면보고', pmRequest: '2026-01-01', pmComplete: '2026-01-02', cftRequest: '2026-01-03' }
}

test('CFT 부서 8개 중 하나라도 비어있으면 CFT검토중에 머문다', () => {
  const record = { ...base() }
  for (const f of CFT_DEPT_FIELDS.slice(0, -1)) record[f.key] = '2026-01-10'
  // 마지막 부서(cftBizMgmt)만 비워둠
  assert.equal(computeStage(record).code, 'C')
})

test('CFT 부서 8개가 전부 채워져야 검토완료로 넘어간다', () => {
  const record = { ...base() }
  for (const f of CFT_DEPT_FIELDS) record[f.key] = '2026-01-10'
  assert.equal(computeStage(record).code, 'D')
  assert.equal(computeStage(record).label, STAGES.D.label)
})

test('전자결재(본부장)도 서면보고와 동일하게 진행 단계 시퀀스를 탄다', () => {
  const record = { reviewMethod: ELECTRONIC_APPROVAL, pmRequest: '2026-01-01' }
  assert.equal(computeStage(record).code, 'A', 'PM작성완료 전이면 PM작성중이어야 한다')
})

test('레거시 이관으로 들어온 "해당없음" 부서는 날짜가 없어도 완료로 친다(미입력과 구분)', () => {
  const record = { ...base(), notice: '2026-01-20', approval: '2026-01-21' }
  for (const f of CFT_DEPT_FIELDS) record[f.key] = '2026-01-10'
  record.cftBizMgmt = NOT_APPLICABLE // 이 부서는 애초에 검토 대상이 아니었음
  assert.equal(computeStage(record).code, 'F', '해당없음 부서 때문에 결재완료까지 끝난 옛 안건이 CFT검토중에 막히면 안 된다')
})

test('레거시 "취소" 심의방법은 취소 단계로 분류된다', () => {
  assert.equal(computeStage({ reviewMethod: '취소' }).code, 'CANCEL')
})
