// 개발심의회 심의 대상 1차 자동 분류.
// 상욱 수석 미팅(2026-09-17) 반영: "사업형태" 컬럼으로 무기체계/핵심기술을 구분할 수 있고,
// 금액 기준은 txt 원본 문서에 명시된 대로다. 손충금·미실시 예외 조건(정비/수리부속 등)은
// 자동으로 강제 적용하지 않고 사람이 확정 시점에 참고하는 기준으로만 쓴다(답변 3-2).
//
// amount는 lib/portalParser.js에서 이미 "백만원" 단위로 변환해서 들어온다 — 300억원 = 30,000.
export const WEAPON_SYSTEM_BUSINESS_TYPE = '연구개발(무기체계)'
export const CORE_TECH_BUSINESS_TYPE = '연구개발(핵심기술)'
export const WEAPON_SYSTEM_THRESHOLD = 30_000 // 300억원, 백만원 단위
export const CORE_TECH_THRESHOLD = 15_000 // 150억원, 백만원 단위

// 미실시 예외 조건(사업 특성 고려 참고용 — 자동 적용 안 함)과 직접 대응되는 사업형태 값.
export const MAINTENANCE_BUSINESS_TYPE = '운영유지(정비/수리부속)'

// 사업포털에 실제로 존재하는 사업형태 9종 + 국책사업 전용 "국책" — 포털 동기화든 사람이 직접 지정하든
// 같은 값 집합을 쓴다.
export const BUSINESS_TYPES = [
  '사업기타',
  '양산(국내)',
  '양산(해외)',
  WEAPON_SYSTEM_BUSINESS_TYPE,
  '연구개발(민수)',
  '연구개발(신속시범사업)',
  '연구개발(해외)',
  CORE_TECH_BUSINESS_TYPE,
  MAINTENANCE_BUSINESS_TYPE,
  '국책',
]

// 대면보고는 결재권자가 부문장뿐이다(연구개발본부장 변형 폐지, 사용자 확인).
export const FACE_TO_FACE = '대면보고(부문장)'
export const SHEET_REPORT = '서면보고(본부장)'

export function classifyReviewMethod(businessType, amount) {
  if (businessType === WEAPON_SYSTEM_BUSINESS_TYPE && Number(amount) >= WEAPON_SYSTEM_THRESHOLD) {
    return { autoClassification: FACE_TO_FACE, classificationReason: '무기체계 300억원 이상' }
  }
  if (businessType === CORE_TECH_BUSINESS_TYPE && Number(amount) >= CORE_TECH_THRESHOLD) {
    return { autoClassification: FACE_TO_FACE, classificationReason: '핵심기술 150억원 이상' }
  }
  return { autoClassification: SHEET_REPORT, classificationReason: '기준 금액 미만 (서면보고 기본 적용)' }
}
