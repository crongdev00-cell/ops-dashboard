import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyReviewMethod } from './classify.js'

test('무기체계 300억원 이상이면 대면보고(연구개발본부장)로 자동 판정', () => {
  const result = classifyReviewMethod('연구개발(무기체계)', 30_000)
  assert.equal(result.autoClassification, '대면보고(연구개발본부장)')
  assert.match(result.classificationReason, /무기체계/)
})

test('무기체계여도 300억원 미만이면 서면보고(기본값)', () => {
  const result = classifyReviewMethod('연구개발(무기체계)', 29_999)
  assert.equal(result.autoClassification, '서면보고')
})

test('핵심기술 150억원 이상이면 대면보고(연구개발본부장)로 자동 판정', () => {
  const result = classifyReviewMethod('연구개발(핵심기술)', 15_000)
  assert.equal(result.autoClassification, '대면보고(연구개발본부장)')
  assert.match(result.classificationReason, /핵심기술/)
})

test('핵심기술이어도 150억원 미만이면 서면보고(기본값)', () => {
  const result = classifyReviewMethod('연구개발(핵심기술)', 14_999)
  assert.equal(result.autoClassification, '서면보고')
})

test('무기체계/핵심기술이 아닌 사업형태는 금액과 무관하게 서면보고', () => {
  const result = classifyReviewMethod('연구개발(민수)', 100_000)
  assert.equal(result.autoClassification, '서면보고')
})

test('사업형태가 없거나(null) 금액이 없어도 에러 없이 서면보고로 떨어진다', () => {
  const result = classifyReviewMethod(null, null)
  assert.equal(result.autoClassification, '서면보고')
})
