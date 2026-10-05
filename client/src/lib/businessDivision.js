// 사업부문 — 포털 데이터엔 없고, 팀이 직접 지정하는 값.
export const BUSINESS_DIVISIONS = ['미래전장사업부문', 'C5ISR사업부문', '미사일시스템사업부문']
export const OUR_DIVISION = '미래전장사업부문'
// R&D 사업부문 자체가 아닌 것으로 확인된 안건(총무/인사 등)에 지정 — "미지정"과 달리
// "판단 끝났고 관리 대상 아님"을 의미해 신규 확인 목록에서 빠지게 된다.
export const NOT_APPLICABLE = '해당없음'
// 안건을 분류할 때 쓰는 선택지(사업부문 3개 + 해당없음). 신규 생성 시 기본값 선택엔 안 쓴다.
export const CLASSIFY_OPTIONS = [...BUSINESS_DIVISIONS, NOT_APPLICABLE]
