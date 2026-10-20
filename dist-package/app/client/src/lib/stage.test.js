import test from 'node:test'
import assert from 'node:assert/strict'
import { computeStage, STAGES, CFT_DEPT_FIELDS } from './stage.js'

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
