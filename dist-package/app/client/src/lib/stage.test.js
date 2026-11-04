import test from 'node:test'
import assert from 'node:assert/strict'
import { computeStage, isCompletionView, COMPLETION_UNMANAGED_CUTOFF, STAGES, CFT_DEPT_FIELDS, NOT_APPLICABLE, SHEET_REPORT } from './stage.js'

function base() {
  return { reviewMethod: SHEET_REPORT, pmRequest: '2026-01-01', pmComplete: '2026-01-02', cftRequest: '2026-01-03' }
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

test('대면보고(부문장)도 서면보고(본부장)와 동일하게 진행 단계 시퀀스를 탄다', () => {
  const record = { reviewMethod: '대면보고(부문장)', pmRequest: '2026-01-01' }
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

test('완료보고(category:completion) 레코드는 stageOverride를 그대로 쓰고, CFT 날짜 역산을 하지 않는다', () => {
  const record = { category: 'completion', stageOverride: 'C', reviewMethod: '미지정' }
  assert.equal(computeStage(record).code, 'C')
})

test('완료보고 레코드에 stageOverride가 없으면 미지정으로 떨어진다', () => {
  assert.equal(computeStage({ category: 'completion' }).code, 'U')
})

test('개발심의회 레코드가 CFT검토중(C)이고 납기가 지났어도 완료보고로 넘어가지 않는다(결재완료만 이동)', () => {
  const record = { ...base(), dueDate: '2020-01-01' }
  for (const f of CFT_DEPT_FIELDS.slice(0, -1)) record[f.key] = '2026-01-10'
  assert.equal(computeStage(record).code, 'C')
  assert.equal(isCompletionView(record), false)
})

test('개발심의회 레코드가 결재완료(F)이고 납기가 지나면 완료보고 쪽으로 보이고, 진행단계는 미지정부터 새로 시작한다', () => {
  const record = { ...base(), dueDate: '2020-01-01', notice: '2026-01-20', approval: '2026-01-21' }
  for (const f of CFT_DEPT_FIELDS) record[f.key] = '2026-01-10'
  assert.equal(isCompletionView(record), true)
  // stageOverride가 없으므로 개발심의회 때의 결재완료(F)를 그대로 들고 오지 않고 미지정(U)부터 시작 —
  // 다만 납기가 COMPLETION_UNMANAGED_CUTOFF 이전이라 자동완료 규칙에 걸려 결재완료(F)로 보인다.
  assert.equal(computeStage(record).code, 'F')
})

test('완료보고 레코드가 미실시/미지정이고 납기가 관리불필요 기준일 이전이면 결재완료로 간주한다', () => {
  assert.equal(computeStage({ category: 'completion', stageOverride: 'N', dueDate: '2024-01-01' }).code, 'F')
  assert.equal(computeStage({ category: 'completion', stageOverride: 'U', dueDate: '2024-01-01' }).code, 'F')
})

test('완료보고 레코드가 미실시/미지정이어도 납기가 관리불필요 기준일 이후면 강제하지 않는다', () => {
  assert.equal(computeStage({ category: 'completion', stageOverride: 'N', dueDate: COMPLETION_UNMANAGED_CUTOFF }).code, 'N')
})

test('완료보고 레코드가 미실시/미지정이 아니면(C 등) 납기가 지나도 자동완료하지 않는다', () => {
  assert.equal(computeStage({ category: 'completion', stageOverride: 'C', dueDate: '2024-01-01' }).code, 'C')
})
