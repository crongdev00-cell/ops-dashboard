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

test('완료보고(category:completion) 레코드는 comp* 날짜 필드로 역산한다(PM요청만 채우면 PM작성중)', () => {
  const record = { category: 'completion', compPmRequest: '2026-01-01' }
  assert.equal(computeStage(record).code, 'A')
})

test('완료보고는 개발심의회와 달리 심의방법이 비어 있어도 날짜만 있으면 역산한다(실데이터에서 심의방법 열이 항상 채워진다는 보장이 없음)', () => {
  const record = { category: 'completion', reviewMethod: '', compPmRequest: '2026-01-01', compPmComplete: '2026-01-02' }
  assert.equal(computeStage(record).code, 'B')
})

test('완료보고는 CFT 8부서가 아니라 2부서(개발품질/원가분석)만 채워지면 검토완료로 넘어간다', () => {
  const record = {
    category: 'completion', compPmRequest: '2026-01-01', compPmComplete: '2026-01-02', compCftRequest: '2026-01-03',
    compCftQuality: '2026-01-10',
  }
  assert.equal(computeStage(record).code, 'C', '원가분석이 비어있으면 아직 CFT검토중')
  record.compCftCostAnalysis = '2026-01-11'
  assert.equal(computeStage(record).code, 'D', '2부서가 다 채워지면 검토완료')
})

test('완료보고 레코드에 아무 comp* 날짜도 없으면 미지정으로 떨어진다', () => {
  assert.equal(computeStage({ category: 'completion' }).code, 'U')
})

test('완료보고에서도 심의방법이 미실시/대상아님/취소면 날짜와 무관하게 그 상태를 우선한다', () => {
  assert.equal(computeStage({ category: 'completion', reviewMethod: '미실시', compPmRequest: '2026-01-01' }).code, 'N')
  assert.equal(computeStage({ category: 'completion', reviewMethod: '대상아님' }).code, 'NA')
  assert.equal(computeStage({ category: 'completion', reviewMethod: '취소' }).code, 'CANCEL')
})

test('개발심의회 레코드가 CFT검토중(C)이고 납기가 지났어도 완료보고로 넘어가지 않는다(결재완료만 이동)', () => {
  const record = { ...base(), dueDate: '2020-01-01' }
  for (const f of CFT_DEPT_FIELDS.slice(0, -1)) record[f.key] = '2026-01-10'
  assert.equal(computeStage(record).code, 'C')
  assert.equal(isCompletionView(record), false)
})

test('개발심의회 레코드가 결재완료(F)이고 납기가 미래(기준일 이후)로 넘어가면, comp* 필드가 비어 있어 미지정부터 새로 시작한다', () => {
  const record = { ...base(), dueDate: '2026-06-01', notice: '2026-01-20', approval: '2026-01-21' }
  for (const f of CFT_DEPT_FIELDS) record[f.key] = '2026-01-10'
  assert.equal(isCompletionView(record), true)
  assert.equal(computeStage(record).code, 'U')
})

// 회귀 테스트: 개발심의회 때 쓰던 pmRequest/cftQuality/cftCostAnalysis/notice/approval 필드에
// 이미 값이 들어있어도, 완료보고 쪽 역산은 이름이 다른 comp* 필드만 보므로 영향을 받지 않아야 한다
// (실제로 겪은 버그 — 필드 이름이 겹치면 넘어오자마자 결재완료로 보여버림).
test('개발심의회 필드에 값이 남아있어도 완료보고 쪽 진행단계에는 영향을 주지 않는다(필드 분리 회귀 테스트)', () => {
  const record = { ...base(), dueDate: '2026-06-01', notice: '2026-01-20', approval: '2026-01-21' }
  for (const f of CFT_DEPT_FIELDS) record[f.key] = '2026-01-10'
  assert.equal(computeStage(record).code, 'U', 'review 필드가 가득 차 있어도 comp*가 비어 있으면 미지정')
  record.compPmRequest = '2026-07-01'
  assert.equal(computeStage(record).code, 'A', 'comp* 필드를 채우면 그제서야 진행단계가 올라간다')
})

test('완료보고 레코드가 미지정이고 납기가 관리불필요 기준일 이전이면 결재완료로 간주한다', () => {
  assert.equal(computeStage({ category: 'completion', dueDate: '2024-01-01' }).code, 'F')
  assert.equal(computeStage({ category: 'completion', reviewMethod: '미실시', dueDate: '2024-01-01' }).code, 'F')
})

test('완료보고 레코드가 미지정이어도 납기가 관리불필요 기준일 이후면 강제하지 않는다', () => {
  assert.equal(computeStage({ category: 'completion', dueDate: COMPLETION_UNMANAGED_CUTOFF }).code, 'U')
})

test('완료보고 레코드가 미지정이 아니면(C 등) 납기가 지나도 자동완료하지 않는다', () => {
  const record = {
    category: 'completion', dueDate: '2024-01-01',
    compPmRequest: '2020-01-01', compPmComplete: '2020-01-02', compCftRequest: '2020-01-03',
  }
  assert.equal(computeStage(record).code, 'C')
})
